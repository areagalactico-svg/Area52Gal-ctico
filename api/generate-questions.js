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

  if (type === 'simulacro') {
    const topicDescription = topic === 'Examen Completo IEN' 
      ? 'Genera un examen completo del IEN con preguntas distribuidas así: Matemática (6 preguntas), Física (5 preguntas), Química (5 preguntas), Razonamiento Verbal (7 preguntas), Razonamiento Matemático (7 preguntas). Total: 30 preguntas.'
      : `Genera exactamente ${numQuestions} preguntas de opción múltiple sobre el área: ${topic}`;

    systemPrompt = `Eres un generador de preguntas para el Examen de Ingreso Escolar Nacional (IEN) de la Universidad Nacional de Ingeniería (UNI) de Perú.

El examen IEN consta de las siguientes áreas:
1. MATEMÁTICA: Aritmética, Álgebra, Geometría, Trigonometría, Estadística
2. FÍSICA: Mecánica, Electricidad, Magnetismo, Óptica, Ondas
3. QUÍMICA: Química General, Química Orgánica, Química Inorgánica, Estequiometría
4. RAZONAMIENTO VERBAL: Comprensión lectora, Analogías verbales, Ortografía
5. RAZONAMIENTO MATEMÁTICO: Secuencias numéricas, Problemas lógicos, Razonamiento abstracto

${topicDescription}

FORMATO JSON VÁLIDO (sin markdown, sin backticks):
{
  "preguntas": [
    {
      "texto": "Texto de la pregunta",
      "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "respuestaCorrecta": 0,
      "area": "Matemática",
      "explicacion": "Breve explicación de la respuesta correcta"
    }
  ]
}

REGLAS:
- Las preguntas deben ser de nivel ingreso universitario (16-18 años)
- Cada pregunta tiene exactamente 4 opciones
- respuestaCorrecta es el índice (0-3) de la opción correcta
- El campo "area" indica a qué área del examen IEN pertenece
- Incluye una explicación breve para cada respuesta
- Varía la dificultad: 30% fáciles, 50% medias, 20% difíciles
- No repitas conceptos entre preguntas
- Usa el contexto de referencia si está disponible para guiar la dificultad`;
  } else {
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
          { role: 'user', content: topic === 'Examen Completo IEN' 
            ? `Genera un examen completo del IEN con 30 preguntas distribuidas: 6 Matemática, 5 Física, 5 Química, 7 Razonamiento Verbal, 7 Razonamiento Matemático. ${context ? 'Usa el contexto de referencia para guiar la dificultad.' : ''}`
            : `Genera ${numQuestions} preguntas del área "${topic}" para el examen IEN de la UNI. ${context ? 'Usa el contexto de referencia para guiar la dificultad.' : ''}` }
        ],
        max_tokens: 4096,
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
