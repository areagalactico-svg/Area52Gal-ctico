// ============================================================
// API: POST /api/clone-problem — CLOTADOR INFINITO DE PROBLEMAS
// Body: {
//   texto: string (problema original, obligatorio),
//   opciones?: string[], respuestaCorrecta?: number,
//   area?: string, subtema?: string, universidad?: string,
//   nivel?: "facil" | "igual" | "dificil"  (default "igual"),
//   cantidad?: 1|2|3 (default 1),
//   estudiante_email?: string
// }
// Conserva la estructura lógica y el principio teórico del problema
// original, variando datos/ángulos/condiciones, con recalculo de
// respuesta y distractores. Los clones se guardan en la tabla
// pregunta_clones (FUERA del banco anti-repetición: son práctica
// deliberada, no material de simulacro, así no bloquean preguntas
// nuevas ni son filtrados por similitud).
// ============================================================
const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || null;

function normalizar(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashPregunta(textoNorm, opciones) {
  const opts = (opciones || []).map(normalizar).sort().join("|");
  return crypto.createHash("sha256").update(textoNorm + "||" + opts).digest("hex");
}

function trigramas(s) {
  const t = `  ${s} `;
  const set = new Set();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}

function similitudConSet(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return (2 * inter) / (setA.size + setB.size);
}

const NIVELES = {
  facil: `NIVEL "MÁS FÁCIL" (afianzar bases): mantén el MISMO concepto y estructura lógica, pero simplifica los datos (enteros redondos), elimina un paso intermedio y quita una condición trampa. Sigue siendo de examen, solo un escalón más abajo.`,
  igual: `NIVEL "IGUAL" (misma dificultad): mismos pasos de resolución, mismos conceptos combinados, distintos datos. La dificultad debe sentirse idéntica al original.`,
  dificil: `NIVEL "MÁS DIFÍCIL" (tipo examen final): además de variar los datos, agrega una condición extra o combina un tercer concepto (2+ conceptos, 3+ pasos de resolución). Requiere un insight intermedio adicional.`,
};

async function clonesPrevios(universidad) {
  try {
    const u = `${SUPABASE_URL}/rest/v1/pregunta_clones?select=texto_norm,hash&universidad=eq.${encodeURIComponent(universidad)}&order=created_at.desc&limit=300`;
    const r = await fetch(u, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
    if (!r.ok) return { hashes: new Set(), entradas: [] };
    const rows = await r.json();
    return {
      hashes: new Set((rows || []).map((x) => x.hash).filter(Boolean)),
      entradas: (rows || []).filter((x) => x.texto_norm).map((x) => ({ hash: x.hash, norm: x.texto_norm, set: trigramas(x.texto_norm) })),
    };
  } catch {
    return { hashes: new Set(), entradas: [] };
  }
}

async function guardarClones(universidad, clones) {
  if (!clones.length) return;
  const key = SUPABASE_SERVICE || SUPABASE_ANON;
  const filas = clones.map((c) => ({
    universidad,
    original_texto: String(c.original).slice(0, 2000),
    texto: String(c.texto).slice(0, 2000),
    texto_norm: c.texto_norm,
    hash: c.hash,
    opciones: c.opciones || [],
    respuesta_correcta: Number.isInteger(c.respuestaCorrecta) ? c.respuestaCorrecta : 0,
    explicacion: String(c.explicacion || "").slice(0, 1000),
    pasos: Array.isArray(c.pasos) ? c.pasos : [],
    area: c.area || "",
    subtema: c.subtema || "",
    nivel: c.nivel || "igual",
    estudiante_email: c.estudiante_email || "anonimo",
  }));
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/pregunta_clones`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(filas),
    });
  } catch {} // si la tabla aún no existe, se ignora sin romper la respuesta
}

async function llamarIA(API_KEY, original, nivel, cantidad, exclusion) {
  const systemPrompt = `Eres un experto creador de problemas para exámenes de admisión peruanos (UNI, San Marcos, PUCP, La Molina, etc.).
Tu tarea es CLONAR el problema original que te indique el usuario: conservar su estructura lógica y principio teórico, pero con datos nuevos.

${NIVELES[nivel] || NIVELES.igual}

REGLAS OBLIGATORIAS:
1. Reescríbebo el enunciado con otras palabras; NO copies frases literales del original.
2. Conserva: mismo subtema, mismo número de opciones, misma dificultad de razonamiento.
3. Cambia TODO dato numérico (valores, ángulos, masas, cantidades, precios, longitudes...). Nunca repitas los del original.
4. Recalcula la respuesta correcta con los nuevos datos y verifica tu cálculo paso a paso antes de responder.
5. Los distractores deben ser errores típicos del mismo procedimiento aplicados a los NUEVOS datos (signo cambiado, fórmula a medias, resultado parcial, confusión de concepto...), no números aleatorios.
6. Incluye "pasos" (array con 3+ pasos de resolución del problema clonado) y una "explicacion" breve.
7. La respuesta correcta es el índice (0-based) de la opción correcta.

FORMATO JSON VÁLIDO (sin markdown, sin backticks):
{
  "preguntas": [
    {
      "texto": "Enunciado del clon",
      "opciones": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
      "respuestaCorrecta": 0,
      "pasos": ["paso 1", "paso 2", "paso 3"],
      "explicacion": "Por qué la correcta es la correcta"
    }
  ]
}`;
  const userMsg = `PROBLEMA ORIGINAL A CLONAR:
${original}

Genera ${cantidad} clon(es) del problema con datos nuevos y distintos a los originales.${exclusion ? `\n\nPROHIBIDO (clones ya existentes, no los repitas ni reescrituras):${exclusion}` : ""}`;
  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      max_tokens: 4000,
      temperature: 0.9,
    }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const content = data.choices?.[0]?.message?.content || "";
  try {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    if (!parsed.preguntas || !Array.isArray(parsed.preguntas)) return null;
    return parsed.preguntas;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const original = String(body.texto || "").trim();
  if (!original) return res.status(400).json({ error: "Falta el problema original" });
  if (original.length < 15) return res.status(400).json({ error: "Problema demasiado corto para clonar" });

  const API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "API key not configured" });

  const universidad = (body.universidad || "UNI").trim() || "UNI";
  const nivel = NIVELES[body.nivel] ? body.nivel : "igual";
  const cantidad = Math.min(Math.max(parseInt(body.cantidad) || 1, 1), 3);
  const estudiante = (body.estudiante_email || "").trim() || "anonimo";

  try {
    const prev = await clonesPrevios(universidad);
    let candidatas = null;
    let exclusion = prev.entradas.slice(-8).map((e) => `- ${e.norm.slice(0, 110)}`).join("\n");

    for (let intento = 0; intento < 2; intento++) {
      candidatas = await llamarIA(API_KEY, original, nivel, cantidad, exclusion);
      if (!candidatas || !candidatas.length) break;

      const origNorm = normalizar(original);
      const origSet = trigramas(origNorm);
      const validas = [];
      const nOptOriginal = Array.isArray(body.opciones) && body.opciones.length ? body.opciones.length : 0;
      for (const q of candidatas) {
        const norm = normalizar(q.texto);
        if (!norm || norm.length < 20) continue;
        if (!Array.isArray(q.opciones) || q.opciones.length < 2) continue;
        if (nOptOriginal && q.opciones.length !== nOptOriginal) continue;
        if (!Number.isInteger(q.respuestaCorrecta) || q.respuestaCorrecta < 0 || q.respuestaCorrecta >= q.opciones.length) continue;
        const normOrigBase = norm.split(" ").slice(0, 6).join(" ");
        if (origNorm.startsWith(normOrigBase) && norm.startsWith(origNorm.split(" ").slice(0, 6).join(" "))) continue;
        const hash = hashPregunta(norm, q.opciones);
        if (prev.hashes.has(hash)) continue;
        if (similitudConSet(trigramas(norm), origSet) >= 0.95) continue; // calco del original
        let dup = false;
        for (const e of prev.entradas) {
          if (e.hash === hash || similitudConSet(trigramas(norm), e.set) >= 0.9) { dup = true; break; }
        }
        if (dup) continue;
        prev.hashes.add(hash);
        prev.entradas.push({ hash, norm, set: trigramas(norm) });
        validas.push({
          ...q,
          texto_norm: norm,
          hash,
          original,
          nivel,
          area: (body.area || "").slice(0, 60),
          subtema: (body.subtema || "").slice(0, 80),
          estudiante_email: estudiante,
        });
      }
      if (validas.length) {
        candidatas = validas;
        break;
      }
      exclusion = [...prev.entradas.slice(-10)].map((e) => `- ${e.norm.slice(0, 110)}`).join("\n");
      candidatas = null;
    }

    if (!candidatas || !candidatas.length) {
      return res.status(502).json({ error: "No pude generar el clon. Intenta de nuevo." });
    }

    await guardarClones(universidad, candidatas);

    const limpias = candidatas.map(({ texto_norm, hash, original: _o, nivel: _n, estudiante_email: _e, ...q }) => q);
    return res.status(200).json({ preguntas: limpias, nivel, total: limpias.length });
  } catch (e) {
    console.error("clone-problem error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
};
