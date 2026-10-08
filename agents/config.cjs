// ============================================================
// Agentes recolectores Área 52 — Configuración por universidad (CJS)
// ============================================================

const UNIVERSIDADES = [
  {
    id: "UNI",
    nombre: "Universidad Nacional de Ingeniería",
    siglas: "UNI",
    examen: "IEN (Ingreso Escolar Nacional) + Examen Ordinario",
    estructura: "PE1 Aptitud (35) + PE2 Matemática + PE3 Física/Química. 65 preg, 5 opciones A-E.",
    materias: ["Matemática", "Física", "Química", "Razonamiento Matemático", "Razonamiento Verbal", "Humanidades"],
    fuentes: [
      { tipo: "oficial", nombre: "Admisión UNI", url: "https://admision.uni.edu.pe/" },
      { tipo: "oficial", nombre: "UNI - Pregrado", url: "https://www.uni.edu.pe/" },
      { tipo: "temario", nombre: "Prospecto / Temario UNI", url: "https://admision.uni.edu.pe/prospecto" },
    ],
    queries: [
      "examen admision UNI PDF",
      "examen IEN UNI solucionario PDF",
      "prospecto UNI temario PDF",
      "examen ordinario UNI resuelto",
    ],
  },
  {
    id: "San Marcos",
    nombre: "Universidad Nacional Mayor de San Marcos",
    siglas: "UNMSM",
    examen: "Examen de Admisión (100 preg, 5 áreas)",
    estructura: "Habilidad verbal/matemática + Conocimientos. Descuento por errada.",
    materias: ["Habilidad Verbal", "Habilidad Matemática", "Matemática", "Física", "Química", "Historia", "Geografía", "Literatura"],
    fuentes: [
      { tipo: "oficial", nombre: "OCA San Marcos", url: "https://admision.unmsm.edu.pe/" },
      { tipo: "oficial", nombre: "UNMSM", url: "https://www.unmsm.edu.pe/" },
    ],
    queries: ["examen admision San Marcos PDF resuelto", "prospecto San Marcos temario PDF"],
  },
  {
    id: "Católica",
    nombre: "Pontificia Universidad Católica del Perú",
    siglas: "PUCP",
    examen: "Evaluación del Talento + Admisión general",
    estructura: "Lectura, Redacción, Matemática. Sin descuento.",
    materias: ["Lectura", "Redacción", "Matemática"],
    fuentes: [
      { tipo: "oficial", nombre: "Admisión PUCP", url: "https://admision.pucp.edu.pe/" },
      { tipo: "modelo", nombre: "Modelos de examen PUCP", url: "https://admision.pucp.edu.pe/modalidades/evaluacion-del-talento/" },
    ],
    queries: ["examen talento PUCP Católica modelo PDF", "temario admision Catolica PUCP PDF"],
  },
  {
    id: "La Molina",
    nombre: "Universidad Nacional Agraria La Molina",
    siglas: "UNALM",
    examen: "Examen Ordinario UNALM",
    estructura: "Aptitud + Conocimientos (Mate, Física, Química, Biología).",
    materias: ["Matemática", "Física", "Química", "Biología", "Razonamiento Verbal", "Razonamiento Matemático"],
    fuentes: [{ tipo: "oficial", nombre: "Admisión UNALM", url: "https://www.lamolina.edu.pe/admision/" }],
    queries: ["examen admision La Molina UNALM PDF", "prospecto UNALM temario PDF"],
  },
  {
    id: "San Martín",
    nombre: "Universidad de San Martín de Porres",
    siglas: "USMP",
    examen: "Examen Ordinario USMP",
    estructura: "Aptitud + Conocimientos por carrera.",
    materias: ["Razonamiento Verbal", "Razonamiento Matemático", "Matemática", "Cultura General"],
    fuentes: [{ tipo: "oficial", nombre: "Admisión USMP", url: "https://admision.usmp.edu.pe/" }],
    queries: ["examen admision USMP PDF", "prospecto USMP temario"],
  },
  {
    id: "Pacifico",
    nombre: "Universidad del Pacífico",
    siglas: "UP",
    examen: "Admisión Integral Pacífico",
    estructura: "Aptitud matemática/verbal + ensayos.",
    materias: ["Matemática", "Comprensión Lectora", "Economía básica"],
    fuentes: [{ tipo: "oficial", nombre: "Admisión UP", url: "https://admision.up.edu.pe/" }],
    queries: ["examen admision Pacifico modelo PDF", "temario admision UP Pacifico"],
  },
];

const REPOSITORIOS_PUBLICOS = [
  "https://admision.uni.edu.pe/",
  "https://admision.unmsm.edu.pe/",
  "https://admision.pucp.edu.pe/",
  "https://www.lamolina.edu.pe/admision/",
  "https://admision.usmp.edu.pe/",
  "https://admision.up.edu.pe/",
];

const KEYWORDS_MATERIAL = [
  "examen", "admision", "admisión", "solucionario", "prospecto",
  "temario", "modelo", "simulacro", "ingreso", "ordinario", "talento",
  "ien", "resuelto", "guia", "guía", "banco",
];

module.exports = { UNIVERSIDADES, REPOSITORIOS_PUBLICOS, KEYWORDS_MATERIAL };
