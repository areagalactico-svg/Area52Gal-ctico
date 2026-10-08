// ============================================================
// API: POST /api/agents-collect
// Body: { universidad?: "UNI"|"San Marcos"|...|"ALL", save?: boolean, maxPages?: number }
// - Recolecta exámenes/materiales públicos de la web (scraping
//   respetuoso de páginas oficiales de admisión).
// - Si save=true y hay SUPABASE_SERVICE_KEY, los guarda en las
//   tablas examenes / materiales_referencia.
// Requiere: SUPABASE_URL (+ SUPABASE_SERVICE_KEY solo para save).
// ============================================================
const { recolectarTodo, recolectarUniversidad } = require("../agents/collector.js");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const uni = (body.universidad || "ALL").trim();
  const save = body.save === true;
  const maxPages = Math.min(Math.max(parseInt(body.maxPages || "8", 10), 1), 12);

  try {
    const reporte = await recolectarTodo({ uni: uni === "ALL" ? "" : uni, maxPages });

    let guardados = 0;
    let saveError = null;
    if (save) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY;
      if (!url || !key) {
        saveError = "Falta SUPABASE_SERVICE_KEY en el servidor: devuelvo hallazgos sin guardar.";
      } else {
        for (const r of reporte.resultados) {
          for (const h of r.hallazgos) {
            const esExamen = ["examen_pasado", "examen_modelo", "simulacro", "solucionario"].includes(h.tipo);
            const tabla = esExamen ? "examenes" : "materiales_referencia";
            const fila =
              tabla === "examenes"
                ? {
                    titulo: String(h.titulo).slice(0, 200),
                    descripcion: `Recolectado por agente web desde ${h.url_fuente}. Tipo: ${h.tipo}. ${h.evidencia}`,
                    universidad: h.universidad,
                    materia: h.materia_sugerida,
                    archivos: [{ name: "ver-pdf.pdf", url: h.url_pdf }],
                    contenido_texto: `Fuente: ${h.url_fuente}\nPDF: ${h.url_pdf}\nTipo: ${h.tipo}`,
                  }
                : {
                    titulo: String(h.titulo).slice(0, 200),
                    materia: h.materia_sugerida,
                    descripcion: `Recolectado por agente web desde ${h.url_fuente}. Tipo: ${h.tipo}. ${h.evidencia}`,
                    universidad: h.universidad,
                    archivos: [{ name: "ver-pdf.pdf", url: h.url_pdf }],
                    contenido_texto: `Fuente: ${h.url_fuente}\nPDF: ${h.url_pdf}\nTipo: ${h.tipo}`,
                  };
            try {
              const rr = await fetch(`${url}/rest/v1/${tabla}`, {
                method: "POST",
                headers: {
                  apikey: key,
                  Authorization: `Bearer ${key}`,
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
                body: JSON.stringify(fila),
              });
              if (rr.ok) guardados++;
            } catch (e) {
              saveError = String(e.message || e);
            }
          }
        }
      }
    }

    return res.status(200).json({ ...reporte, guardados, saveError });
  } catch (e) {
    console.error("agents-collect error:", e);
    return res.status(500).json({ error: "Error del agente recolector" });
  }
};
