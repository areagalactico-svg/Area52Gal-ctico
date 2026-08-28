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

  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const API_KEY = process.env.OPENROUTER_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const systemPrompt = `Eres el asistente virtual de Área 52 UNI, un centro de asesoría y preparación académica ubicado en San Martín de Porres, Lima, Perú.

Tu función es ayudar a estudiantes con:
- Dudas sobre temas de matemáticas (Cálculo I-III, Álgebra Lineal), física, química
- Información sobre los cursos y servicios de Área 52 UNI
- Consejos de estudio para el examen de ingreso a la UNI (Universidad Nacional de Ingeniería)
- Orientación vocacional sobre carreras de ingeniería

Reglas:
- Responde en español de forma clara y didáctica
- Sé conciso pero completo
- Si no sabes algo, di que no tienes esa información
- No inventes información sobre precios o fechas específicas
- Usa fórmulas matemáticas en texto plano cuando sea necesario (ej: x², ∫, etc.)
- Saluda cordialmente y despídete de forma amigable`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: message }
    ];

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
        messages,
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter error:', response.status, errorData);
      return res.status(502).json({ error: 'Error from AI service' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
