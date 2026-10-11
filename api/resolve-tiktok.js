// ============================================================
// API: POST /api/resolve-tiktok
// Resuelve enlaces acortados (vt.tiktok.com, vm.tiktok.com) o con
// formato /t/ siguiendo redirecciones hasta el video canónico.
// Body: { url }
// Responde: { id, canonical }  (id numérico para el embed)
// ============================================================

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  let url = String(body.url || "").trim();
  if (!url) return res.status(400).json({ error: "Falta url" });
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  if (!/tiktok\.com/i.test(url)) return res.status(400).json({ error: "No es un enlace de TikTok" });

  // ID directo sin necesidad de red
  let m = url.match(/\/video\/(\d{5,})/);
  if (m) return res.status(200).json({ id: m[1], canonical: url });

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    clearTimeout(t);
    const final = r.url || url;
    m = final.match(/\/video\/(\d{5,})/);
    if (m) return res.status(200).json({ id: m[1], canonical: final });
    // Respaldo: buscar ID embebido en el HTML
    try {
      const html = await r.text();
      const m2 = html.match(/"id"\s*:\s*"(\d{15,})"|video\/(\d{15,})/);
      const id = m2 ? m2[1] || m2[2] : null;
      if (id) return res.status(200).json({ id, canonical: final });
    } catch {}
    return res.status(404).json({ error: "No se pudo resolver el video" });
  } catch (e) {
    return res.status(502).json({ error: "No se pudo abrir el enlace" });
  }
};
