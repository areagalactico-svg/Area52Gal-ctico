// ============================================================
// Seed inicial de contenido por universidad (temarios + materiales
// oficiales verificados). Uso: node agents/seed-contenido.js
// Lee SUPABASE_URL y SUPABASE_SERVICE_KEY de .env (sin mostrarlas).
// Idempotente: omite títulos que ya existan.
// ============================================================
const fs = require("fs");
const path = require("path");

function leerEnv() {
  const env = {};
  try {
    const txt = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
    for (const lin of txt.split("\n")) {
      const m = lin.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return {
    url: process.env.SUPABASE_URL || env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY,
  };
}

const TEMARIOS = [
  {
    universidad: "UNI",
    titulo: "Temario IEN UNI — Ingreso Escolar Nacional",
    curso: "Preuniversitario",
    contenido: `EXAMEN: IEN (Ingreso Escolar Nacional) + modalidades ordinaria y extraordinaria UNI.
DURACIÓN: 2 h 45 min | 65 preguntas | 5 opciones (A–E).

PARTE I — APTITUD ACADÉMICA (35 preguntas, area PE1):
• Razonamiento Matemático (12): sucesiones numéricas y literales, series y analogías de figuras, distribución en filas/columnas, figuras discordantes, análisis de sólidos (vistas y despliegues), conteo de figuras y rutas, lógica proposicional, inferencias y juegos lógicos.
• Razonamiento Verbal (13): comprensión lectora (textos argumentativos, narrativos y expositivos), analogías verbales, significado de palabras en contexto, relaciones semánticas, ortografía y acentuación.
• Humanidades (10): comunicación y lengua, literatura, historia del Perú y del mundo, geografía, economía, filosofía, lógica y ambiente.

PARTE II — CONOCIMIENTOS (30 preguntas):
• Matemática — PE2 (10): Aritmética (divisibilidad, MCM/MCD, porcentajes, razones y proporciones), Álgebra (ecuaciones, sistemas, desigualdades, funciones), Geometría (triángulos, circunferencia, áreas, semejanza), Trigonometría (razones, identidades, aplicaciones).
• Física — PE3 (7): cinemática, dinámica, trabajo y energía, estática, hidrostática, termodinámica, electricidad, magnetismo, ondas, óptica y física moderna.
• Química — PE3 (7): estructura atómica, tabla periódica, enlaces químicos, estequiometría, reacciones químicas y química orgánica básica.
• Humanidades y Cultura General (6): literatura, historia, geografía y economía.

CALIFICACIÓN: cada área puntúa distinto por respuesta correcta y descuenta por errada. Practica con tiempo real y revisa tu orden de mérito en cada simulacro.
Fuente: prospecto oficial de admisión UNI (verifica el ciclo vigente en admision.uni.edu.pe).`,
  },
  {
    universidad: "San Marcos",
    titulo: "Temario Admisión San Marcos (UNMSM)",
    curso: "Preuniversitario",
    contenido: `EXAMEN ORDINARIO UNMSM (modelo DECO): mide destrezas cognitivas + conocimientos, con descuento por respuesta errada.
ÁREAS Y COMPONENTES:
• Habilidad Lógico-Matemática: series, analogías, conteo, lógica, resolución de problemas.
• Habilidad Verbal: comprensión lectora, vocabulario en contexto, analogías, conectores.
• Matemática: aritmética, álgebra, geometría, trigonometría y estadística básica.
• Comunicación y Lenguaje + Literatura: gramática, normativa, obras y autores representativos.
• Ciencias Sociales: historia del Perú y del mundo, geografía, economía, filosofía y cívica.
• Ciencias Naturales: física, química y biología (peso mayor en áreas de ciencias e ingenierías).
ESTRATEGIA: el examen se rinde por áreas (A–E); identifica tu área y refuerza sus cursos de mayor peso. Practica comprensión lectora todos los días: es el componente que más decide el ingreso.
Fuente: Oficina Central de Admisión — OCA (admision.unmsm.edu.pe). Verifica el prospecto del ciclo vigente.`,
  },
  {
    universidad: "Católica",
    titulo: "Temario Admisión PUCP — Evaluación del Talento",
    curso: "Preuniversitario",
    contenido: `EVALUACIÓN DEL TALENTO PUCP: evalúa aptitudes, no memoria. Sin descuento por respuesta errada: responde TODO.
COMPONENTES:
• Lectura (comprensión): textos académicos y argumentativos, inferencia, síntesis, vocabulario en contexto.
• Redacción: ortografía y puntuación, conectores, coherencia y cohesión, corrección de oraciones.
• Matemática: aritmética y proporcionalidad, álgebra básica (ecuaciones, desigualdades, funciones), geometría elemental, interpretación de gráficos y razonamiento cuantitativo.
ESTRATEGIA: la velocidad lectora es decisiva; practica con textos largos bajo cronómetro. En matemática, domina ecuaciones y proporciones antes de ver geometría.
Recurso oficial: simulacro de admisión en admision.pucp.edu.pe (pestaña Materiales).
Fuente: Dirección de Admisión PUCP. Verifica tu modalidad (Talento, ITS, general) y sus fechas.`,
  },
  {
    universidad: "La Molina",
    titulo: "Temario Admisión UNALM — La Molina",
    curso: "Preuniversitario",
    contenido: `EXAMEN ORDINARIO UNALM: aptitud + conocimientos de ciencias.
COMPONENTES:
• Aptitud académica: razonamiento matemático (series, conteo, lógica) y razonamiento verbal (comprensión, analogías, vocabulario).
• Matemática: aritmética, álgebra, geometría y trigonometría.
• Física: mecánica, energía, electricidad y nociones de termodinámica.
• Química: estructura atómica, enlaces, estequiometría y reacciones.
• Biología: ecología, citología, genética básica y anatomía/fisiología general (alto peso en carreras biológicas).
ESTRATEGIA: biología y química diferencian a los ingresantes en la mayoría de carreras; no las subestimes frente a matemática.
Fuente: Oficina de Admisión UNALM (lamolina.edu.pe/admision). Verifica el prospecto del ciclo vigente.`,
  },
  {
    universidad: "San Martín",
    titulo: "Temario Admisión USMP — San Martín de Porres",
    curso: "Preuniversitario",
    contenido: `EXAMEN ORDINARIO USMP: aptitud + conocimientos según la carrera.
COMPONENTES:
• Razonamiento Verbal: comprensión lectora, sinónimos/antónimos, analogías, conectores y ortografía.
• Razonamiento Matemático: series numéricas, conteo de figuras, lógica, proporciones y problemas de planteo.
• Conocimientos: matemática básica, cultura general, historia del Perú, geografía y actualidad (el peso varía por carrera: revisa tu prospecto).
• Carreras de salud e ingenierías: refuerza biología/química o física/matemática respectivamente.
ESTRATEGIA: al ser por carrera, estudia con el prospecto de TU facultad y practica velocidad: el examen premia responder todo.
Fuente: Oficina de Admisión USMP (admision.usmp.edu.pe). Incluye reglamento de admisión vigente.`,
  },
  {
    universidad: "Pacifico",
    titulo: "Temario Admisión UP — Universidad del Pacífico",
    curso: "Preuniversitario",
    contenido: `ADMISIÓN INTEGRAL UP: proceso por etapas (prueba de aptitud + evaluaciones complementarias según modalidad).
COMPONENTES DE LA PRUEBA:
• Aptitud matemática: proporcionalidad, porcentajes, ecuaciones, funciones, interpretación de tablas y gráficos, razonamiento cuantitativo aplicado a economía y negocios.
• Comprensión lectora y razonamiento verbal: textos argumentativos, inferencia, síntesis y vocabulario preciso.
• Etapas complementarias: entrevista personal y/o ensayo según la modalidad (verifica la tuya).
ESTRATEGIA: la UP premia el razonamiento aplicado a casos de negocios y economía: practica con datos reales (porcentajes, gráficos, tablas). La redacción clara del ensayo suma puntos decisivos.
Fuente: Oficina de Admisión UP (admision.up.edu.pe). Revisa modalidades, cronogramas y vacantes del ciclo.`,
  },
];

const MATERIALES = [
  {
    universidad: "San Marcos",
    titulo: "Simulacro Presencial OCA 2027-I (oficial)",
    materia: "General",
    descripcion: "Información oficial del simulacro presencial de la OCA San Marcos: fechas, inscripción y modalidades. Úsalo para medir tu nivel con las reglas reales del examen.",
    archivos: [{ name: "simulacro-oca-unmsm", url: "https://admision.unmsm.edu.pe/portal/simulacro-presencial-2027-i/" }],
    contenido_texto: "Fuente oficial: https://admision.unmsm.edu.pe/portal/simulacro-presencial-2027-i/\nTipo: simulacro oficial OCA.",
  },
  {
    universidad: "Católica",
    titulo: "Simulacro de Admisión PUCP (oficial)",
    materia: "General",
    descripcion: "Simulacro oficial de la PUCP: practica lectura, redacción y matemática con el formato real de la Evaluación del Talento.",
    archivos: [{ name: "simulacro-admision-pucp", url: "https://admision.pucp.edu.pe/simulacro-de-admision" }],
    contenido_texto: "Fuente oficial: https://admision.pucp.edu.pe/simulacro-de-admision\nTipo: simulacro oficial.",
  },
  {
    universidad: "UNI",
    titulo: "Portal de Admisión UNI (oficial)",
    materia: "General",
    descripcion: "Portal oficial de admisión UNI: prospecto, cronogramas, modalidades (IEN, ordinaria, extraordinaria) y vacantes. Punto de partida para tu preparación.",
    archivos: [{ name: "portal-admision-uni", url: "https://admision.uni.edu.pe/" }],
    contenido_texto: "Fuente oficial: https://admision.uni.edu.pe/\nTipo: portal oficial (prospecto y cronogramas).",
  },
  {
    universidad: "La Molina",
    titulo: "Portal de Admisión UNALM (oficial)",
    materia: "General",
    descripcion: "Portal oficial de admisión de La Molina: prospecto, examen ordinario, cronogramas y guía del postulante.",
    archivos: [{ name: "portal-admision-unalm", url: "https://www.lamolina.edu.pe/admision/" }],
    contenido_texto: "Fuente oficial: https://www.lamolina.edu.pe/admision/\nTipo: portal oficial.",
  },
  {
    universidad: "San Martín",
    titulo: "Portal de Admisión USMP (oficial)",
    materia: "General",
    descripcion: "Portal oficial de admisión USMP: modalidades, examen ordinario, reglamento y prospecto por carrera.",
    archivos: [{ name: "portal-admision-usmp", url: "https://admision.usmp.edu.pe/" }],
    contenido_texto: "Fuente oficial: https://admision.usmp.edu.pe/\nTipo: portal oficial + reglamento de admisión.",
  },
  {
    universidad: "Pacifico",
    titulo: "Portal de Admisión UP (oficial)",
    materia: "General",
    descripcion: "Portal oficial de admisión de la Universidad del Pacífico: modalidades, prueba de aptitud, entrevistas y cronogramas.",
    archivos: [{ name: "portal-admision-up", url: "https://admision.up.edu.pe/" }],
    contenido_texto: "Fuente oficial: https://admision.up.edu.pe/\nTipo: portal oficial.",
  },
];

const EXAMENES = [
  {
    universidad: "UNI",
    titulo: "Simulacros IEN UNI (en plataforma)",
    year: 2026,
    materia: "General",
    descripcion: "Rinde los simulacros IEN de 65 preguntas en la pestaña Simulacro IEN: calificación real, solucionario y orden de mérito. Los exámenes pasados en PDF se agregan aquí cuando los agentes los localizan.",
    contenido_texto: "Práctica disponible en plataforma: pestaña Simulacro IEN.",
    archivos: [],
  },
  {
    universidad: "San Marcos",
    titulo: "Simulacro Presencial OCA (práctica oficial)",
    year: 2027,
    materia: "General",
    descripcion: "Inscríbete al simulacro presencial oficial de la OCA para medirte con las reglas reales. Detalles y fechas en el enlace adjunto.",
    contenido_texto: "Fuente: https://admision.unmsm.edu.pe/portal/simulacro-presencial-2027-i/",
    archivos: [{ name: "simulacro-oca-unmsm", url: "https://admision.unmsm.edu.pe/portal/simulacro-presencial-2027-i/" }],
  },
  {
    universidad: "Católica",
    titulo: "Simulacro de Admisión PUCP (práctica oficial)",
    year: 2026,
    materia: "General",
    descripcion: "Practica con el simulacro oficial PUCP (lectura, redacción y matemática) antes de tu Evaluación del Talento.",
    contenido_texto: "Fuente: https://admision.pucp.edu.pe/simulacro-de-admision",
    archivos: [{ name: "simulacro-admision-pucp", url: "https://admision.pucp.edu.pe/simulacro-de-admision" }],
  },
];

async function existe(tabla, titulo, H, base) {
  const r = await fetch(`${base}/rest/v1/${tabla}?titulo=eq.${encodeURIComponent(titulo)}&select=id&limit=1`, { headers: H });
  if (!r.ok) return false;
  return (await r.json()).length > 0;
}

(async () => {
  const { url, key } = leerEnv();
  if (!url || !key) {
    console.log("FALTA .env con SUPABASE_URL y SUPABASE_SERVICE_KEY. Nada que insertar.");
    process.exit(1);
  }
  const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" };
  let ins = { temarios: 0, materiales: 0, examenes: 0 }, om = 0;

  for (const t of TEMARIOS) {
    if (await existe("temarios", t.titulo, H, url)) { om++; continue; }
    const r = await fetch(`${url}/rest/v1/temarios`, { method: "POST", headers: H, body: JSON.stringify(t) });
    if (r.ok) ins.temarios++; else console.log("temario FAIL", r.status);
  }
  for (const m of MATERIALES) {
    if (await existe("materiales_referencia", m.titulo, H, url)) { om++; continue; }
    const r = await fetch(`${url}/rest/v1/materiales_referencia`, { method: "POST", headers: H, body: JSON.stringify(m) });
    if (r.ok) ins.materiales++; else console.log("material FAIL", r.status);
  }
  for (const e of EXAMENES) {
    if (await existe("examenes", e.titulo, H, url)) { om++; continue; }
    const r = await fetch(`${url}/rest/v1/examenes`, { method: "POST", headers: H, body: JSON.stringify(e) });
    if (r.ok) ins.examenes++; else console.log("examen FAIL", r.status);
  }
  console.log(`SEED OK: temarios=${ins.temarios} materiales=${ins.materiales} examenes=${ins.examenes} omitidos(ya existían)=${om}`);
})();
