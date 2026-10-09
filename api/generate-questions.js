// ============================================================
// API: POST /api/generate-questions — con SISTEMA ANTI-REPETICIÓN
// Body: { topic, type, count, context, universidad?, exclude_textos?[] }
// - type "simulacro": cada pregunta generada se compara contra el
//   BANCO (tabla banco_preguntas) y contra exclude_textos (preguntas
//   que el estudiante ya vio). Se descartan hashes iguales y textos
//   con similitud >= 0.85. Si faltan, se reintenta 1 vez con la
//   lista de exclusión en el prompt. Las nuevas se guardan en el banco.
// - Otros types (vocacional): solo deduplicación dentro del lote.
// ============================================================
const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || null;

const UMBRAL_SIMILITUD = 0.85;
const MAX_INTENTOS = 2;

// Normalización canónica (EL CLIENTE USA LA MISMA REGLA para vistas)
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

// Huella de opciones (detecta reescrituras: mismo examen, otras palabras)
function hashOpciones(opciones) {
  const opts = (opciones || []).map((o) => normalizarTexto(o)).sort().join("|");
  if (!opts.replace(/\|/g, "")) return "";
  return crypto.createHash("sha256").update(opts).digest("hex").slice(0, 32);
}

// Números que definen la pregunta ("12,18") — dos preguntas con mismos
// números y mismas opciones son la misma pregunta aunque cambie el texto
function numerosDe(textoNorm) {
  const nums = (textoNorm.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(",", "."));
  return Array.from(new Set(nums)).sort().join(",");
}

function trigramas(s) {
  const t = `  ${s} `;
  const set = new Set();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
}

// Coeficiente Dice sobre trigramas (≈ similarity() de pg_trgm)
function similitud(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (Math.min(a.length, b.length) / Math.max(a.length, b.length) < 0.5) return 0;
  const A = trigramas(a);
  const B = trigramas(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

async function cargarBanco(universidad) {
  const vacio = { hashes: new Set(), entradas: [], normas: [] };
  try {
    const u = `${SUPABASE_URL}/rest/v1/banco_preguntas?select=hash,texto_norm,opciones_hash,numeros&universidad=eq.${encodeURIComponent(universidad)}&limit=5000`;
    const r = await fetch(u, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
    if (!r.ok) return vacio; // tabla aún no creada → sin filtro (no rompe nada)
    const rows = await r.json();
    const entradas = (rows || []).filter((x) => x.texto_norm).map((x) => ({
      hash: x.hash,
      norm: x.texto_norm,
      set: trigramas(x.texto_norm || ""),
      optsHash: x.opciones_hash || "",
      nums: x.numeros || "",
    }));
    return {
      hashes: new Set(rows.map((x) => x.hash)),
      entradas,
      normas: entradas.map((e) => e.norm),
    };
  } catch {
    return vacio;
  }
}

// ¿La candidata duplica una entrada del banco?
// 1) hash idéntico · 2) texto ≥85% parecido ·
// 3) mismas opciones + mismos números (reescritura con otras palabras)
function esDuplicada(cand, entry) {
  if (cand.hash === entry.hash) return true;
  if (similitudConSet(cand.set, entry.set) >= UMBRAL_SIMILITUD) return true;
  if (cand.optsHash && cand.nums && cand.optsHash === entry.optsHash && cand.nums === entry.nums) return true;
  return false;
}

function similitudConSet(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return (2 * inter) / (setA.size + setB.size);
}

function esParecida(norm, setsBanco, refsExtra) {
  for (const ref of refsExtra) {
    if (similitud(norm, ref) >= UMBRAL_SIMILITUD) return true;
  }
  const setA = trigramas(norm);
  for (const setB of setsBanco) {
    if (similitudConSet(setA, setB) >= UMBRAL_SIMILITUD) return true;
  }
  return false;
}

// Filtra un lote de la IA. Devuelve { nuevas, repetidas }.
// nuevas lleva campos internos texto_norm/hash (se limpian al responder).
function filtrarLote(candidatas, banco, refsExtra) {
  const vistas = new Set();
  const nuevas = [];
  let repetidas = 0;
  for (const q of candidatas || []) {
    const norm = normalizarTexto(q.texto);
    if (!norm || norm.length < 10) { repetidas++; continue; }
    const cand = {
      norm,
      set: trigramas(norm),
      hash: hashPregunta(norm, q.opciones),
      optsHash: hashOpciones(q.opciones),
      nums: numerosDe(norm),
    };
    if (vistas.has(cand.hash) || banco.hashes.has(cand.hash)) { repetidas++; continue; }
    const refs = [...refsExtra, ...nuevas.map((n) => n.texto_norm)];
    if (esParecida(norm, banco.entradas.map((e) => e.set), refs)) { repetidas++; continue; }
    if (banco.entradas.some((e) => esDuplicada(cand, e))) { repetidas++; continue; }
    if (nuevas.some((n) => esDuplicada(cand, { hash: n.hash, set: trigramas(n.texto_norm), optsHash: n.optsHash, nums: n.nums }))) { repetidas++; continue; }
    vistas.add(cand.hash);
    banco.hashes.add(cand.hash); // evita duplicados entre intentos del mismo request
    const entry = { hash: cand.hash, norm, set: cand.set, optsHash: cand.optsHash, nums: cand.nums };
    banco.entradas.push(entry);
    nuevas.push({ ...q, texto_norm: norm, hash: cand.hash, optsHash: cand.optsHash, nums: cand.nums });
  }
  return { nuevas, repetidas };
}

// Auditoría anti-trampa: si la IA etiqueta "alta" una pregunta que por su
// forma es fácil (texto muy corto o sin pasos de resolución), se degrada a
// "media" para que las estadísticas sean honestas y dispare el refuerzo.
function auditarNivel(preguntas) {
  return (preguntas || []).map((q) => {
    const norm = normalizarTexto(q.texto);
    const pasos = Array.isArray(q.pasos) ? q.pasos.filter((p) => String(p).length > 8) : [];
    const sospechosa = norm.length < 90 || (pasos.length < 2 && norm.length < 140);
    if (sospechosa && (q.dificultad || "alta") === "alta") {
      return { ...q, dificultad: "media", _degradada: true };
    }
    return q;
  });
}

async function guardarBanco(universidad, nuevas) {
  if (!nuevas.length) return;
  const key = SUPABASE_SERVICE || SUPABASE_ANON;
  const filas = nuevas.map((q) => ({
    universidad,
    texto: String(q.texto).slice(0, 2000),
    texto_norm: q.texto_norm,
    hash: q.hash,
    opciones: q.opciones || [],
    respuesta_correcta: Number.isInteger(q.respuestaCorrecta) ? q.respuestaCorrecta : 0,
    opciones_hash: q.optsHash || "",
    numeros: q.nums || "",
    area: q.area || "",
    subtema: q.subtema || "",
    materia: q.subtema || q.area || "General",
    dificultad: q.dificultad === "media" ? "media" : "alta",
    explicacion: String(q.explicacion || "").slice(0, 1000),
  }));
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/banco_preguntas?on_conflict=hash`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(filas),
    });
  } catch {} // si falla el guardado, igual se devuelven las preguntas
}

async function llamarIA(API_KEY, systemPrompt, topic, n, context, exclusionStems) {
  const exclusion = exclusionStems.length
    ? `\n\nPREGUNTAS PROHIBIDAS (ya existen en el banco o el estudiante ya las vio — NO generes ninguna igual ni reescrita con otras palabras):\n${exclusionStems.map((s) => `- ${s}`).join("\n")}`
    : "";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Genera las ${n} preguntas del "${topic}" para el examen IEN de la UNI. ${context ? "IMPORTANTE: Usa los materiales de referencia del administrador como guía para el estilo, dificultad y tipo de preguntas." : ""}${exclusion}` },
      ],
      max_tokens: 32768,
      temperature: 0.9,
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.preguntas || !Array.isArray(parsed.preguntas)) return null;
    return parsed.preguntas;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { topic, type, count, context } = body;
  const universidad = (body.universidad || "UNI").trim() || "UNI";
  // Acepta ambos nombres de parámetro (compatibilidad de clientes)
  const _excl = body.exclude_textos || body.exclude_texts || [];
  const excludeNorms = _excl.map(normalizarTexto).filter((t) => t.length >= 10).slice(0, 200);

  // Memoria servidor: textos ya vistos por el estudiante (tabla pregunta_vistas, si existe)
  try {
    const _email = (body.estudiante_email || "").trim();
    if (_email && _email !== "anonimo" && type === "simulacro") {
      const r1 = await fetch(
        `${SUPABASE_URL}/rest/v1/pregunta_vistas?estudiante_email=eq.${encodeURIComponent(_email)}&select=pregunta_id&limit=300`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
      );
      if (r1.ok) {
        const _ids = ((await r1.json()) || []).map((v) => v.pregunta_id).filter(Boolean).slice(0, 300);
        if (_ids.length) {
          const r2 = await fetch(
            `${SUPABASE_URL}/rest/v1/banco_preguntas?universidad=eq.${encodeURIComponent(universidad)}&id=in.(${_ids.join(",")})&select=texto&limit=300`,
            { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
          );
          if (r2.ok) {
            for (const b of await r2.json()) {
              const n = normalizarTexto(b.texto);
              if (n.length >= 10 && excludeNorms.length < 260) excludeNorms.push(n);
            }
          }
        }
      }
    }
  } catch {} // tabla aún no creada → se ignora sin romper nada

  if (!topic || !type) {
    return res.status(400).json({ error: "Topic and type are required" });
  }

  const API_KEY = process.env.DEEPSEEK_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const numQuestions = Math.min(Math.max(count || 5, 1), 20);

  const contextSection = context
    ? `\n\nCONTEXTO DE MATERIALES DE REFERENCIA (usa estos temas como guía para crear preguntas similares):\n${context}`
    : "";

  let systemPrompt = "";
  let config = { count: numQuestions, prompt: "" };

  if (type === "simulacro") {
    const topicConfigs = {
      "Examen Completo IEN": {
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
Cada pregunta debe incluir "area" (PE1/PE2/PE3) y "subtema".`,
      },
      "PE1 - Aptitud Académica y Humanidades": {
        count: 35,
        prompt: `Genera la PE1 del IEN UNI - Aptitud Académica y Humanidades (35 preguntas):
- Razonamiento Matemático (12 preguntas): Sucesiones numéricas, análisis de figuras, conteo, lógica proposicional, juegos lógicos
- Razonamiento Verbal (13 preguntas): Comprensión lectora, analogías verbales, significado de palabras en contexto, ortografía
- Humanidades (10 preguntas): Comunicación, Lengua, Literatura, Historia del Perú y del Mundo, Geografía, Economía, Filosofía, Lógica, Ambiente
Cada pregunta debe incluir "area" y "subtema".`,
      },
      "PE2 - Matemática": {
        count: 13,
        prompt: `Genera la PE2 del IEN UNI - Matemática (13 preguntas):
- Aritmética (3): Divisibilidad, MCM/MCD, porcentajes, razones, proporciones, números primos
- Álgebra (4): Ecuaciones, sistemas de ecuaciones, desigualdades, funciones, expresiones algebraicas
- Geometría (3): Triángulos, circunferencia, áreas, perímetros, semejanza, polígonos
- Trigonometría (3): Razones trigonométricas, identidades, ecuaciones trigonométricas, aplicación a triángulos
Cada pregunta debe incluir "area" y "subtema".`,
      },
      "PE3 - Física y Química": {
        count: 17,
        prompt: `Genera la PE3 del IEN UNI - Física y Química (17 preguntas):
- Física (7): Cinemática, dinámica, trabajo y energía, estática, hidrostática, termodinámica, electricidad, magnetismo, ondas, óptica, física moderna
- Química (7): Estructura atómica, tabla periódica, enlaces químicos, estequiometría, reacciones químicas, química orgánica básica
- Humanidades y Cultura General (4): Literatura, Historia del Perú, Geografía, Economía
Cada pregunta debe incluir "area" y "subtema".`,
      },
      "Razonamiento Matemático": { count: 12, prompt: `Genera 12 preguntas de Razonamiento Matemático del IEN UNI: sucesiones numéricas, análisis de figuras (series, analogías, distribución en filas y columnas, figuras discordantes), análisis de sólidos (vistas, despliegues), conteo de figuras geométricas, conteo de rutas, conteo de cubos, lógica proposicional, inferencias, juegos lógicos.` },
      "Razonamiento Verbal": { count: 13, prompt: `Genera 13 preguntas de Razonamiento Verbal del IEN UNI: comprensión lectora (textos argumentativos, narrativos, expositivos), analogías verbales, significado de palabras en contexto, relaciones semánticas, ortografía, reglas de acentuación.` },
      "Humanidades": { count: 8, prompt: `Genera 8 preguntas de Humanidades del IEN UNI: Comunicación, Lengua, Literatura, Historia del Perú y del Mundo, Geografía, Economía, Filosofía, Lógica, Ambiente.` },
      "Matemática": { count: 13, prompt: `Genera 13 preguntas de Matemática del IEN UNI: Aritmética (divisibilidad, MCM/MCD, porcentajes, razones), Álgebra (ecuaciones, sistemas, desigualdades, funciones), Geometría (triángulos, circunferencia, áreas, semejanza), Trigonometría (razones, identidades, aplicaciones).` },
      "Física": { count: 7, prompt: `Genera 7 preguntas de Física del IEN UNI: Cinemática, dinámica, trabajo y energía, estática, hidrostática, termodinámica, electricidad, magnetismo, ondas, óptica, física moderna.` },
      "Química": { count: 7, prompt: `Genera 7 preguntas de Química del IEN UNI: Estructura atómica, tabla periódica, enlaces químicos, estequiometría, reacciones químicas, química orgánica básica.` },
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
${context || "No hay contenido de guía disponible. Genera preguntas basándote en tu conocimiento del examen IEN UNI de nivel 5to de secundaria."}

FORMATO JSON VÁLIDO (sin markdown, sin backticks):
{
  "preguntas": [
    {
      "texto": "Texto de la pregunta",
      "opciones": ["A) Opción 1", "B) Opción 2", "C) Opción 3", "D) Opción 4", "E) Opción 5"],
      "respuestaCorrecta": 0,
      "area": "PE1/PE2/PE3",
      "subtema": "Subtema específico",
      "dificultad": "alta/media",
      "pasos": ["paso 1 de resolución", "paso 2 de resolución"],
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
- Nivel: examen de admisión UNI (el más exigente del Perú). Un postulante promedio resuelve MENOS del 40%: calibra así.
- El examen IEN usa 5 opciones (A-E)
- respuestaCorrecta es el índice (0-4) de la opción correcta
- Incluye "area" (PE1, PE2 o PE3) y "subtema" en cada pregunta
- DIFICULTAD OBLIGATORIA: 0% fáciles, 20% medias, 80% altas. Marca cada una en "dificultad".
- PROHIBIDO: preguntas de un solo paso, cálculo directo (ej. "¿Cuánto es 2+2?"), definiciones de memoria ("¿Qué es...?"), textos de menos de 80 palabras en comprensión lectora, sucesiones aritméticas obvias.
- Cada pregunta "alta" DEBE exigir 2 o más conceptos combinados y tener al menos 3 pasos de resolución (lista los pasos en "pasos"). Si no llega a 3 pasos, no es alta: elévala.
- Distractores trampa: cada distractor debe corresponder a un ERROR TÍPICO real (signo cambiado, fórmula a medias, lectura parcial del texto, confundir área con perímetro, olvidar el reactivo limitante, etc.).
- Números no triviales: evita resultados enteros obvios; usa fracciones, radicales y decimales como el examen real.
- Por área, exige esto:
  * Aritmética/Álgebra: combina 2 temas (ej. divisibilidad + ecuaciones; funciones + desigualdades).
  * Geometría/Trigonometría: exige trazo auxiliar, semejanza o identidad no inmediata.
  * Física: combina 2 principios (ej. dinámica + trabajo-energía; hidrostática + empuje con densidades compuestas).
  * Química: estequiometría con reactivo limitante o impurezas; nada de preguntas de completar la tabla periódica.
  * Razonamiento Matemático: juegos lógicos de 4+ condiciones o conteo con casos múltiples, no series de +2.
  * Razonamiento Verbal: textos densos de 150+ palabras con inferencia (nada literal), analogías de 2do orden.
  * Humanidades: pregunta relacional (causa-efecto, compara autores/hechos), no fechas sueltas de memoria.
- ANCLAS DE NIVEL (iguala o supera esta dificultad):
  * Álgebra: "Si x + 1/x = 4, calcule x^4 + 1/x^4" (exige ver el cuadrado iterado, no reemplazo directo).
  * Geometría: hallar un área sombreada que obliga a restar sectores y usar semejanza antes de operar.
  * Física: un bloque que desliza por un plano inclinado con fricción y luego comprime un resorte: pide la compresión máxima (dinámica + energía + condición de equilibrio).
- SI HAY GUÍA DEL ADMINISTRADOR: usa el estilo y nivel de dificultad como referencia
- NO repitas conceptos entre preguntas
- CADA PREGUNTA DEBE SER ÚNICA: varía datos numéricos, contextos y enfoques aunque el subtema se repita`;
  } else {
    config = { count: numQuestions, prompt: "" };
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

  try {
    const objetivo = config.count || numQuestions;
    const usarBanco = type === "simulacro";

    // --- Ruta vocacional u otros: solo dedup dentro del lote ---
    if (!usarBanco) {
      const lote = await llamarIA(API_KEY, systemPrompt, topic, objetivo, context, []);
      if (!lote) return res.status(502).json({ error: "Invalid response format from AI" });
      const bancoVacio = { hashes: new Set(), entradas: [], normas: [] };
      const { nuevas } = filtrarLote(lote, bancoVacio, []);
      const limpias = nuevas.map(({ texto_norm, hash, optsHash, nums, ...q }) => q);
      return res.status(200).json({ preguntas: limpias });
    }

    // --- Ruta simulacro: banco + exclusiones + reintento ---
    const banco = await cargarBanco(universidad);
    const acumuladas = [];
    let repetidasTotal = 0;

    for (let intento = 0; intento < MAX_INTENTOS && acumuladas.length < objetivo; intento++) {
      const exclusionStems = [
        ...banco.normas.slice(-30),
        ...acumuladas.map((a) => a.texto_norm),
      ].map((t) => String(t).slice(0, 120));
      const lote = await llamarIA(API_KEY, systemPrompt, topic, objetivo, context, exclusionStems);
      if (!lote) break;
      const { nuevas, repetidas } = filtrarLote(lote, banco, excludeNorms);
      repetidasTotal += repetidas;
      acumuladas.push(...nuevas);
      // el banco en memoria ya se actualizó dentro de filtrarLote
      banco.normas.push(...nuevas.map((n) => n.texto_norm));
    }

    if (!acumuladas.length) {
      return res.status(502).json({ error: "Could not parse AI response" });
    }

    // --- Refuerzo de nivel: si menos del 50% salió alta, tanda extra SOLO altas ---
    let final = auditarNivel(acumuladas.slice(0, objetivo));
    const cuentaAltas = (arr) => arr.filter((q) => (q.dificultad || "alta") === "alta").length;
    if (cuentaAltas(final) / Math.max(1, final.length) < 0.5) {
      const faltan = Math.min(Math.ceil(objetivo * 0.8) - cuentaAltas(final), 20);
      if (faltan > 0) {
        try {
          const loteNivel = await llamarIA(
            API_KEY,
            systemPrompt + "\n\nREFUERZO DE NIVEL OBLIGATORIO: tu tanda anterior salió demasiado fácil. En esta tanda genera ÚNICAMENTE preguntas de dificultad ALTA nivel examen real UNI (multi-paso, distractores trampa, números no triviales). Marca todas con \"dificultad\": \"alta\".",
            topic,
            faltan,
            context,
            [...banco.normas.slice(-30), ...final.map((a) => a.texto_norm)].map((t) => String(t).slice(0, 120))
          );
          if (loteNivel) {
            const { nuevas: _nl } = filtrarLote(loteNivel, banco, excludeNorms);
            const nuevas = auditarNivel(_nl);
            const altasNuevas = nuevas.filter((q) => (q.dificultad || "alta") === "alta");
            let k = 0;
            final = final.map((q) =>
              (q.dificultad || "alta") !== "alta" && k < altasNuevas.length ? altasNuevas[k++] : q
            );
            acumuladas.push(...altasNuevas.slice(k));
          }
        } catch {}
      }
    }

    await guardarBanco(universidad, acumuladas);

    const limpias = final.map(({ texto_norm, hash, optsHash, nums, ...q }) => q);
    const nAltas = cuentaAltas(limpias);
    return res.status(200).json({
      preguntas: limpias,
      total: limpias.length,
      solicitadas: objetivo,
      repetidas_filtradas: repetidasTotal,
      nivel: { altas: nAltas, medias: limpias.length - nAltas, pct_altas: Math.round((nAltas / Math.max(1, limpias.length)) * 100) },
    });
  } catch (error) {
    console.error("Generate questions error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
