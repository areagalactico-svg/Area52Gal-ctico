// ============================================================
// scripts/regenerate-simulacro.js
// Regenera las 65 preguntas de un simulacro con el sistema nuevo:
//   - Material subido como FUENTE PRINCIPAL (contexto)
//   - MÁXIMO nivel (reglas completas + refuerzo de nivel)
//   - CLAVE DE RESPUESTA validada (entero 0-4, 5 opciones A-E)
//   - AUDITORÍA con IA (resuelve y corrige/elimina claves malas)
// Aborta si el simulacro ya tiene envíos (a menos que --force).
// Uso:
//   node scripts/regenerate-simulacro.js                (usa el 1er simulacro)
//   node scripts/regenerate-simulacro.js <id-o-titulo>
//   node scripts/regenerate-simulacro.js <id> --force
// ============================================================
const fs = require("fs");
const path = require("path");

// .env ANTES de requerir la API (lee process.env al cargar)
try {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const handler = require(path.join(__dirname, "..", "api", "generate-questions.js"));

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || null;

const FORCE = process.argv.includes("--force");
const REF = process.argv.slice(2).find((a) => !a.startsWith("--"));

const BLOQUES = [
  { seccion: "razonamiento_matematico", cantidad: 12 },
  { seccion: "razonamiento_verbal", cantidad: 13 },
  { seccion: "humanidades_pe1", cantidad: 10 },
  { seccion: "matematica", cantidad: 10 },
  { seccion: "fisica", cantidad: 7 },
  { seccion: "quimica", cantidad: 7 },
  { seccion: "humanidades_pe3", cantidad: 6 },
];

// Llama al handler de la API como si fuera HTTP (sin levantar servidor)
function llamarAPI(payload) {
  return new Promise((resolve, reject) => {
    const req = { method: "POST", body: JSON.stringify(payload) };
    let settled = false;
    const res = {
      _code: 200,
      setHeader() {},
      status(c) { this._code = c; return this; },
      json(obj) { if (!settled) { settled = true; resolve({ code: this._code, body: obj }); } return this; },
      end() { if (!settled) { settled = true; resolve({ code: this._code, body: {} }); } return this; },
    };
    Promise.resolve(handler(req, res)).catch((e) => { if (!settled) { settled = true; reject(e); } });
  });
}

function esValida(q) {
  if (!q || typeof q !== "object") return false;
  if (!String(q.texto || "").trim()) return false;
  const opts = Array.isArray(q.opciones) ? q.opciones : [];
  if (opts.length !== 5) return false;
  if (opts.some((o) => typeof o !== "string" || !o.trim())) return false;
  const rc = q.respuestaCorrecta;
  return Number.isInteger(rc) && rc >= 0 && rc < opts.length && String(opts[rc] || "").trim().length > 0;
}

async function get(url, headers) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GET → HTTP ${r.status}`);
  return r.json();
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    throw new Error("Falta OPENROUTER_API_KEY en .env");
  }
  if (!SUPABASE_SERVICE) throw new Error("Falta SUPABASE_SERVICE_KEY en .env");

  const h = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };

  // --- 1. Localizar el simulacro ---
  const sims = await get(`${SUPABASE_URL}/rest/v1/simulacros_ien?select=id,titulo,universidad,contenido_texto,preguntas,archivos&order=fecha.desc`, h);
  if (!sims.length) throw new Error("No hay simulacros");
  const sim = REF
    ? sims.find((s) => s.id === REF || s.titulo.toLowerCase().includes(REF.toLowerCase()))
    : sims[0];
  if (!sim) throw new Error(`No encontré simulacro con referencia "${REF}"`);
  console.log(`Simulacro: "${sim.titulo}" (${sim.id})`);

  // --- 2. Abortar si ya tiene envíos ---
  const subs = await get(`${SUPABASE_URL}/rest/v1/simulacro_submissions?simulacro_id=eq.${sim.id}&select=id&limit=1`, h).catch(() => []);
  if (subs.length && !FORCE) {
    throw new Error(`El simulacro ya tiene ${subs.length}+ envío(s). Usa --force si aun así quieres regenerar.`);
  }

  // --- 3. Contexto: material subido como fuente principal ---
  let context = String(sim.contenido_texto || "");
  const traer = async (tabla, campo) => {
    try {
      const rows = await get(`${SUPABASE_URL}/rest/v1/${tabla}?select=titulo,${campo}&universidad=eq.${encodeURIComponent(sim.universidad || "UNI")}`, h);
      for (const row of rows || []) {
        const txt = row[campo];
        if (txt && String(txt).trim()) context += `\n\n=== ${tabla}: ${row.titulo} ===\n${txt}`;
      }
    } catch {}
  };
  await traer("materiales_referencia", "contenido_texto");
  await traer("examenes", "contenido_texto");
  await traer("temarios", "contenido");
  context = context.slice(0, 40000);
  console.log(`Contexto (material): ${context.length} chars ${context.length ? "✓" : "⚠ VACÍO — la IA usará su conocimiento general"}`);
  if (!context.length) console.log("  (ejecuta antes: node scripts/extract-material-text.js)");

  const exclusiones = (sim.preguntas || []).map((q) => q.texto);
  console.log(`Preguntas actuales: ${(sim.preguntas || []).length} (se usan como excluidas para no repetir)`);

  // --- 4. Generar por bloques (validando clave en cada respuesta) ---
  const preguntas = [];
  const stats = { repetidas: 0, invalidas: 0, corregidas: 0, descartadasAudit: 0 };
  let grupoIdx = 0;

  async function generarBloque(bloque, indice) {
    const lote = [];
    let intentos = 0;
    while (lote.length < bloque.cantidad) {
      if (++intentos > 10) throw new Error(`Bloque ${indice + 1} ("${bloque.seccion}") no completó (${lote.length}/${bloque.cantidad}) tras 10 intentos`);
      const faltan = bloque.cantidad - lote.length;
      process.stdout.write(`  bloque ${indice + 1}/${BLOQUES.length} ${bloque.seccion}: ${lote.length}/${bloque.cantidad} (intento ${intentos})\n`);
      const { code, body } = await llamarAPI({
        topic: "Examen Completo IEN",
        type: "simulacro",
        count: Math.min(faltan, 4),
        batch_section: bloque.seccion,
        context,
        universidad: sim.universidad || "UNI",
        exclude_textos: exclusiones.concat(preguntas, lote).map((q) => (typeof q === "string" ? q : q.texto)),
      });
      if (code !== 200 || !Array.isArray(body.preguntas)) {
        throw new Error(`API respondió ${code}: ${body.error || "sin detalle"}`);
      }
      stats.repetidas += body.repetidas_filtradas || 0;
      stats.invalidas += body.invalidas_filtradas || 0;
      if (body.auditoria) {
        stats.corregidas += body.auditoria.corregidas || 0;
        stats.descartadasAudit += body.auditoria.descartadas || 0;
      }
      const validas = body.preguntas.filter(esValida);
      if (!validas.length) continue;
      lote.push(...validas.slice(0, faltan));
    }
    console.log(`  ✔ bloque ${indice + 1} listo: ${bloque.seccion} (${lote.length}/${bloque.cantidad})`);
    return lote;
  }

  const t0 = Date.now();
  for (let i = 0; i < BLOQUES.length; i += 3) {
    const grupo = BLOQUES.slice(i, i + 3);
    const resultados = await Promise.allSettled(grupo.map((b, j) => generarBloque(b, i + j)));
    const fallo = resultados.find((r) => r.status === "rejected");
    if (fallo) throw fallo.reason;
    resultados.forEach((r) => preguntas.push(...r.value));
    grupoIdx += grupo.length;
    console.log(`— progreso total: ${preguntas.length}/65 —`);
  }
  console.log(`Generación completada en ${Math.round((Date.now() - t0) / 1000)}s`);

  // --- 5. Validación final de claves ---
  const invalidas = preguntas.filter((q) => !esValida(q));
  if (invalidas.length) throw new Error(`${invalidas.length} pregunta(s) finales sin clave válida — NO se guarda nada`);
  if (preguntas.length !== 65) throw new Error(`Se obtuvieron ${preguntas.length} de 65 preguntas — NO se guarda nada`);

  // --- 6. Guardar ---
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/simulacros_ien?id=eq.${sim.id}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_SERVICE, Authorization: `Bearer ${SUPABASE_SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ preguntas, duracion: 180 }),
  });
  if (!pr.ok) throw new Error(`PATCH falló: HTTP ${pr.status} ${await pr.text()}`);

  // --- 7. Resumen ---
  const dist = {};
  const areas = {};
  const niveles = {};
  preguntas.forEach((q) => {
    dist[q.respuestaCorrecta] = (dist[q.respuestaCorrecta] || 0) + 1;
    areas[q.area || "?"] = (areas[q.area || "?"] || 0) + 1;
    niveles[q.dificultad || "alta"] = (niveles[q.dificultad || "?"] || 0) + 1;
  });
  console.log("\n================ GUARDADO ================");
  console.log(`✔ 65 preguntas válidas escritas en "${sim.titulo}" (duracion: 180 min)`);
  console.log(`  Distribución de claves (índice 0-4):`, JSON.stringify(dist));
  console.log(`  Áreas:`, JSON.stringify(areas));
  console.log(`  Niveles:`, JSON.stringify(niveles));
  console.log(`  Filtros: repetidas=${stats.repetidas} inválidas=${stats.invalidas}`);
  console.log(`  Auditoría IA: ${stats.corregidas} clave(s) corregida(s), ${stats.descartadasAudit} pregunta(s) descartada(s)`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("\nERROR:", e.message);
  process.exit(1);
});
