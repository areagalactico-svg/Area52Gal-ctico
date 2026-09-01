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

  const { topic, type, count, context } = req.body;

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
        count: 60,
        prompt: `Genera un EXAMEN COMPLETO del IEN UNI con 60 preguntas distribuidas EXACTAMENTE así:
- PE1 (33 preguntas): Razonamiento Matemático (12), Razonamiento Verbal (13), Humanidades (8)
- PE2 (13 preguntas): Matemática - Aritmética (3), Álgebra (4), Geometría (3), Trigonometría (3)
- PE3 (14 preguntas): Física (7), Química (7)
Cada pregunta debe incluir el campo "area" indicando a qué prueba pertenece (PE1, PE2 o PE3) y el subtema específico.`
      },
      'PE1 - Aptitud Académica y Humanidades': {
        count: 33,
        prompt: `Genera la PE1 del IEN UNI - Aptitud Académica y Humanidades (33 preguntas):
- Razonamiento Matemático (12 preguntas): Sucesiones numéricas, análisis de figuras, conteo, lógica proposicional, juegos lógicos
- Razonamiento Verbal (13 preguntas): Comprensión lectora, analogías verbales, significado de palabras en contexto, ortografía
- Humanidades (8 preguntas): Comunicación, Lengua, Literatura, Historia del Perú y del Mundo, Geografía, Economía, Filosofía, Lógica, Ambiente
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
        count: 14,
        prompt: `Genera la PE3 del IEN UNI - Física y Química (14 preguntas):
- Física (7): Cinemática, dinámica, trabajo y energía, estática, hidrostática, termodinámica, electricidad, magnetismo, ondas, óptica, física moderna
- Química (7): Estructura atómica, tabla periódica, enlaces químicos, estequiometría, reacciones químicas, química orgánica básica
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

CONTEXTO DE MATERIALES DE REFERENCIA DEL ADMINISTRADOR:
${context || 'No hay materiales de referencia disponibles. Genera preguntas basándote en tu conocimiento del examen IEN UNI.'}

INSTRUCCIONES:
${config.prompt}

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

REGLAS IMPORTANTES:
- Nivel: Estudiantes de 5to de secundaria (16-18 años)
- El examen IEN usa 5 opciones (A-E), NO 4
- respuestaCorrecta es el índice (0-4) de la opción correcta
- Incluye "area" (PE1, PE2 o PE3) y "subtema" en cada pregunta
- Varía la dificultad: 30% fáciles, 50% medias, 20% difíciles
- Si hay materiales de referencia del administrador, úsalos como guía de estilo y dificultad
- NO repitas conceptos entre preguntas
- Preguntas tipo examen UNI: problemas con datos numéricos, interpretación de textos, análisis de situaciones`;
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
          { role: 'user', content: `Genera las ${config.count} preguntas del "${topic}" para el examen IEN de la UNI. ${context ? 'IMPORTANTE: Usa el contexto de referencia del administrador como guía para el estilo, dificultad y tipo de preguntas.' : ''}` }
        ],
        max_tokens: 16384,
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

    return res.status(200).json({ preguntas: parsed.preguntas });
  } catch (error) {
    console.error('Generate questions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
