// ============================================================
// API: POST /api/generate-questions — con SISTEMA ANTI-REPETICIÓN
// Body: { topic, type, count, context, universidad?, exclude_textos?[] }
// - type "simulacro": cada pregunta generada se compara contra el
//   BANCO (tabla banco_preguntas) y contra exclude_textos (preguntas
//   que el estudiante ya vio). Se descartan hashes iguales y textos
//   con similitud >= 0.85. Si faltan, se reintenta con la lista de
//   exclusión en el prompt. Las nuevas se guardan en el banco.
// - VALIDACIÓN DE CLAVE: toda pregunta de simulacro DEBE traer
//   respuestaCorrecta (entero 0-4 dentro del rango de opciones) y
//   5 opciones (A-E) completas; si no, se descarta y se pide otra.
// - AUDITORÍA CON IA: antes de responder, una IA resuelve cada
//   pregunta y corrige/elimina las cuya clave marcada no sea la
//   correcta (solo type "simulacro").
// - Otros types (vocacional): validación ligera + dedup en el lote.
// ============================================================
const crypto = require("crypto");
const ai = require("./_ai");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tnqjjydmlruzcxlzeurt.supabase.co";
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWpqeWRtbHJ1emN4bHpldXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njc1NjIsImV4cCI6MjEwMzU0MzU2Mn0.RHWZx-PKCf-ekJ501T1VXkHzEynMXrx2Irc0e0K3FlE";
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY || null;

const UMBRAL_SIMILITUD = 0.85;
const MAX_INTENTOS = 3;
const BATCH_SECTION_PROMPTS = {
  razonamiento_matematico: "Razonamiento Matemático de Aptitud Académica (PE1): sucesiones no obvias, análisis de figuras, conteo, lógica y juegos lógicos.",
  razonamiento_verbal: "Razonamiento Verbal de Aptitud Académica (PE1): comprensión lectora con textos densos e inferencia, analogías de segundo orden, semántica y ortografía.",
  humanidades_pe1: "Humanidades de Aptitud Académica (PE1): Comunicación, Literatura, Historia, Geografía, Economía, Filosofía y Ambiente; prioriza relaciones de causa y efecto.",
  matematica: "Matemática de Conocimientos (PE2): Aritmética, Álgebra, Geometría y Trigonometría, combinando conceptos y evitando aplicación directa de una sola fórmula.",
  fisica: "Física de Conocimientos (PE2): Cinemática, dinámica, trabajo y energía, estática, hidrostática, termodinámica, electricidad, ondas y óptica; combina principios.",
  quimica: "Química de Conocimientos (PE2): estructura atómica, enlaces, estequiometría y reacciones; incluye reactivo limitante o impurezas cuando corresponda.",
  humanidades_pe3: "Humanidades y Cultura General de Conocimientos (PE3): Literatura, Historia, Geografía y Economía; prioriza preguntas relacionales, no fechas aisladas.",
};

// ------------------------------------------------------------
// REGLAS COMPARTIDAS: se inyectan en TODOS los prompts de
// simulacro (examen completo y por bloques) para que cada
// generación tenga el MÁXIMO nivel exigido por la sección.
// ------------------------------------------------------------
const REGLAS_NIVEL = `- Nivel: examen de admisión UNI (el más exigente del Perú). Un postulante promedio resuelve MENOS del 40%: calibra así.
- El examen IEN usa 5 opciones (A-E)
- Incluye "area" (PE1, PE2 o PE3) y "subtema" en cada pregunta
- DIFICULTAD OBLIGATORIA: 100% altas. 0% medias, 0% fáciles. Marca cada una en "dificultad": "alta".
- PROHIBIDO: preguntas de un solo paso, cálculo directo (ej. "¿Cuánto es 2+2?"), definiciones de memoria ("¿Qué es...?"), textos de menos de 80 palabras en comprensión lectora, sucesiones aritméticas obvias.
- APLICACIÓN DIRECTA PROHIBIDA: si se resuelve con una sola fórmula o una sola observación, NO es alta. Ejemplos de nivel MEDIO que debes ELEVAR (no los copies, úsalos como piso mínimo):
  * "Si log2(x) + log2(x-2) = 3, halle x^2 - 2x" → MEDIO (colapsa en una observación). Versión ALTA: agrega parámetro k, condición de existencia y descarte de raíces extrañas, o combina con inecuación.
  * "Triángulo rectángulo de hipotenusa 13 y cateto 5, halle sen(2θ)" → MEDIO (fórmula directa sobre terna notable). Versión ALTA: el triángulo debe deducirse de una condición previa (semejanza, área dada, trazo auxiliar) antes de aplicar ángulo doble.
  Regla de oro: el estudiante debe ATASCARSE al menos una vez y necesitar un insight intermedio (despeje no obvio, trazo auxiliar, cambio de variable, descarte de casos, interpretación de un dato oculto).
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
- NO repitas conceptos entre preguntas
- CADA PREGUNTA DEBE SER ÚNICA: varía datos numéricos, contextos y enfoques aunque el subtema se repita`;

const REGLAS_CLAVE = `- "respuestaCorrecta" DEBE ser un NÚMERO ENTERO del 0 al 4: el índice de la ÚNICA opción correcta (0=A, 1=B, 2=C, 3=D, 4=E). NUNCA lo dejes sin definir, en 0 por defecto, como cadena de texto ("2") o apuntando a una opción vacía.
- ANTES de responder, RESUELVE cada pregunta paso a paso y confirma que exactamente UNA opción es correcta y que es la que marcaste en "respuestaCorrecta". Si no puedes resolverla con certeza, NO la incluyas.
- Las 5 opciones deben ser textos distintos, plausibles y no vacíos; solo una es correcta.`;

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
    const u = `${SUPABASE_URL}/rest/v1/banco_preguntas?select=hash,texto_norm,opciones_hash,numeros&universidad=eq.${encodeURIComponent(universidad)}&order=created_at.desc&limit=1000`;
    const r = await fetch(u, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      signal: AbortSignal.timeout(15000),
    });
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

// ------------------------------------------------------------
// VALIDACIÓN DE CLAVE DE RESPUESTA (crítica).
// Devuelve la pregunta con respuestaCorrecta normalizada a entero,
// o null si es inválida (se descarta y se pide otra a la IA).
//   - simulacro (IEN): EXIGE 5 opciones (A-E) completas y una
//     clave entera dentro de rango. Nunca "responde" 0 por defecto.
//   - vocacional: la clave no define nada, se normaliza a 0.
// ------------------------------------------------------------
function validarPreguntaGenerada(q, esSimulacro) {
  if (!q || typeof q !== "object") return null;
  if (normalizarTexto(q.texto).length < 10) return null;
  const opts = Array.isArray(q.opciones) ? q.opciones : [];
  if (esSimulacro ? opts.length !== 5 : opts.length < 4) return null;
  if (opts.some((o) => typeof o !== "string" || !o.trim())) return null;

  if (typeof q.respuestaCorrecta === "string" && /^\d+$/.test(q.respuestaCorrecta.trim())) {
    q = { ...q, respuestaCorrecta: parseInt(q.respuestaCorrecta.trim(), 10) };
  }
  if (!Number.isInteger(q.respuestaCorrecta) || q.respuestaCorrecta < 0 || q.respuestaCorrecta >= opts.length) {
    if (esSimulacro) return null; // simulacro sin clave válida → se descarta
    q = { ...q, respuestaCorrecta: 0 }; // vocacional: la clave no evalúa nada
  }
  if (!String(opts[q.respuestaCorrecta] || "").trim()) return null; // clave apuntando a opción vacía
  return q;
}

// Filtra un lote de la IA. Devuelve { nuevas, repetidas, invalidas }.
// nuevas lleva campos internos texto_norm/hash (se limpian al responder).
// esSimulacro activa la validación estricta de clave (5 opciones A-E).
function filtrarLote(candidatas, banco, refsExtra, esSimulacro = false) {
  const vistas = new Set();
  const nuevas = [];
  let repetidas = 0;
  let invalidas = 0;
  for (const raw of candidatas || []) {
    const q = validarPreguntaGenerada(raw, esSimulacro);
    if (!q) { invalidas++; continue; }
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
  return { nuevas, repetidas, invalidas };
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
  // Solo se persisten preguntas con clave entera válida (nunca se
  // guarda un "0" silencioso como clave incorrecta por defecto).
  const filasOK = nuevas.filter((q) => Number.isInteger(q.respuestaCorrecta));
  if (!filasOK.length) return;
  const key = SUPABASE_SERVICE || SUPABASE_ANON;
  const filas = filasOK.map((q) => ({
    universidad,
    texto: String(q.texto).slice(0, 2000),
    texto_norm: q.texto_norm,
    hash: q.hash,
    opciones: q.opciones || [],
    respuesta_correcta: q.respuestaCorrecta,
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
      signal: AbortSignal.timeout(15000),
    });
  } catch {} // si falla el guardado, igual se devuelven las preguntas
}

// ------------------------------------------------------------
// CADENA DE MODELOS GRATUITOS (:free). El principal es
// OPENROUTER_MODEL; si falla (límite diario, 429, JSON inválido)
// se intenta con los respaldos de OPENROUTER_MODELS. Así la
// generación no se cae cuando un modelo gratis se agota.
// ------------------------------------------------------------
function cadenaModelos() {
  // DeepSeek oficial: un solo modelo (créditos pagos → sin carrera
  // paralela, cada llamada extra costaría dinero).
  if (ai.esDeepSeek()) return [ai.model()];
  const principal = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
  const respaldo = (
    process.env.OPENROUTER_MODELS ||
    "nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free,nvidia/nemotron-3.5-super-vl:free,nvidia/nemotron-3.5-lightning:free,baidu/ernie-5.5-flash-preview:free,recursive/flint-v1.0:free,particle-ai/particle-1:free"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [principal, ...respaldo.filter((m) => m !== principal)];
}

// Cierra estructuras abiertas y limpia restos a media clave/valor.
function cerrarEstructuras(t) {
  const stack = [];
  let enString = false;
  let escape = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') enString = false;
      continue;
    }
    if (c === '"') enString = true;
    else if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") stack.pop();
  }
  const limpio = t
    .replace(/,\s*$/, "")
    .replace(/,\s*"[^"]*"\s*:\s*$/, "")
    .replace(/"[^"]*"\s*:\s*$/, "")
    .replace(/:\s*$/, "")
    .replace(/,\s*$/, "");
  const cierres = stack
    .slice()
    .reverse()
    .map((x) => (x === "{" ? "}" : "]"))
    .join("");
  return limpio + cierres;
}

// Repara respuestas TRUNCADAS (max_tokens alcanzado): recorta en el
// último cierre de llave/corchete fuera de cadenas y cierra lo que
// falte. Conserva todas las preguntas completas y descarta solo la
// última a media escribir.
function repararTruncado(s) {
  const inicio = s.indexOf("{");
  if (inicio < 0) return null;
  s = s.slice(inicio);
  let enString = false;
  let escape = false;
  let ultimo = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (enString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') enString = false;
      continue;
    }
    if (c === '"') enString = true;
    else if (c === "}" || c === "]") ultimo = i;
  }
  if (ultimo < 0) return null;
  return cerrarEstructuras(s.slice(0, ultimo + 1));
}

// Extracción tolerante del JSON de la IA: quita markdown/backticks,
// balancea llaves, repara recortes y, como último recurso, usa el
// bloque greedy antiguo.
function extraerJSON(content) {
  if (!content || typeof content !== "string") return null;
  let s = content.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1];

  // 1) objeto {...} balanceado (respuesta completa, aunque haya texto alrededor)
  const inicio = s.indexOf("{");
  if (inicio >= 0) {
    let depth = 0;
    let fin = -1;
    let enString = false;
    let escape = false;
    for (let i = inicio; i < s.length; i++) {
      const c = s[i];
      if (enString) {
        if (escape) escape = false;
        else if (c === "\\") escape = true;
        else if (c === '"') enString = false;
        continue;
      }
      if (c === '"') enString = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          fin = i;
          break;
        }
      }
    }
    if (fin >= 0) {
      try {
        return JSON.parse(s.slice(inicio, fin + 1));
      } catch {}
    }
  }

  // 2) recortado → reparar conservando las preguntas completas
  const reparado = repararTruncado(s);
  if (reparado) {
    try {
      return JSON.parse(reparado);
    } catch {}
  }

  // 3) último recurso (comportamiento original)
  const greedy = s.match(/\{[\s\S]*\}/);
  if (greedy) {
    try {
      return JSON.parse(greedy[0]);
    } catch {}
  }
  return null;
}

// Llamada genérica a la IA que devuelve el JSON parseado (o null).
//
// Los modelos ":free" de OpenRouter son inestables: a veces responden en
// segundos, a veces 429 (límite), a veces se quedan "pensando" minutos o
// devuelven contenido vacío. Por eso se usa una CARRERA ESCALONADA:
//   - se lanza el primer modelo y, si en OPENROUTER_STAGGER_MS no ha
//     respondido, se lanza el siguiente en paralelo;
//   - si uno falla rápido (429, vacío) se lanza el siguiente al instante;
//   - gana el primero que devuelva JSON válido y el resto se cancela.
async function pedirJSON(API_KEY, systemPrompt, userPrompt, opts = {}) {
  const { temperature = 0.9, maxTokens = 16384, deadline } = opts;
  const AI_URL = ai.url();
  // Parámetros extra del proveedor: en OpenRouter el esfuerzo de
  // razonamiento (los gratis "piensan" tanto que devuelven vacío);
  // en DeepSeek no se envía ninguno.
  const extra = ai.extraBody();
  const tope = ai.topeMaxTokens();
  // Presupuesto de ESTA llamada (y tope máximo que indique el handler:
  // Vercel corta la función a los 300s, hay que responder antes).
  const presupuestoMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 120000);
  const staggerMs = Number(process.env.OPENROUTER_STAGGER_MS || 25000);
  const limite = Math.min(Date.now() + presupuestoMs, deadline || Infinity);
  if (limite - Date.now() < 5000) return null; // sin tiempo suficiente
  const abort = new AbortController(); // cancela el resto al haber ganador

  let mejor = null;

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  const intentarModelo = async (modelo, mt) => {
    if (mejor || Date.now() >= limite) return;
    const restante = limite - Date.now();
    const local = new AbortController();
    const cancelar = () => local.abort();
    abort.signal.addEventListener("abort", cancelar, { once: true });
    const timer = setTimeout(() => local.abort(), Math.min(120000, restante));
    try {
      const response = await fetch(AI_URL, {
        method: "POST",
        // sin timeout una petición al proveedor puede colgar el request entero
        signal: local.signal,
        headers: { ...ai.headers(), Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: Math.min(mt, tope),
          temperature,
          ...extra,
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error(`[IA] ${modelo} (max_tokens=${mt}): HTTP ${response.status} ${errText.slice(0, 300)}`);
        return;
      }
      const data = await response.json().catch(() => null);
      const content = data?.choices?.[0]?.message?.content || "";
      const parsed = extraerJSON(content);
      if (parsed) {
        mejor = parsed;
        abort.abort(); // ya hay ganador → se cancelan los demás
        console.error(`[IA] ${modelo}: OK (${Date.now() - (limite - restante)}ms, max_tokens=${mt})`);
        return;
      }
      const finish = data?.choices?.[0]?.finish_reason;
      console.error(
        `[IA] ${modelo} (max_tokens=${mt}): sin JSON válido (finish=${finish}) → ${
          content.slice(0, 200) || "contenido vacío; respuesta=" + JSON.stringify(data).slice(0, 200)
        }`
      );
    } catch (e) {
      if (!abort.signal.aborted) {
        console.error(`[IA] ${modelo}: error de red/timeout → ${e.name}: ${e.message}`);
      }
    } finally {
      clearTimeout(timer);
      abort.signal.removeEventListener("abort", cancelar);
    }
  };

  const modelos = cadenaModelos();
  const enVuelo = [];
  for (let i = 0; i < modelos.length && !mejor && Date.now() < limite; i++) {
    const modelo = modelos[i];
    const tarea = intentarModelo(modelo, maxTokens).finally(() => {
      const p = enVuelo.indexOf(tarea);
      if (p >= 0) enVuelo.splice(p, 1);
    });
    enVuelo.push(tarea);
    // Espera: si falla rápido se lanza el siguiente ya; si sigue
    // trabajando pasados staggerMs, se solapa con el siguiente modelo.
    const esperar = staggerMs;
    const inicio = Date.now();
    while (!mejor && Date.now() - inicio < esperar && enVuelo.length) {
      await Promise.race([dormir(Math.min(2000, esperar)), ...enVuelo.slice()]);
      if (enVuelo.indexOf(tarea) < 0) break; // terminó (falló rápido)
    }
  }
  await Promise.allSettled(enVuelo.slice());
  return mejor;
}

async function llamarIA(API_KEY, systemPrompt, topic, n, context, exclusionStems, deadline) {
  const exclusion = exclusionStems.length
    ? `\n\nPREGUNTAS PROHIBIDAS (ya existen en el banco o el estudiante ya las vio — NO generes ninguna igual ni reescrita con otras palabras):\n${exclusionStems.map((s) => `- ${s}`).join("\n")}`
    : "";
  const parsed = await pedirJSON(
    API_KEY,
    systemPrompt,
    `Genera las ${n} preguntas del "${topic}" para el examen IEN de la UNI. ${context ? "IMPORTANTE: Usa los materiales de referencia del administrador como guía para el estilo, dificultad y tipo de preguntas." : ""}${exclusion}`,
    { maxTokens: ai.maxTokensPara(n), deadline }
  );
  if (!parsed || !Array.isArray(parsed.preguntas)) return null;
  return parsed.preguntas;
}

// ------------------------------------------------------------
// AUDITORÍA DE CLAVES CON IA: resuelve cada pregunta generada y
// verifica que "respuestaCorrecta" apunte a la ÚNICA opción
// correcta real. Corrige claves equivocadas y elimina preguntas
// defectuosas (sin respuesta única). Si la auditoría no responde,
// se conservan las preguntas tal cual (no rompe la generación).
// ------------------------------------------------------------
async function auditarClaves(API_KEY, preguntas, deadline) {
  const TAM = 10;
  const verifs = new Map();
  for (let i = 0; i < preguntas.length; i += TAM) {
    const lote = preguntas.slice(i, i + TAM);
    const sistema = `Eres un verificador de exámenes de admisión IEN UNI (nivel máximo, Perú). Recibirás preguntas de opción múltiple con su clave "respuestaCorrecta" (índice 0-4). Tu trabajo: RESOLVER cada pregunta con cuidado y verificar si la clave marcada es realmente la ÚNICA opción correcta.

Responde SOLO con JSON válido (sin markdown, sin texto extra):
{"verificaciones":[{"i":0,"clave":2,"valida":true,"motivo":"se resuelve combinando..."}]}
Donde "i" es el índice de la pregunta en el lote (empezando en 0), "clave" el índice (0-4) de la ÚNICA opción correcta REAL, "valida" false si la pregunta es defectuosa (sin respuesta única, opciones sin sentido, enunciado incompleto o ambiguo) y "motivo" en una frase.

REGLAS:
- Calcula/resolve matemática, física y química paso a paso antes de decidir; no confíes en la clave original.
- Si la clave original es correcta, devuelve la misma "clave".
- Si es incorrecta, devuelve el índice correcto con "valida": true.
- No reescribas las preguntas; solo verifica y corrige claves.`;
    const user = JSON.stringify(
      lote.map((q, k) => ({ i: k, texto: q.texto, opciones: q.opciones, respuestaCorrecta: q.respuestaCorrecta }))
    );
    try {
      const parsed = await pedirJSON(API_KEY, sistema, user, {
        temperature: 0.2,
        maxTokens: Math.min(16384, ai.topeMaxTokens()),
        deadline,
      });
      const arr = parsed && Array.isArray(parsed.verificaciones) ? parsed.verificaciones : null;
      if (!arr) continue; // tanda no auditable → se conserva sin cambios
      for (const v of arr) {
        if (v && Number.isInteger(v.i) && v.i >= 0 && v.i < lote.length) verifs.set(i + v.i, v);
      }
    } catch {
      continue;
    }
  }

  const salida = [];
  let corregidas = 0;
  let descartadas = 0;
  preguntas.forEach((q, idx) => {
    const v = verifs.get(idx);
    if (!v) { salida.push(q); return; } // sin verificación → se conserva
    if (v.valida === false) { descartadas++; return; } // defectuosa → fuera
    const clave = v.clave;
    if (Number.isInteger(clave) && clave >= 0 && clave < (q.opciones || []).length) {
      if (clave !== q.respuestaCorrecta) {
        corregidas++;
        salida.push({ ...q, respuestaCorrecta: clave });
      } else {
        salida.push(q);
      }
    } else {
      salida.push(q); // verificación ilegible → no tocar
    }
  });
  return { preguntas: salida, corregidas, descartadas, auditadas: verifs.size };
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

  // Presupuesto TOTAL de tiempo. Vercel corta la función a los 300s
  // (FUNCTION_INVOCATION_TIMEOUT / HTTP 504): todos los pasos de IA
  // comparten este límite y se responde con lo que se haya generado
  // antes de que se agote.
  const T0 = Date.now();
  const LIMITE = T0 + Number(process.env.AI_DEADLINE_MS || 245000);
  const infoIA = () => ({
    proveedor: ai.esDeepSeek() ? "deepseek" : "openrouter",
    modelo: ai.model(),
    tiempo_ms: Date.now() - T0,
  });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { topic, type, count, context } = body;
  const batchSectionKey = typeof body.batch_section === "string" ? body.batch_section : "";
  const batchSection = Object.prototype.hasOwnProperty.call(BATCH_SECTION_PROMPTS, batchSectionKey)
    ? BATCH_SECTION_PROMPTS[batchSectionKey]
    : null;
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
        {
          headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (r1.ok) {
        const _ids = ((await r1.json()) || []).map((v) => v.pregunta_id).filter(Boolean).slice(0, 300);
        if (_ids.length) {
          const r2 = await fetch(
            `${SUPABASE_URL}/rest/v1/banco_preguntas?universidad=eq.${encodeURIComponent(universidad)}&id=in.(${_ids.join(",")})&select=texto&limit=300`,
            {
              headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
              signal: AbortSignal.timeout(10000),
            }
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
  if (batchSectionKey && (!batchSection || type !== "simulacro")) {
    return res.status(400).json({ error: "Invalid simulacro batch section" });
  }

  const API_KEY = ai.key();

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
      "dificultad": "alta",
      "pasos": ["paso 1 de resolución", "paso 2 de resolución", "paso 3 de resolución"],
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
${REGLAS_NIVEL}
${REGLAS_CLAVE}
- SI HAY GUÍA DEL ADMINISTRADOR: usa el estilo y nivel de dificultad como referencia
- BASADO EN EL MATERIAL: si el administrador proporcionó contenido del examen/material, esos temas son tu FUENTE PRINCIPAL: genera preguntas que los cubran con el MISMO estilo, pero exigiendo el nivel máximo`;
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

  if (batchSection) {
    config.count = numQuestions;
    systemPrompt = `Eres un experto creador de exámenes de admisión IEN UNI (nivel máximo, Perú). Genera EXACTAMENTE ${numQuestions} preguntas nuevas únicamente sobre esta sección: ${batchSection}

MATERIAL/GUÍA DEL ADMINISTRADOR (FUENTE PRINCIPAL):
${context || "No hay material disponible. Genera con tu conocimiento del examen IEN UNI."}
${context ? "\nCubre los temas de este material con preguntas del MISMO estilo y estructura, pero exigiendo el nivel máximo del examen real (usa el material como guía de estilo, NO copies sus preguntas literalmente)." : ""}

REGLAS DE ESTA SECCIÓN: cinco opciones (A-E); incluye "area" (PE1 para Aptitud Académica, PE2 para Matemática/Física/Química, PE3 para Humanidades de Conocimientos) y "subtema" en cada pregunta. Responde únicamente con JSON válido, sin markdown:
{"preguntas":[{"texto":"...","opciones":["A) ...","B) ...","C) ...","D) ...","E) ..."],"respuestaCorrecta":0,"area":"PE1/PE2/PE3","subtema":"...","dificultad":"alta","pasos":["...","...","..."],"explicacion":"..."}]}

No generes preguntas de otras secciones.

REGLAS DE NIVEL (obligatorias):
${REGLAS_NIVEL}

REGLAS DE LA CLAVE DE RESPUESTA (obligatorias):
${REGLAS_CLAVE}`;
  }

  try {
    const objetivo = config.count || numQuestions;
    const usarBanco = type === "simulacro";

    // --- Ruta vocacional u otros: solo dedup dentro del lote ---
    if (!usarBanco) {
      const lote = await llamarIA(API_KEY, systemPrompt, topic, objetivo, context, [], LIMITE);
      if (!lote) return res.status(502).json({ error: "Invalid response format from AI", ia: infoIA() });
      const bancoVacio = { hashes: new Set(), entradas: [], normas: [] };
      const { nuevas } = filtrarLote(lote, bancoVacio, [], false);
      const limpias = nuevas.map(({ texto_norm, hash, optsHash, nums, ...q }) => q);
      return res.status(200).json({ preguntas: limpias });
    }

    // --- Ruta simulacro: banco + exclusiones + validación de clave + reintento ---
    const banco = await cargarBanco(universidad);
    const acumuladas = [];
    let repetidasTotal = 0;
    let invalidasTotal = 0;

    for (let intento = 0; intento < MAX_INTENTOS && acumuladas.length < objetivo; intento++) {
      if (Date.now() >= LIMITE) {
        console.error(`[SIM] tiempo agotado antes del intento ${intento + 1}`);
        break;
      }
      const exclusionStems = [
        ...banco.normas.slice(-30),
        ...acumuladas.map((a) => a.texto_norm),
      ].map((t) => String(t).slice(0, 120));
      const lote = await llamarIA(
        API_KEY,
        systemPrompt,
        topic,
        objetivo - acumuladas.length,
        context,
        exclusionStems,
        LIMITE
      );
      if (!lote) {
        console.error(`[SIM] intento ${intento + 1}: la IA no devolvió JSON válido → se corta`);
        break;
      }
      const { nuevas, repetidas, invalidas } = filtrarLote(lote, banco, excludeNorms, true);
      repetidasTotal += repetidas;
      invalidasTotal += invalidas;
      acumuladas.push(...nuevas);
      // el banco en memoria ya se actualizó dentro de filtrarLote
      banco.normas.push(...nuevas.map((n) => n.texto_norm));
      console.error(
        `[SIM] intento ${intento + 1}: ${acumuladas.length}/${objetivo} nuevas (repetidas=${repetidas}, inválidas=${invalidas})`
      );
    }

    if (!acumuladas.length) {
      return res.status(502).json({
        error: invalidasTotal
          ? `La IA devolvió ${invalidasTotal} pregunta(s) sin clave de respuesta válida y ninguna pasó la validación`
          : "Could not parse AI response",
        ia: infoIA(),
      });
    }

    // --- Refuerzo de nivel: si menos del 85% salió alta, tanda extra SOLO altas ---
    // (paso OPCIONAL: se omite si queda poco tiempo antes del corte de Vercel)
    let final = auditarNivel(acumuladas.slice(0, objetivo));
    const cuentaAltas = (arr) => arr.filter((q) => (q.dificultad || "alta") === "alta").length;
    const hayTiempoRefuerzo = Date.now() < LIMITE - 70000;
    if (hayTiempoRefuerzo && cuentaAltas(final) / Math.max(1, final.length) < 0.85) {
      const faltan = Math.min(objetivo - cuentaAltas(final) + 5, 25);
      if (faltan > 0) {
        try {
          const loteNivel = await llamarIA(
            API_KEY,
            systemPrompt + "\n\nREFUERZO DE NIVEL OBLIGATORIO: tu tanda anterior salió demasiado fácil. En esta tanda genera ÚNICAMENTE preguntas de dificultad ALTA nivel examen real UNI (multi-paso, distractores trampa, números no triviales). Marca todas con \"dificultad\": \"alta\".",
            topic,
            faltan,
            context,
            [...banco.normas.slice(-30), ...final.map((a) => a.texto_norm)].map((t) => String(t).slice(0, 120)),
            LIMITE
          );
          if (loteNivel) {
            const { nuevas: _nl } = filtrarLote(loteNivel, banco, excludeNorms, true);
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

    // --- AUDITORÍA DE CLAVES CON IA: resuelve cada pregunta, corrige
    //     claves equivocadas y elimina preguntas defectuosas ---
    let auditoria = null;
    if (final.length && Date.now() < LIMITE - 15000) {
      try {
        console.error(`[SIM] auditoría de claves sobre ${final.length} pregunta(s)...`);
        const resAudit = await auditarClaves(API_KEY, final, LIMITE);
        if (resAudit && resAudit.preguntas.length) {
          final = resAudit.preguntas;
          auditoria = {
            auditadas: resAudit.auditadas,
            corregidas: resAudit.corregidas,
            descartadas: resAudit.descartadas,
          };
        }
      } catch {} // si la auditoría falla, se conservan las preguntas tal cual
    }

    // Se guarda solo lo que se devuelve (con la clave ya auditada)
    await guardarBanco(universidad, final);

    const limpias = final.map(({ texto_norm, hash, optsHash, nums, _degradada, ...q }) => q);
    const nAltas = cuentaAltas(limpias);
    return res.status(200).json({
      preguntas: limpias,
      total: limpias.length,
      solicitadas: objetivo,
      repetidas_filtradas: repetidasTotal,
      invalidas_filtradas: invalidasTotal,
      auditoria,
      ia: infoIA(),
      nivel: { altas: nAltas, medias: limpias.length - nAltas, pct_altas: Math.round((nAltas / Math.max(1, limpias.length)) * 100) },
    });
  } catch (error) {
    console.error("Generate questions error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Exuestos solo para pruebas del parser de respuestas de IA
module.exports.extraerJSON = extraerJSON;
module.exports.cadenaModelos = cadenaModelos;
module.exports.REGLAS_NIVEL = REGLAS_NIVEL;
module.exports.REGLAS_CLAVE = REGLAS_CLAVE;
