const crypto = require("crypto");

// ---------- Anti-repetición: normalización + hash ----------
function normalizarTexto(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sin tildes
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashPregunta(textoNorm, opciones) {
  const base = textoNorm + "|" + (opciones || []).map((o) => normalizarTexto(o)).sort().join("|");
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 32);
}

// Quita duplicados dentro del propio lote (exactos por hash)
function dedupLote(preguntas) {
  const vistos = new Set();
  const unicas = [];
  let duplicadas = 0;
  for (const p of preguntas || []) {
    if (!p || !p.texto) continue;
    const norm = normalizarTexto(p.texto);
    if (norm.length < 10) continue;
    const h = hashPregunta(norm, p.opciones);
    if (vistos.has(h)) { duplicadas++; continue; }
    vistos.add(h);
    p._norm = norm;
    p._hash = h;
    unicas.push(p);
  }
  return { unicas, duplicadas };
}

const SB_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SB_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";
const SB_SERVICE = process.env.SUPABASE_SERVICE_KEY || null;

function sbHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

// Textos ya vistos por el estudiante (para excluirlos de la generación)
async function textosVistosPorEstudiante(email, universidad) {
  if (!email || email === "anonimo") return [];
  try {
    const r1 = await fetch(
      `${SB_URL}/rest/v1/pregunta_vistas?estudiante_email=eq.${encodeURIComponent(email)}&select=pregunta_id&limit=300`,
      { headers: sbHeaders(SB_ANON) }
    );
    if (!r1.ok) return [];
    const vistas = await r1.json();
    const ids = (vistas || []).map((v) => v.pregunta_id).filter(Boolean).slice(0, 300);
    if (!ids.length) return [];
    const r2 = await fetch(
      `${SB_URL}/rest/v1/banco_preguntas?universidad=eq.${encodeURIComponent(universidad)}&id=in.(${ids.join(",")})&select=texto&limit=300`,
      { headers: sbHeaders(SB_ANON) }
    );
    if (!r2.ok) return [];
    return (await r2.json()).map((b) => b.texto).filter(Boolean);
  } catch {
    return [];
  }
}

// Filtra candidatas contra el banco (exacto por hash + semántico por RPC)
async function filtrarContraBanco(candidatas, universidad) {
  const stats = { exactas: 0, similares: 0 };
  let restantes = [...candidatas];
  try {
    // 1) Exactas: traer hashes existentes de la universidad
    const rh = await fetch(
      `${SB_URL}/rest/v1/banco_preguntas?universidad=eq.${encodeURIComponent(universidad)}&select=hash&limit=10000`,
      { headers: sbHeaders(SB_ANON) }
    );
    if (rh.ok) {
      const existentes = new Set((await rh.json()).map((b) => b.hash));
      restantes = restantes.filter((p) => {
        if (existentes.has(p._hash)) { stats.exactas++; return false; }
        return true;
      });
    }
    // 2) Semánticas: RPC con pg_trgm (paralelo en bloques)
    const UMBRAL = 0.85;
    const bloques = [];
    for (let i = 0; i < restantes.length; i += 8) bloques.push(restantes.slice(i, i + 8));
    const aprobadas = [];
    for (const b of bloques) {
      // eslint-disable-next-line no-await-in-loop
      const res = await Promise.all(
        b.map(async (p) => {
          try {
            const rr = await fetch(`${SB_URL}/rest/v1/rpc/buscar_preguntas_similares`, {
              method: "POST",
              headers: sbHeaders(SB_ANON),
              body: JSON.stringify({ p_universidad: universidad, p_texto: p._norm, p_umbral: UMBRAL }),
            });
            if (!rr.ok) return { p, ok: true };
            const m = await rr.json();
            return { p, ok: !m || m.length === 0 };
          } catch {
            return { p, ok: true };
          }
        })
      );
      res.forEach((r) => (r.ok ? aprobadas.push(r.p) : stats.similares++));
    }
    restantes = aprobadas;
  } catch {
    // Sin banco disponible: devolver candidatas tal cual
  }
  return { restantes, stats };
}

// Guarda las nuevas en el banco (solo con service key)
async function guardarEnBanco(preguntas, universidad) {
  if (!SB_SERVICE || !preguntas.length) return {};
  try {
    const filas = preguntas.map((p) => ({
      universidad,
      area: p.area || "",
      subtema: p.subtema || "",
      materia: p.subtema || p.area || "General",
      texto: p.texto,
      texto_norm: p._norm,
      hash: p._hash,
      opciones: p.opciones || [],
      respuesta_correcta: p.respuestaCorrecta || 0,
      explicacion: p.explicacion || "",
      origen: "ia",
    }));
    const rr = await fetch(`${SB_URL}/rest/v1/banco_preguntas`, {
      method: "POST",
      headers: { ...sbHeaders(SB_SERVICE), Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify(filas),
    });
    if (!rr.ok) return {};
    const rows = await rr.json().catch(() => []);
    const mapa = {};
    (rows || []).forEach((r) => { mapa[r.hash] = r.id; });
    return mapa;
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, type, count, context, universidad, exclude_texts, estudiante_email } = req.body;
  const UNI = universidad || "UNI";

  if (!topic || !type) {
    return res.status(400).json({ error: 'Topic and type are required' });
  }

  const API_KEY = process.env.DEEPSEEK_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const numQuestions = Math.min(Math.max(count || 5, 1), 20);

  const contextSection = context
    ? `\n\nCONTEXTO DE MATERIALES DE REFERENCIA (usa estos temas como guía para crear preguntas similares):\n${context}`
    : '';

  let systemPrompt = '';
  let config = { count: numQuestions, prompt: '' };

  if (type === 'simulacro') {
    const topicConfigs = {
      'Examen Completo IEN': {
        count: 65,
        prompt: `Genera un EXAMEN COMPLETO del IEN UNI con 65 preguntas distribuidas EXACTAMENTE así:
- Parte I: Aptitud Académica (35 preguntas) → usar area="PE1"
  * Razonamiento Matemático (12): sucesiones, figuras, conteo, lógica
  * Razonamiento Verbal (13): comprensión lectora, analogías, ortografía
  * Humanidades (10): Comunicación, Historia, Geografía, Economía, Filosofía, Ambiente
- Parte II: Conocimientos (30 preguntas) → usar area="PE2" para Mat/Fís/Quím, area="PE3" para Humanidades
  * Matemática (10): Aritmética (3), Álgebra (4), Geometría (3)
  * Física (7): Cinemática, dinámica, electricidad, ondas, óptica
  * Química (7): Estructura atómica, enlaces, estequiometría, reacciones
  * Humanidades y Cultura General (6): Literatura, Historia, Geografía
Cada pregunta debe incluir "area" (PE1/PE2/PE3) y "subtema".`
      },
      'PE1 - Aptitud Académica y Humanidades': {
        count: 35,
        prompt: `Genera la PE1 del IEN UNI - Aptitud Académica y Humanidades (35 preguntas):
- Razonamiento Matemático (12 preguntas): Sucesiones numéricas, análisis de figuras, conteo, lógica proposicional, juegos lógicos
- Razonamiento Verbal (13 preguntas): Comprensión lectora, analogías verbales, significado de palabras en contexto, ortografía
- Humanidades (10 preguntas): Comunicación, Lengua, Literatura, Historia del Perú y del Mundo, Geografía, Economía, Filosofía, Lógica, Ambiente
Cada pregunta debe incluir "area" y "subtema".`
      },
      'PE2 - Matemática': {
        count: 13,
        prompt: `Genera la PE2 del IEN UNI - Matemática (13 preguntas):
- Aritmética (3): Divisibilidad, MCM/MCD, porcentajes, razones, proporciones, números primos
- Álgebra (4): Ecuaciones, sistemas de ecuaciones, desigualdades, funciones, expresiones algebraicas
- Geometría (3): Triángulos, circunferencia, áreas, perímetros, semejanza, polígonos
- Trigonometría (3): Razones trigonométricas, identidades, ecuaciones trigonométricas, aplicación a triángulos
Cada pregunta debe incluir "area" y "subtema".`
      },
      'PE3 - Física y Química': {
        count: 17,
        prompt: `Genera la PE3 del IEN UNI - Física y Química (17 preguntas):
- Física (7): Cinemática, dinámica, trabajo y energía, estática, hidrostática, termodinámica, electricidad, magnetismo, ondas, óptica, física moderna
- Química (7): Estructura atómica, tabla periódica, enlaces químicos, estequiometría, reacciones químicas, química orgánica básica
- Humanidades y Cultura General (4): Literatura, Historia del Perú, Geografía, Economía
Cada pregunta debe incluir "area" y "subtema".`
      },
      'Razonamiento Matemático': { count: 12, prompt: `Genera 12 preguntas de Razonamiento Matemático del IEN UNI: sucesiones numéricas, análisis de figuras (series, analogías, distribución en filas y columnas, figuras discordantes), análisis de sólidos (vistas, despliegues), conteo de figuras geométricas, conteo de rutas, conteo de cubos, lógica proposicional, inferencias, juegos lógicos.` },
      'Razonamiento Verbal': { count: 13, prompt: `Genera 13 preguntas de Razonamiento Verbal del IEN UNI: comprensión lectora (textos argumentativos, narrativos, expositivos), analogías verbales, significado de palabras en contexto, relaciones semánticas, ortografía, reglas de acentuación.` },
      'Humanidades': { count: 8, prompt: `Genera 8 preguntas de Humanidades del IEN UNI: Comunicación, Lengua, Literatura, Historia del Perú y del Mundo, Geografía, Economía, Filosofía, Lógica, Ambiente.` },
      'Matemática': { count: 13, prompt: `Genera 13 preguntas de Matemática del IEN UNI: Aritmética (divisibilidad, MCM/MCD, porcentajes, razones), Álgebra (ecuaciones, sistemas, desigualdades, funciones), Geometría (triángulos, circunferencia, áreas, semejanza), Trigonometría (razones, identidades, aplicaciones).` },
      'Física': { count: 7, prompt: `Genera 7 preguntas de Física del IEN UNI: Cinemática, dinámica, trabajo y energía, estática, hidrostática, termodinámica, electricidad, magnetismo, ondas, óptica, física moderna.` },
      'Química': { count: 7, prompt: `Genera 7 preguntas de Química del IEN UNI: Estructura atómica, tabla periódica, enlaces químicos, estequiometría, reacciones químicas, química orgánica básica.` }
    };

    config = topicConfigs[topic] || { count: numQuestions, prompt: `Genera ${numQuestions} preguntas sobre: ${topic}` };

    systemPrompt = `Eres un experto creador de exámenes de admisión para la Universidad Nacional de Ingeniería (UNI) de Perú. Conoces perfectamente la estructura, nivel y estilo del Examen de Ingreso Escolar Nacional (IEN).

IMPORTANTE: El administrador ha subido un ARCHIVO/GUÍA del examen IEN. Este archivo es tu FUENTE PRINCIPAL de referencia. Debes:
1. EXTRAER preguntas del estilo y nivel del contenido proporcionado
2. GENERAR nuevas preguntas siguiendo el MISMO ESTILO, NIVEL DE DIFICULTAD y ESTRUCTURA del examen real
3. Mantener la proporción: Parte I (35 preguntas Aptitud Académica) + Parte II (30 preguntas Conocimientos)
4. Usar 5 opciones (A-E) como el examen real IEN
5. Los problemas matemáticos deben tener datos numéricos concretos
6. Los textos de razonamiento verbal deben ser argumentativos/narrativos como el examen real

CONTENIDO/GUÍA DEL EXAMEN IEN (proporcionado por el administrador):
${context || 'No hay contenido de guía disponible. Genera preguntas basándote en tu conocimiento del examen IEN UNI de nivel 5to de secundaria.'}

FORMATO JSON VÁLIDO (sin markdown, sin backticks):
{
  "preguntas": [
    {
      "texto": "Texto de la pregunta",
      "opciones": ["A) Opción 1", "B) Opción 2", "C) Opción 3", "D) Opción 4", "E) Opción 5"],
      "respuestaCorrecta": 0,
      "area": "PE1/PE2/PE3",
      "subtema": "Subtema específico",
      "explicacion": "Breve explicación"
    }
  ]
}

ESTRUCTURA DEL EXAMEN IEN (65 preguntas total, 3 horas):
- Parte I: Aptitud Académica (35 preguntas) → area="PE1"
  * Razonamiento Matemático (12): sucesiones, figuras, conteo, lógica
  * Razonamiento Verbal (13): comprensión lectora, analogías, ortografía
  * Humanidades (10): Comunicación, Historia, Geografía, Economía, Filosofía
- Parte II: Conocimientos (30 preguntas) → area="PE2" o "PE3"
  * Matemática (10): Aritmética (3), Álgebra (4), Geometría (3)
  * Física (7): Cinemática, dinámica, electricidad, ondas, óptica
  * Química (7): Estructura atómica, enlaces, estequiometría, reacciones
  * Humanidades y Cultura General (6): Literatura, Historia, Geografía

REGLAS:
- Nivel: Estudiantes de 5to de secundaria (16-18 años) - EXÁMENES DE ALTA DIFICULTAD tipo concurso de admisión UNI
- El examen IEN usa 5 opciones (A-E)
- respuestaCorrecta es el índice (0-4) de la opción correcta
- Incluye "area" (PE1, PE2 o PE3) y "subtema" en cada pregunta
- DIFICULTAD ALTA: 0% fáciles, 30% medias, 70% difíciles/muy difíciles
- Las preguntas deben requerir razonamiento profundo, análisis de múltiples pasos y conocimiento especializado
- Incluye preguntas trampa: opciones distractores plausibles que confundan al no dominar el tema
- Evita preguntas de memoria directa; prioriza aplicación, análisis y síntesis
- SI HAY GUÍA DEL ADMINISTRADOR: usa el estilo y nivel de dificultad como referencia
- NO repitas conceptos entre preguntas`;
  } else {
    config = { count: numQuestions, prompt: '' };
    systemPrompt = `Eres un psicólogo vocacional experto en evaluación psicométrica. Genera un test vocacional basado en los criterios de evaluación más importantes del mundo.

FRAMEWORKS A USAR:
1. HOLLAND RIASEC: Realista (R), Investigativo (I), Artístico (A), Social (S), Emprendedor (E), Convencional (C)
2. BIG FIVE (OCEAN): Apertura (O), Responsabilidad (C), Extraversión (E), Amabilidad (A), Neuroticismo (N)
3. MÚLTIPLES INTELIGENCIAS DE GARDNER: Lingüística, Lógico-matemática, Espacial, Musical, Corporal-kinestésica, Interpersonal, Intrapersonal, Naturalista
4. APTITUDES COGNITIVAS: Razonamiento verbal, numérico, espacial, abstracto
5. VALORES PROFESIONALES (SCHWARTZ): Autonomía, logro, poder, benevolencia, universalismo, seguridad, tradición, estimación

Genera exactamente ${numQuestions} preguntas de opción múltiple sobre: ${topic}

FORMATO JSON VÁLIDO (sin markdown, sin backticks):
{
  "preguntas": [
    {
      "texto": "¿Qué actividad disfrutas más en tu tiempo libre?",
      "opciones": ["Resolver problemas lógicos o acertijos", "Crear arte, música o escribir", "Ayudar a otros y trabajar en equipo", "Organizar eventos o liderar grupos"],
      "respuestaCorrecta": 0,
      "area": "Holland RIASEC",
      "dimension": "Investigativo vs Artístico vs Social vs Emprendedor"
    }
  ]
}

REGLAS:
- Cada pregunta evalúa un framework psicométrico conocido
- El campo "area" indica qué framework evalúa (Holland, Big Five, Gardner, Aptitudes, Valores)
- El campo "dimension" indica las dimensiones específicas que contrasta
- Las opciones deben ser conductas observables, no opiniones
- NO hay respuestas "correctas" o "incorrectas" — cada opción revela un perfil
- Incluye preguntas situacionales (¿qué harías en esta situación?)
- Incluye preguntas de preferencia (¿qué prefieres hacer?)
- Incluye preguntas de autoevaluación (¿qué tan hábil te consideras?)
- Varía los frameworks para cubrir múltiples dimensiones de la personalidad`;
  }

  // --- Exclusión: preguntas que NO deben repetirse ni reescribirse ---
  const vistos = await textosVistosPorEstudiante(estudiante_email, UNI);
  const prohibidas = [...(exclude_texts || []), ...vistos]
    .filter(Boolean)
    .map((t) => String(t).slice(0, 150))
    .slice(0, 40);
  const exclusionBlock = prohibidas.length
    ? `\n\nPREGUNTAS PROHIBIDAS (ya existen o el estudiante ya las vio — NO las repitas NI las reescribas con otras palabras, crea preguntas de OTROS subtemas o enfoques):\n${prohibidas.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    : "";

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera las ${config.count || numQuestions} preguntas del "${topic}" para el examen IEN de la UNI. ${context ? 'IMPORTANTE: Usa los materiales de referencia del administrador como guía para el estilo, dificultad y tipo de preguntas.' : ''}${exclusionBlock}` }
        ],
        max_tokens: 32768,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('DeepSeek error:', response.status, errorData);
      return res.status(502).json({ error: 'Error from AI service' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(502).json({ error: 'Invalid response format from AI' });
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('JSON parse error:', e);
      return res.status(502).json({ error: 'Could not parse AI response' });
    }

    if (!parsed.preguntas || !Array.isArray(parsed.preguntas)) {
      return res.status(502).json({ error: 'Invalid question format from AI' });
    }

    // --- Anti-repetición: dedup en lote + filtro contra el banco ---
    const solicitadas = config.count || numQuestions;
    const { unicas, duplicadas } = dedupLote(parsed.preguntas);
    const { restantes, stats } = await filtrarContraBanco(unicas, UNI);
    const mapaIds = await guardarEnBanco(restantes, UNI);
    const preguntas = restantes.map((p) => {
      const out = { ...p };
      if (mapaIds[p._hash]) out.banco_id = mapaIds[p._hash];
      delete out._norm;
      delete out._hash;
      return out;
    });

    return res.status(200).json({
      preguntas,
      meta: {
        solicitadas,
        devueltas_ia: (parsed.preguntas || []).length,
        duplicadas_en_lote: duplicadas,
        duplicadas_exactas_banco: stats.exactas,
        duplicadas_similares_banco: stats.similares,
        entregadas: preguntas.length,
        nuevas_en_banco: Object.keys(mapaIds).length,
      },
    });
  } catch (error) {
    console.error('Generate questions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
