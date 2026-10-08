// ============================================================
// CLI: node agents/run-collect.js [--uni=UNI] [--save] [--out=hallazgos.json]
// --uni=ALL recorre las 6 universidades (puede tardar 1-2 min).
// --save  guarda cada hallazgo en Supabase (tabla materiales_referencia
//          + examenes) usando SUPABASE_URL y SUPABASE_SERVICE_KEY
//          (o SUPABASE_ANON_KEY como respaldo).
// Sin --save solo imprime el JSON y lo escribe a disco.
// ============================================================
const fs = require("fs");
const path = require("path");
const { recolectarTodo } = require("./collector.js");

function arg(name, def = null) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split("=").slice(1).join("=");
  if (process.argv.includes(`--${name}`)) return true;
  return def;
}

async function guardarEnSupabase(reporte) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.log("⚠️  Sin SUPABASE_URL / SERVICE_KEY: omito guardado (solo JSON).");
    return { guardados: 0, omitido: true };
  }
  let guardados = 0;
  for (const r of reporte.resultados) {
    for (const h of r.hallazgos) {
      const esExamen = ["examen_pasado", "examen_modelo", "simulacro", "solucionario"].includes(h.tipo);
      const tabla = esExamen ? "examenes" : "materiales_referencia";
      const fila =
        tabla === "examenes"
          ? {
              titulo: h.titulo.slice(0, 200),
              descripcion: `Recolectado por agente web desde ${h.url_fuente}. Tipo: ${h.tipo}. ${h.evidencia}`,
              universidad: h.universidad,
              materia: h.materia_sugerida,
              archivos: [{ name: "ver-pdf.pdf", url: h.url_pdf }],
              contenido_texto: `Fuente: ${h.url_fuente}\nPDF: ${h.url_pdf}\nTipo: ${h.tipo}`,
            }
          : {
              titulo: h.titulo.slice(0, 200),
              materia: h.materia_sugerida,
              descripcion: `Recolectado por agente web desde ${h.url_fuente}. Tipo: ${h.tipo}. ${h.evidencia}`,
              universidad: h.universidad,
              archivos: [{ name: "ver-pdf.pdf", url: h.url_pdf }],
              contenido_texto: `Fuente: ${h.url_fuente}\nPDF: ${h.url_pdf}\nTipo: ${h.tipo}`,
            };
      try {
        const res = await fetch(`${url}/rest/v1/${tabla}`, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(fila),
        });
        if (res.ok) guardados++;
        else console.log(`  ✗ ${tabla}: ${res.status} ${(await res.text()).slice(0, 120)}`);
      } catch (e) {
        console.log(`  ✗ error red: ${e.message}`);
      }
    }
  }
  return { guardados, omitido: false };
}

(async () => {
  const uni = arg("uni", "ALL");
  const out = arg("out", "agents/hallazgos.json");
  const save = !!arg("save", false);
  console.log(`🤖 Agentes Área 52 — recolectando: ${uni === "ALL" ? "todas las universidades" : uni}`);
  const reporte = await recolectarTodo({ uni: uni === "ALL" ? "" : uni, maxPages: 8 });
  console.log(`✅ Hallazgos: ${reporte.total_hallazgos}`);
  for (const r of reporte.resultados) {
    console.log(`   - ${r.universidad}: ${r.hallazgos.length} materiales (${r.visitas.filter((v) => v.ok).length}/${r.visitas.length} páginas OK)`);
    r.hallazgos.slice(0, 5).forEach((h) => console.log(`       · [${h.tipo}/${h.materia_sugerida}] ${h.titulo.slice(0, 70)} → ${h.url_pdf.slice(0, 80)}`));
  }
  const outPath = path.isAbsolute(out) ? out : path.join(process.cwd(), out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(reporte, null, 2), "utf8");
  console.log(`💾 JSON guardado en ${outPath}`);
  if (save) {
    try {
      require("dotenv")?.config?.();
    } catch {}
    const r = await guardarEnSupabase(reporte);
    console.log(r.omitido ? "⏭️  Guardado omitido (sin credenciales)." : `☁️  Guardados en Supabase: ${r.guardados}`);
  } else {
    console.log("💡 Ejecuta con --save para subir a Supabase (requiere SUPABASE_URL + SUPABASE_SERVICE_KEY).");
  }
})();
