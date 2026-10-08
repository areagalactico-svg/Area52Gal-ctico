// ============================================================
// API: POST /api/generate-guide
// Genera la GUÍA DE APRENDIZAJE PERSONALIZADA de un estudiante a
// partir de: (1) su resultado del simulacro, (2) el material real
// recolectado por los agentes (exámenes/temarios/materiales de su
// universidad en Supabase).
// Body: {
//   estudiante: { nombre, email, whatsapp, universidad },
//   resultado: { simulacro_id?, simulacro_titulo, puntaje, nota,
//                porcentaje, tiempo_segundos, area_results },
//   save?: boolean
// }
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";

async function tablaPublica(tabla, universidad) {
  try {
    const u = `${SUPABASE_URL}/rest/v1/${tabla}?select=titulo,materia,descripcion,universidad,contenido_texto&universidad=eq.${encodeURIComponent(
      universidad
    )}&limit=12`;
    const r = await fetch(u, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

function resumenAreas(areaResults) {
  const entries = Object.entries(areaResults || {});
  if (!entries.length) return "Sin desglose por áreas.";
  return entries
    .map(([area, d]) => `- ${area}: ${d.correct || 0} correctas, ${d.wrong || 0} erradas, ${d.blank || 0} en blanco, ${Number(d.puntos || 0).toFixed(2)} pts`)
    .join("\n");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const estudiante = body.estudiante || {};
  const resultado = body.resultado || {};
  const universidad = estudiante.universidad || "UNI";

  if (!resultado || typeof resultado.nota === "undefined") {
    return res.status(400).json({ error: "Falta resultado.nota (envía el resultado del simulacro)" });
  }

  const API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "API key not configured" });

  // 1) Contexto real: materiales de SU universidad en Supabase
  const [mats, exas, tems] = await Promise.all([
    tablaPublica("materiales_referencia", universidad),
    tablaPublica("examenes", universidad),
    tablaPublica("temarios", universidad),
  ]);
  const ctxParts = [];
  mats.slice(0, 8).forEach((m) =>
    ctxParts.push(`MATERIAL: ${m.titulo} [${m.materia}]\n${(m.descripcion || "").slice(0, 400)}\n${(m.contenido_texto || "").slice(0, 1200)}`)
  );
  exas.slice(0, 8).forEach((e) =>
    ctxParts.push(`EXAMEN: ${e.titulo} [${e.materia}]\n${(e.descripcion || "").slice(0, 400)}\n${(e.contenido_texto || "").slice(0, 1200)}`)
  );
  tems.slice(0, 6).forEach((t) =>
    ctxParts.push(`TEMARIO: ${t.titulo}\n${String(t.contenido_texto || t.contenido || "").slice(0, 1200)}`)
  );
  const contextoMaterial = ctxParts.join("\n\n---\n\n").slice(0, 12000) || "Sin materiales registrados aún para esta universidad.";

  const nivel =
    resultado.nota >= 14 ? "avanzado (a punto de ingresar, afinar y ganar velocidad)" : resultado.nota >= 11 ? "intermedio (base existente, cerrar brechas)" : "inicial (construir base + técnica de examen)";

  const systemPrompt = `Eres el tutor personal de Área 52 UNI, experto en admisión universitaria peruana (${universidad}).
Generas GUÍAS DE APRENDIZAJE PERSONALIZADAS de 4 semanas, concretas y accionables, en español, usando SOLO el material real disponible como referencia bibliográfica.
Nunca inventes enlaces. Si hay poco material, indica qué tipo de examen/tema practicar con lo que SÍ existe.`;

  const userPrompt = `Estudiante: ${estudiante.nombre || "Estudiante"} — Universidad objetivo: ${universidad} — Nivel: ${nivel}.
Resultado del simulacro "${resultado.simulacro_titulo || "Simulacro"}": nota ${resultado.nota}/20, puntaje ${resultado.puntaje} pts, ${resultado.porcentaje}% , tiempo ${Math.round((resultado.tiempo_segundos || 0) / 60)} min.
Desglose por áreas:
${resumenAreas(resultado.area_results)}

MATERIAL REAL DISPONIBLE (cita estos títulos en la guía, no inventes otros):
${contextoMaterial}

Devuelve JSON VÁLIDO (sin markdown, sin backticks) con esta forma exacta:
{
  "diagnostico": "2-3 frases: fortalezas, debilidad crítica y causa probable",
  "focos": ["foco 1 (área-subtema)", "foco 2", "foco 3"],
  "plan_4_semanas": [
    {"semana": 1, "objetivo": "...", "tareas": ["tarea Lun", "tarea Mie", "tarea Vie"], "material": "título real del material a usar", "meta": "meta medible"}
  ],
  "tecnica_examen": ["tip 1", "tip 2", "tip 3"],
  "guia_markdown": "Guía completa en markdown con títulos: # Tu guía personalizada ${universidad}, ## Diagnóstico, ## Tus 3 focos, ## Plan 4 semanas (tabla por día), ## Qué practicar con cada material, ## Checklist semanal, ## Próximo simulacro"
}`;

  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 6000,
        temperature: 0.7,
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "Error from AI service" });
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || "";
    let parsed = null;
    try {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {}
    const guia = parsed || { diagnostico: "", focos: [], plan_4_semanas: [], tecnica_examen: [], guia_markdown: content };

    // Guardado opcional en Supabase (requiere SERVICE_KEY en servidor)
    let guiaId = null;
    if (body.save === true && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && estudiante.email) {
      try {
        const rr = await fetch(`${process.env.SUPABASE_URL}/rest/v1/guias_personalizadas`, {
          method: "POST",
          headers: {
            apikey: process.env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            estudiante_email: estudiante.email,
            nombre_completo: estudiante.nombre || "",
            whatsapp: estudiante.whatsapp || "",
            universidad,
            simulacro_id: resultado.simulacro_id || null,
            nota: resultado.nota,
            puntaje: resultado.puntaje || 0,
            area_results: resultado.area_results || {},
            diagnostico: guia.diagnostico || "",
            focos: guia.focos || [],
            plan: guia.plan_4_semanas || [],
            guia_markdown: guia.guia_markdown || "",
          }),
        });
        if (rr.ok) {
          const rows = await rr.json().catch(() => []);
          guiaId = rows?.[0]?.id || null;
        }
      } catch {}
    }

    return res.status(200).json({ universidad, ...guia, guia_id: guiaId });
  } catch (e) {
    console.error("generate-guide error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
};
