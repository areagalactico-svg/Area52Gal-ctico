// ============================================================
// API: POST /api/registrar-vistas
// Registra qué preguntas ya vio cada estudiante para no
// repetírselas en futuros simulacros. Además retroalimenta el
// banco: las preguntas de simulacros guardados en JSONB entran
// al banco central (find-or-create por hash).
// Body: {
//   estudiante_email, simulacro_id?, universidad?,
//   preguntas: [{ texto, opciones, respuestaCorrecta, area?, subtema? }],
//   respuestas: { "0": 2, "1": 0, ... }
// }
// ============================================================
const crypto = require("crypto");

const SB_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_KEY || null;
const SB_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";

function normalizarTexto(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashPregunta(norm, opciones) {
  const base = norm + "|" + (opciones || []).map((o) => normalizarTexto(o)).sort().join("|");
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 32);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { estudiante_email, simulacro_id, universidad, preguntas, respuestas } = body;

  if (!estudiante_email || estudiante_email === "anonimo" || !Array.isArray(preguntas) || !preguntas.length) {
    return res.status(200).json({ registradas: 0, omitido: true });
  }
  if (!SB_SERVICE) {
    // Sin service key no se puede escribir (RLS): se omite sin error
    return res.status(200).json({ registradas: 0, omitido: true, motivo: "sin SERVICE_KEY" });
  }

  const UNI = universidad || "UNI";
  const H = { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" };

  try {
    // 1) Find-or-create en el banco
    const filas = [];
    const vistos = new Set();
    for (const p of preguntas) {
      const norm = normalizarTexto(p.texto);
      if (norm.length < 10) continue;
      const h = p.banco_id ? null : hashPregunta(norm, p.opciones);
      if (h && vistos.has(h)) continue;
      if (h) vistos.add(h);
      filas.push({
        p, norm, h,
        fila: {
          universidad: UNI,
          area: p.area || "",
          subtema: p.subtema || "",
          materia: p.subtema || p.area || "General",
          texto: p.texto,
          texto_norm: norm,
          hash: h || "x",
          opciones: p.opciones || [],
          respuesta_correcta: p.respuestaCorrecta || 0,
          explicacion: p.explicacion || "",
          origen: "simulacro",
        },
      });
    }

    // Las que ya traen banco_id no necesitan insert
    const paraInsertar = filas.filter((f) => !f.p.banco_id);
    let mapa = {};
    if (paraInsertar.length) {
      const rr = await fetch(`${SB_URL}/rest/v1/banco_preguntas`, {
        method: "POST",
        headers: { ...H, Prefer: "return=representation,resolution=ignore-duplicates" },
        body: JSON.stringify(paraInsertar.map((f) => f.fila)),
      });
      if (rr.ok) {
        const rows = await rr.json().catch(() => []);
        // Las ignoradas por duplicado no vienen en la respuesta: buscarlas por hash
        const devueltos = new Set((rows || []).map((r) => r.hash));
        const faltantes = paraInsertar.map((f) => f.fila.hash).filter((h) => !devueltos.has(h));
        let extra = [];
        if (faltantes.length) {
          const r2 = await fetch(
            `${SB_URL}/rest/v1/banco_preguntas?hash=in.(${faltantes.join(",")})&select=id,hash`,
            { headers: H }
          );
          if (r2.ok) extra = await r2.json();
        }
        [...(rows || []), ...extra].forEach((r) => { mapa[r.hash] = r.id; });
      }
    }

    const ids = filas.map((f) => f.p.banco_id || mapa[f.h]).filter(Boolean);

    // 2) Registrar vistas (ignora las ya registradas)
    let registradas = 0;
    if (ids.length) {
      const vistaFilas = filas
        .map((f) => ({ f, id: f.p.banco_id || mapa[f.h] }))
        .filter((x) => x.id)
        .map((x, i) => {
          const idx = preguntas.indexOf(x.f.p);
          const sel = respuestas ? respuestas[idx] : undefined;
          return {
            estudiante_email,
            pregunta_id: x.id,
            simulacro_id: simulacro_id || null,
            fue_correcta: sel === undefined || sel === null ? null : sel === (x.f.p.respuestaCorrecta || 0),
          };
        });
      for (let i = 0; i < vistaFilas.length; i += 100) {
        const chunk = vistaFilas.slice(i, i + 100);
        try {
          const rv = await fetch(`${SB_URL}/rest/v1/pregunta_vistas`, {
            method: "POST",
            headers: { ...H, Prefer: "return=minimal,resolution=ignore-duplicates" },
            body: JSON.stringify(chunk),
          });
          if (rv.ok) registradas += chunk.length;
        } catch {}
      }
    }

    return res.status(200).json({ registradas, banco_total: ids.length });
  } catch (e) {
    console.error("registrar-vistas error:", e);
    return res.status(200).json({ registradas: 0, omitido: true });
  }
};
