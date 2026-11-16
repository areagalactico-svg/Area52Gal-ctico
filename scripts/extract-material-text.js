// ============================================================
// scripts/extract-material-text.js
// Extrae el TEXTO de los PDFs subidos (materiales_referencia,
// simulacros_ien y examenes) y lo guarda en contenido_texto,
// para que la IA genere el simulacro BASADO en ese material.
// Uso:
//   node scripts/extract-material-text.js            (extrae y guarda)
//   node scripts/extract-material-text.js --dry-run  (solo muestra)
// ============================================================
const fs = require("fs");
const path = require("path");

// Carga .env (clave=valor) ANTES de usar nada
try {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const { PDFParse } = require("pdf-parse");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || null;

const DRY = process.argv.includes("--dry-run");

async function extraerDePDF(url, nombre) {
  try {
    const parser = new PDFParse({ url });
    const result = await parser.getText();
    return String(result.text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  } catch (e) {
    throw new Error(`No se pudo leer ${nombre}: ${e.message}`);
  }
}

async function procesarTabla(table, campoTexto) {
  const h = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id,titulo,archivos,${campoTexto}`, { headers: h });
  if (!r.ok) { console.log(`  (no se pudo leer ${table}: HTTP ${r.status})`); return; }
  const rows = await r.json();
  console.log(`\n=== ${table} (${rows.length} registros) ===`);
  for (const row of rows) {
    const actual = String(row[campoTexto] || "");
    const pdfs = (Array.isArray(row.archivos) ? row.archivos : []).filter((a) => /\.pdf(\?|#|$)/i.test(a.url || a.name || ""));
    if (actual.trim().length > 50) {
      console.log(`  ✓ "${row.titulo}" ya tiene texto (${actual.length} chars) — se omite`);
      continue;
    }
    if (!pdfs.length) {
      console.log(`  ⚠ "${row.titulo}" sin PDFs y sin texto`);
      continue;
    }
    try {
      const partes = [];
      for (const p of pdfs) {
        const t = await extraerDePDF(p.url, p.name || row.titulo);
        if (t) partes.push(`=== ${p.name || "PDF"} ===\n${t}`);
      }
      const texto = partes.join("\n\n").trim();
      if (!texto) {
        console.log(`  ⚠ "${row.titulo}": el PDF no contiene texto extraíble (parece escaneo/imagen)`);
        continue;
      }
      console.log(`  ✔ "${row.titulo}": ${texto.length} chars extraídos de ${pdfs.length} PDF(s)${DRY ? " (dry-run, no se guarda)" : ""}`);
      if (!DRY) {
        if (!SUPABASE_SERVICE) throw new Error("Falta SUPABASE_SERVICE_KEY en .env para escribir");
        const pr = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${row.id}`, {
          method: "PATCH",
          headers: { apikey: SUPABASE_SERVICE, Authorization: `Bearer ${SUPABASE_SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ [campoTexto]: texto }),
        });
        if (!pr.ok) throw new Error(`PATCH falló: HTTP ${pr.status} ${await pr.text()}`);
        console.log(`     → guardado en ${campoTexto}`);
      }
    } catch (e) {
      console.log(`  ✗ "${row.titulo}": ${e.message}`);
    }
  }
}

(async () => {
  await procesarTabla("materiales_referencia", "contenido_texto");
  await procesarTabla("simulacros_ien", "contenido_texto");
  await procesarTabla("examenes", "contenido_texto");
  console.log("\nListo.");
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
