// ============================================================
// Configuración única del proveedor de IA ( Área 52 UNI )
//
//   AI_PROVIDER=deepseek   → API OFICIAL de DeepSeek
//                            https://api.deepseek.com/chat/completions
//                            (créditos comprados en platform.deepseek.com)
//   AI_PROVIDER=openrouter → OpenRouter con modelos ":free" gratuitos
//
// Sin AI_PROVIDER se deduce de OPENROUTER_BASE_URL (si contiene
// "deepseek" se usa DeepSeek) y, si no, se mantiene OpenRouter por
// compatibilidad con lo que ya estaba configurado.
//
// Variables:
//   DEEPSEEK_API_KEY / DEEPSEEK_MODEL / DEEPSEEK_BASE_URL
//   OPENROUTER_API_KEY / OPENROUTER_MODEL / OPENROUTER_BASE_URL /
//   OPENROUTER_MODELS / OPENROUTER_REASONING_EFFORT / OPENROUTER_TIMEOUT_MS
// ============================================================

function esDeepSeek() {
  const p = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (p === "deepseek") return true;
  if (p === "openrouter" || p === "free") return false;
  if (String(process.env.OPENROUTER_BASE_URL || "").includes("deepseek")) return true;
  return false;
}

function url() {
  if (esDeepSeek()) {
    return process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions";
  }
  return process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1/chat/completions";
}

function key() {
  return esDeepSeek()
    ? process.env.DEEPSEEK_API_KEY || process.env.OPENROUTER_API_KEY
    : process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY;
}

function model() {
  if (esDeepSeek()) {
    return process.env.DEEPSEEK_MODEL || process.env.OPENROUTER_MODEL || "deepseek-chat";
  }
  return process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
}

// Tope de "max_tokens" que soporta el proveedor.
// deepseek-chat emite como máximo 8192 tokens de salida.
function topeMaxTokens() {
  return esDeepSeek() ? 8192 : 65536;
}

// Presupuesto de tokens de salida para N preguntas.
function maxTokensPara(n) {
  if (esDeepSeek()) return Math.min(8192, Math.max(4096, Math.ceil(Number(n) * 800)));
  return Math.min(32768, Math.max(16384, Math.ceil(Number(n) * 1600)));
}

// Campos extra del body según proveedor. DeepSeek no entiende el
// parámetro "reasoning" de OpenRouter, así que solo se envía ahí.
function extraBody() {
  if (esDeepSeek()) return {};
  const effort = String(process.env.OPENROUTER_REASONING_EFFORT || "low").trim();
  return effort && effort !== "off" ? { reasoning: { effort } } : {};
}

function headers() {
  const h = {
    Authorization: `Bearer ${key()}`,
    "Content-Type": "application/json",
  };
  if (!esDeepSeek()) {
    // OpenRouter usa estas cabeceras para atribuir el sitio
    h["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL || "https://area52uni.com";
    h["X-Title"] = process.env.OPENROUTER_SITE_NAME || "Area 52 UNI";
  }
  return h;
}

module.exports = { esDeepSeek, url, key, model, topeMaxTokens, maxTokensPara, extraBody, headers };
