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

  const { topic, type, count } = req.body;

  if (!topic || !type) {
    return res.status(400).json({ error: 'Topic and type are required' });
  }

  const API_KEY = process.env.OPENROUTER_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const numQuestions = Math.min(Math.max(count || 5, 1), 20);

  let systemPrompt = '';

  if (type === 'simulacro') {
    systemPrompt = `Eres un generador de preguntas de examen para el examen de ingreso a la UNI (Universidad Nacional de Ingeniería) de Perú.

Genera exactamente ${numQuestions} preguntas de opción múltiple sobre: ${topic}

Formato de respuesta JSON válido (sin markdown, sin backticks):
{
  "preguntas": [
    {
      "texto": "Texto de la pregunta",
      "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "respuestaCorrecta": 0,
      "explicacion": "Breve explicación de la respuesta correcta"
    }
  ]
}

Reglas:
- Las preguntas deben ser de nivel universitario/ingreso
- Cada pregunta tiene exactamente 4 opciones
- respuestaCorrecta es el índice (0-3) de la opción correcta
- Incluye una explicación breve para cada respuesta
- Varía la dificultad: algunas fáciles, algunas difíciles
- No repitas conceptos entre preguntas`;
  } else {
    systemPrompt = `Eres un generador de preguntas de test vocacional para estudiantes que quieren ingresar a la UNI.

Genera exactamente ${numQuestions} preguntas de opción múltiple sobre: ${topic}

Formato de respuesta JSON válido (sin markdown, sin backticks):
{
  "preguntas": [
    {
      "texto": "Texto de la pregunta",
      "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "respuestaCorrecta": 0,
      "area": "nombre del área que evalúa"
    }
  ]
}

Reglas:
- Las preguntas deben evaluar habilidades, intereses o conocimientos relevantes para carreras de ingeniería
- Cada pregunta tiene exactamente 4 opciones
- respuestaCorrecta es el índice (0-3) de la opción que mejor representa el perfil
- Incluye un campo "area" que indique qué habilidad o área se evalúa
- Las preguntas deben ser claras y no ambiguas
- Varía los tipos: preferencias, situaciones, habilidades, valores`;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://area52-uni.vercel.app',
        'X-Title': 'Área 52 UNI'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera ${numQuestions} preguntas de ${type} sobre: ${topic}` }
        ],
        max_tokens: 4096,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter error:', response.status, errorData);
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
