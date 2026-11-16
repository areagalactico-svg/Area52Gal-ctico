// ============================================================
// scripts/verify-simulacros.js
// Verifica que TODAS las preguntas de los simulacros guardados
// tengan CLAVE DE RESPUESTA VÁLIDA:
//   - respuestaCorrecta: entero dentro de rango de opciones
//   - opciones: array con el nº exacto de opciones y sin vacías
//   - texto: enunciado presente
// Uso: node scripts/verify-simulacros.js [--repair]
//   --repair: elimina del simulacro las preguntas inválidas
//             (NUNCA las reescribe: solo las quita)
// ============================================================
const fs = require("fs");
const path = require("path");

// Carga .env simple (clave=valor por línea)
try {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON;
const OPCIONES_IEN = 5; // el examen IEN usa 5 opciones (A-E)

const REPAIR = process.argv.includes("--repair");

function validarPregunta(q, i) {
  const errores = [];
  if (!q || typeof q !== "object") return [`#${i + 1}: no es un objeto`];
  const texto = typeof q.texto === "string" ? q.texto.trim() : "";
  if (!texto) errores.push(`#${i + 1}: sin enunciado (texto vacío)`);

  const opts = Array.isArray(q.opciones) ? q.opciones : [];
  if (opts.length !== OPCIONES_IEN) {
    errores.push(`#${i + 1}: tiene ${opts.length} opciones, se esperan ${OPCIONES_IEN} (A-E)`);
  }
  opts.forEach((o, oi) => {
    if (typeof o !== "string" || !o.trim()) errores.push(`#${i + 1}: opción ${oi + 1} vacía`);
  });

  const rc = q.respuestaCorrecta;
  const rcNum = typeof rc === "string" && /^\d+$/.test(rc.trim()) ? parseInt(rc, 10) : rc;
  if (!Number.isInteger(rcNum)) {
    errores.push(`#${i + 1}: respuestaCorrecta ausente o no numérica (valor: ${JSON.stringify(rc)})`);
  } else if (rcNum < 0 || rcNum >= opts.length) {
    errores.push(`#${i + 1}: respuestaCorrecta=${rcNum} fuera de rango (0-${Math.max(0, opts.length - 1)})`);
  } else if (!String(opts[rcNum] || "").trim()) {
    errores.push(`#${i + 1}: la opción correcta (índice ${rcNum}) está vacía`);
  }
  return errores;
}

async function get(url, headers) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`GET ${url} → HTTP ${r.status}`);
  return r.json();
}

(async () => {
  const h = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };

  const simulacros = await get(`${SUPABASE_URL}/rest/v1/simulacros_ien?select=id,titulo,activo,fecha_inicio,preguntas&order=fecha.desc`, h);
  const materiales = await get(`${SUPABASE_URL}/rest/v1/materiales_referencia?select=titulo,materia,universidad,contenido_texto`, h)
    .catch(() => []);

  console.log("=== MATERIALES DISPONIBLES (contexto para la IA) ===");
  if (!materiales.length) console.log("  (ninguno)");
  for (const m of materiales) {
    const len = (m.contenido_texto || "").length;
    console.log(`  - "${m.titulo}" [${m.materia || "?"} / ${m.universidad || "?"}] texto: ${len} chars ${len === 0 ? "⚠ SIN TEXTO (la IA no podrá basarse en él)" : "✓"}`);
  }

  let totalInvalidas = 0;
  console.log("\n=== SIMULACROS ===");
  for (const s of simulacros) {
    const preguntas = Array.isArray(s.preguntas) ? s.preguntas : [];
    const invalidas = [];
    preguntas.forEach((q, i) => {
      const errs = validarPregunta(q, i);
      if (errs.length) invalidas.push({ i, errs, q });
    });
    totalInvalidas += invalidas.length;
    const rcDist = {};
    preguntas.forEach((q) => {
      const k = Number.isInteger(q?.respuestaCorrecta) ? q.respuestaCorrecta : "inválido";
      rcDist[k] = (rcDist[k] || 0) + 1;
    });
    console.log(`\n✔ "${s.titulo}" (${s.id})`);
    console.log(`  preguntas: ${preguntas.length} | inválidas: ${invalidas.length} | distribución claves: ${JSON.stringify(rcDist)}`);
    if (invalidas.length) {
      for (const inv of invalidas.slice(0, 20)) console.log(`  ✗ ${inv.errs.join(" | ")}`);
      if (invalidas.length > 20) console.log(`  ... y ${invalidas.length - 20} más`);
    }

    if (REPAIR && invalidas.length) {
      const validas = preguntas.filter((q, i) => !invalidas.some((inv) => inv.i === i));
      const key = SUPABASE_SERVICE;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/simulacros_ien?id=eq.${s.id}`, {
        method: "PATCH",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ preguntas: validas }),
      });
      console.log(r.ok
        ? `  🔧 REPARADO: quedaron ${validas.length} preguntas válidas (se eliminaron ${invalidas.length})`
        : `  ⚠ Error al reparar: HTTP ${r.status}`);
    }
  }

  console.log(`\n=== RESUMEN: ${simulacros.length} simulacro(s), ${totalInvalidas} pregunta(s) sin clave válida ===`);
  if (totalInvalidas && !REPAIR) {
    console.log("Para eliminarlas: node scripts/verify-simulacros.js --repair");
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
