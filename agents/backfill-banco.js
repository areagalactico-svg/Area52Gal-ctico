// ============================================================
// Backfill: carga las preguntas YA existentes (simulacros_ien) al
// banco anti-repetición, para que las próximas generaciones no las
// repitan. Solo inserta (nunca borra ni modifica).
// Uso:
//   node agents/backfill-banco.js --dry        (solo cuenta)
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node agents/backfill-banco.js
// Requiere que supabase-banco-preguntas.sql ya se haya ejecutado.
// ============================================================
const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";
const WRITE_KEY = process.env.SUPABASE_SERVICE_KEY || null;

function normalizarTexto(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashPregunta(textoNorm, opciones) {
  const opts = (opciones || []).map((o) => normalizarTexto(o)).sort().join("|");
  return crypto.createHash("sha256").update(textoNorm + "||" + opts).digest("hex");
}

function hashOpciones(opciones) {
  const opts = (opciones || []).map((o) => normalizarTexto(o)).sort().join("|");
  if (!opts.replace(/\|/g, "")) return "";
  return crypto.createHash("sha256").update(opts).digest("hex").slice(0, 32);
}

function numerosDe(textoNorm) {
  const nums = (textoNorm.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(",", "."));
  return Array.from(new Set(nums)).sort().join(",");
}

(async () => {
  const dry = process.argv.includes("--dry");
  console.log("📦 Backfill banco de preguntas" + (dry ? " (DRY RUN)" : ""));

  const r = await fetch(`${SUPABASE_URL}/rest/v1/simulacros_ien?select=id,titulo,universidad,preguntas&limit=200`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  if (!r.ok) throw new Error(`No se pudo leer simulacros_ien: ${r.status}`);
  const sims = await r.json();

  const seen = new Set();
  const filas = [];
  for (const s of sims) {
    for (const q of s.preguntas || []) {
      const norm = normalizarTexto(q.texto);
      if (!norm || norm.length < 10) continue;
      const h = hashPregunta(norm, q.opciones);
      if (seen.has(h)) continue;
      seen.add(h);
      const optsArr = q.opciones || [];
      filas.push({
        universidad: s.universidad || "UNI",
        texto: String(q.texto).slice(0, 2000),
        texto_norm: norm,
        hash: h,
        opciones: optsArr,
        respuesta_correcta: Number.isInteger(q.respuestaCorrecta) ? q.respuestaCorrecta : 0,
        opciones_hash: hashOpciones(optsArr),
        numeros: numerosDe(norm),
        area: q.area || "",
        subtema: q.subtema || "",
        explicacion: String(q.explicacion || "").slice(0, 1000),
      });
    }
  }
  console.log(`   Simulacros leídos: ${sims.length} → preguntas únicas: ${filas.length}`);
  if (dry || !filas.length) {
    console.log("   (dry run: nada que guardar)");
    return;
  }
  if (!WRITE_KEY) {
    console.log("   ⚠️ Sin SUPABASE_SERVICE_KEY: no se puede escribir (RLS). Ejecuta con la service key.");
    return;
  }
  // Insertar por lotes de 200
  let ok = 0;
  for (let i = 0; i < filas.length; i += 200) {
    const lote = filas.slice(i, i + 200);
    const rr = await fetch(`${SUPABASE_URL}/rest/v1/banco_preguntas?on_conflict=hash`, {
      method: "POST",
      headers: {
        apikey: WRITE_KEY,
        Authorization: `Bearer ${WRITE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(lote),
    });
    if (rr.ok) ok += lote.length;
    else console.log(`   ✗ lote ${i}: ${rr.status} ${(await rr.text()).slice(0, 150)}`);
  }
  console.log(`✅ Guardadas/actualizadas: ${ok}`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
