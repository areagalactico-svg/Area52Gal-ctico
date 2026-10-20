// ============================================================
// API: POST /api/weekly-plan — PLAN DE ESTUDIO SEMANAL DINÁMICO
// Body: {
//   estudiante_email?, nombre?, universidad?,
//   areas?: [{ area, pct }],        // nivel por área (de peor a mejor)
//   errores_top?: [],               // subtemas con más errores
//   dias_faltan?: number,           // días para el próximo examen
//   fecha_examen?: "YYYY-MM-DD",
//   racha?: number, sesiones_semana?: number,
//   fecha_inicio_semana?: "YYYY-MM-DD"  (default: lunes de esta semana)
// }
// Genera un plan lunes→domingo priorizando: frecuencia en el examen ×
// debilidad del estudiante, con repaso espaciado (día 1/3/7) y carga
// ajustada a la cercanía del examen. Se guarda en planes_semanales.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || null;

function lunesDeEstaSemana() {
  const d = new Date();
  const dia = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dia);
  return d.toISOString().slice(0, 10);
}

async function guardarPlan(fila) {
  const key = SUPABASE_SERVICE || SUPABASE_ANON;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/planes_semanales`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(fila),
    });
  } catch {} // tabla aún no creada → no rompe la respuesta
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "API key not configured" });

  const email = (body.estudiante_email || "").trim() || "anonimo";
  const nombre = (body.nombre || "").trim() || "Estudiante";
  const universidad = (body.universidad || "UNI").trim() || "UNI";
  const areas = Array.isArray(body.areas) ? body.areas.filter((a) => a && a.area).slice(0, 8) : [];
  const erroresTop = Array.isArray(body.errores_top) ? body.errores_top.filter(Boolean).slice(0, 8) : [];
  const diasFaltan = Number.isFinite(Number(body.dias_faltan)) ? Math.max(0, Math.round(Number(body.dias_faltan))) : null;
  const fechaExamen = body.fecha_examen ? String(body.fecha_examen).slice(0, 10) : "";
  const racha = Number(body.racha) || 0;
  const sesiones = Number(body.sesiones_semana) || 0;
  const semana = body.fecha_inicio_semana ? String(body.fecha_inicio_semana).slice(0, 10) : lunesDeEstaSemana();

  const systemPrompt = `Eres el planificador académico del preuniversitario Área 52, experto en preparación para el examen de ingreso de universidades peruanas.
Tu tarea: crear un PLAN DE ESTUDIO SEMANAL (lunes a domingo) realista y personalizado para ${nombre}, postulante a ${universidad}.

DATOS DEL ESTUDIANTE:
${areas.length ? `NIVEL POR ÁREA (de menor a mayor % de aciertos):\n${areas.map((a) => `- ${a.area}: ${a.pct}%`).join("\n")}` : "Sin datos de nivel por área aún (empieza con un diagnóstico general)."}
${erroresTop.length ? `SUBTEMAS CON MÁS ERRORES: ${erroresTop.join(", ")}` : ""}
${diasFaltan !== null ? `FALTAN ${diasFaltan} DÍAS PARA EL EXAMEN${fechaExamen ? ` (${fechaExamen})` : ""}` : "SIN FECHA DE EXAMEN CONFIRMADA (plan de ritmo sostenido)"}
Racha actual: ${racha} día(s) · Sesiones esta semana: ${sesiones} de 7

REGLAS:
- Prioriza: 1) frecuencia del tema en el examen de admisión de ${universidad}, 2) debilidad del estudiante (menor % primero).
- Cada día indica: tema, acción concreta (ej. "15 preguntas cronometradas", "sesión con el Tutor IA", "repaso de cuaderno de errores") y minutos estimados. Total diario 60-120 min según cercanía al examen.
- Incluye REPASO ESPACIADO: los errores se repasan al día 1, 3 y 7 de aparecer.
- Incluye 2 simulacros cronometrados por semana (si faltan <30 días, 3).
- Un día de descanso activo (repaso ligero, máx 40 min).
- Si faltan pocos días (<14), concentra en simulacros + corrección de errores, no temas nuevos largos.
- Si sobra tiempo (>60 días), dedica bloques a cerrar áreas débiles desde cero con el tutor.
- Cierra el plan con "META DE LA SEMANA" medible (ej. "subir Matemática de 42% a 55%").

FORMATO MARKDOWN (sin HTML, sin backticks):`;
  const userMsg = `Planifica la semana (lunes a domingo) para ${nombre} — universidad objetivo: ${universidad}.
Usa exactamente este formato:

## Lunes
- **Tema**: ... · **Acción**: ... · **45 min**

... (Martes → Domingo)

## Meta de la semana
- ...`;

  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
        max_tokens: 2500,
        temperature: 0.6,
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "Error from AI service" });
    const data = await r.json();
    const plan = (data.choices?.[0]?.message?.content || "").trim();
    if (!plan) return res.status(502).json({ error: "Respuesta vacía de la IA" });

    if (email !== "anonimo") {
      await guardarPlan({
        estudiante_email: email,
        universidad,
        semana_inicio: semana,
        plan_markdown: plan.slice(0, 12000),
        areas_snapshot: areas,
        dias_faltan: diasFaltan,
      });
    }

    return res.status(200).json({ plan_markdown: plan, semana_inicio: semana });
  } catch (e) {
    console.error("weekly-plan error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
};
