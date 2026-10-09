// ============================================================
// API: POST /api/tutor
// Tutor adaptativo por universidad: ajusta su método de enseñanza
// al nivel real de cada estudiante (nota, áreas débiles, errores
// frecuentes, focos de su guía) y enseña con el material real de
// su universidad (temarios + banco de preguntas).
// Body: {
//   estudiante_email?, nombre?, universidad?,
//   modo?: "explicar" | "practicar" | "socratico" | "errores",
//   tema?: string, mensaje: string, historial?: [{role, content}]
// }
// ============================================================

const SB_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SB_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";
const H = { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` };

async function getJSON(url) {
  try {
    const r = await fetch(url, { headers: H });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

function palabrasClave(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length > 3)
    .slice(0, 12);
}

// Perfil del estudiante: nivel + áreas débiles + errores + focos
async function perfilEstudiante(email, universidad) {
  const perfil = { hay_datos: false, promedio: null, mejor: null, n_simulacros: 0, debiles: [], errores_top: [], focos: [], diagnostico: "" };
  if (!email || email === "anonimo") return perfil;
  try {
    const subs = await getJSON(
      `${SB_URL}/rest/v1/simulacro_submissions?estudiante_email=eq.${encodeURIComponent(email)}&select=nota,area_results,fecha_fin&order=fecha_fin.desc&limit=8`
    );
    if (subs.length) {
      perfil.hay_datos = true;
      perfil.n_simulacros = subs.length;
      const notas = subs.map((s) => Number(s.nota || 0));
      perfil.promedio = notas.reduce((a, b) => a + b, 0) / notas.length;
      perfil.mejor = Math.max(...notas);
      const agg = {};
      subs.forEach((s) => {
        for (const [a, d] of Object.entries(s.area_results || {})) {
          agg[a] = agg[a] || { c: 0, t: 0 };
          agg[a].c += d.correct || 0;
          agg[a].t += (d.correct || 0) + (d.wrong || 0) + (d.blank || 0);
        }
      });
      perfil.debiles = Object.entries(agg)
        .map(([a, d]) => ({ area: a, pct: d.t ? Math.round((d.c / d.t) * 100) : 0 }))
        .sort((x, y) => x.pct - y.pct)
        .slice(0, 3);
    }
    const vistas = await getJSON(
      `${SB_URL}/rest/v1/pregunta_vistas?estudiante_email=eq.${encodeURIComponent(email)}&select=pregunta_id&limit=200`
    );
    if (vistas.length) {
      const ids = [...new Set(vistas.map((v) => v.pregunta_id).filter(Boolean))].slice(0, 200);
      if (ids.length) {
        const b = await getJSON(`${SB_URL}/rest/v1/banco_preguntas?id=in.(${ids.join(",")})&select=subtema&limit=200`);
        const cnt = {};
        b.forEach((x) => { if (x.subtema) cnt[x.subtema] = (cnt[x.subtema] || 0) + 1; });
        perfil.errores_top = Object.entries(cnt).sort((x, y) => y[1] - x[1]).slice(0, 5).map((x) => x[0]);
      }
    }
    const guias = await getJSON(
      `${SB_URL}/rest/v1/guias_personalizadas?estudiante_email=eq.${encodeURIComponent(email)}&select=diagnostico,focos&order=created_at.desc&limit=1`
    );
    if (guias.length) {
      perfil.diagnostico = (guias[0].diagnostico || "").slice(0, 300);
      perfil.focos = guias[0].focos || [];
    }
  } catch {}
  return perfil;
}

// Contexto de material real relacionado al tema
async function contextoMaterial(universidad, tema) {
  const keys = palabrasClave(tema);
  const partes = [];
  try {
    const tems = await getJSON(
      `${SB_URL}/rest/v1/temarios?universidad=eq.${encodeURIComponent(universidad)}&select=titulo,contenido&limit=6`
    );
    tems.forEach((t) => {
      const txt = String(t.contenido || "");
      const rel = !keys.length || keys.some((k) => txt.toLowerCase().includes(k));
      if (rel) partes.push(`TEMARIO ${t.titulo}:\n${txt.slice(0, 1500)}`);
    });
    const bco = await getJSON(
      `${SB_URL}/rest/v1/banco_preguntas?universidad=eq.${encodeURIComponent(universidad)}&select=texto,explicacion,subtema&limit=40`
    );
    let n = 0;
    for (const b of bco) {
      if (n >= 4) break;
      const txt = `${b.texto} ${b.explicacion || ""} ${b.subtema || ""}`.toLowerCase();
      if (!keys.length || keys.some((k) => txt.includes(k))) {
        partes.push(`PREGUNTA TIPO (subtema ${b.subtema || "?"}): ${b.texto}\nExplicación: ${b.explicacion || "-"}`);
        n++;
      }
    }
  } catch {}
  return partes.join("\n\n---\n\n").slice(0, 4500);
}

const MODOS = {
  explicar: "EXPLICAR: enseña el tema desde cero con un ejemplo resuelto paso a paso y cierra con 1 pregunta de comprobación.",
  practicar: "PRACTICAR: plantea 3 ejercicios graduados (fácil→examen real). Da el primero, espera su respuesta, corrige y recién avanza al siguiente.",
  socratico: "SOCRÁTICO: no des la respuesta directa; guía con preguntas cortas hasta que el estudiante la descubra. Si se atasca 2 veces, da una pista y luego explica.",
  errores: "REPASO DE ERRORES: el estudiante falla mucho estos subtemas. Re-enseña cada uno con un ejemplo nuevo y distinto al del examen, verifica con 1 pregunta.",
};

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { mensaje, historial } = body;
  if (!mensaje || !String(mensaje).trim()) return res.status(400).json({ error: "Falta mensaje" });

  const API_KEY = process.env.DEEPSEEK_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "API key not configured" });

  const email = (body.estudiante_email || "").trim() || "anonimo";
  const nombre = (body.nombre || "").trim() || "Estudiante";
  const universidad = (body.universidad || "UNI").trim() || "UNI";
  const modo = MODOS[body.modo] ? body.modo : "explicar";
  const tema = (body.tema || "").trim();

  const [perfil, material] = await Promise.all([perfilEstudiante(email, universidad), contextoMaterial(universidad, tema || mensaje)]);

  const nivel =
    !perfil.hay_datos || perfil.promedio === null
      ? "desconocido (primera sesión: haz 1 pregunta diagnóstica antes de enseñar)"
      : perfil.promedio >= 14
        ? `avanzado (promedio ${perfil.promedio.toFixed(1)}/20: ve al grano, nivel examen real, enfoca en velocidad y trampas)`
        : perfil.promedio >= 11
          ? `intermedio (promedio ${perfil.promedio.toFixed(1)}/20: combina base + práctica de examen)`
          : `inicial (promedio ${perfil.promedio.toFixed(1)}/20: explica desde cero, paso a paso, sin asumir nada, con ánimo)`;

  const systemPrompt = `Eres el Tutor 52, profesor particular de ${nombre} para el examen de admisión a ${universidad} (Perú).
NIVEL DEL ESTUDIANTE: ${nivel}.
${perfil.debiles.length ? `ÁREAS MÁS DÉBILES: ${perfil.debiles.map((d) => `${d.area} (${d.pct}% aciertos)`).join(", ")}.` : ""}
${perfil.errores_top.length ? `SUBTEMAS DONDE MÁS FALLA: ${perfil.errores_top.join(", ")}.` : ""}
${perfil.focos.length ? `FOCOS DE SU GUÍA: ${perfil.focos.join(" · ")}.` : ""}
${perfil.diagnostico ? `DIAGNÓSTICO PREVIO: ${perfil.diagnostico}` : ""}
MODO DE ENSEÑANZA DE ESTA SESIÓN: ${MODOS[modo]}
${tema ? `TEMA DE LA SESIÓN: ${tema}.` : ""}
MATERIAL REAL DE REFERENCIA (temario y preguntas tipo de ${universidad}; basa tus ejemplos en esto, no inventes temarios de otras universidades):
${material || "Sin material registrado aún: enseña con tu conocimiento del examen de admisión de " + universidad + "."}

REGLAS:
- Español claro, formato breve con pasos numerados y fórmulas en texto plano.
- Adapta la dificultad al nivel: si el estudiante responde bien 2 veces seguidas, sube el nivel; si falla 2 veces, baja y re-explica con otro ejemplo.
- Cada respuesta termina con UNA sola pregunta o acción siguiente (nunca un muro de texto pasivo).
- Si el tema no es del examen de ${universidad}, avísalo en 1 línea y redirige a lo que sí evalúan.`;

  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          ...((historial || []).slice(-10).filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)),
          { role: "user", content: String(mensaje).slice(0, 2000) },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "Error from AI service" });
    const data = await r.json();
    return res.status(200).json({
      respuesta: data.choices?.[0]?.message?.content || "No pude responder. Intenta de nuevo.",
      nivel,
      debiles: perfil.debiles,
    });
  } catch (e) {
    console.error("tutor error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
};
