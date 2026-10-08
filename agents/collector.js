// ============================================================
// Agente recolector Área 52 — Núcleo de scraping (zero dependencias)
// Uso local:  node agents/run-collect.js --uni=UNI --save
// Uso Vercel: la misma lógica vive en /api/agents-collect.js
// ============================================================
// Respeta robots y solo lee páginas públicas (GET HTML).
// No descarga PDFs completos: guarda URL + metadatos para que el
// admin los revise y la IA los use como contexto.

const { UNIVERSIDADES, REPOSITORIOS_PUBLICOS, KEYWORDS_MATERIAL } = require("./config.cjs");

const FETCH_TIMEOUT_MS = 15000;
const UA = "Area52-UniBot/1.0 (+https://area52.online; contacto: admin@area52.online)";

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return { url, ok: false, status: res.status, html: "" };
    const html = await res.text();
    return { url, ok: true, status: 200, html: html.slice(0, 600000) };
  } catch (e) {
    return { url, ok: false, status: 0, html: "", error: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

function extractLinks(html, baseUrl) {
  const out = [];
  const re = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = (m[1] || "").trim();
    const text = (m[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    try {
      const abs = new URL(href, baseUrl).toString();
      if (!abs.startsWith("http")) continue;
      out.push({ href: abs, texto: text });
    } catch { /* ignore */ }
  }
  // quitar duplicados
  const seen = new Set();
  return out.filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)));
}

function esMaterialUtil(link) {
  const blob = `${link.href} ${link.texto}`.toLowerCase();
  const esPdf = /\.pdf(\?|$)/i.test(link.href);
  const tieneKeyword = KEYWORDS_MATERIAL.some((k) => blob.includes(k));
  if (esPdf && tieneKeyword) return { util: true, razon: "PDF con palabra clave de examen/admisión" };
  if (esPdf && /uni|san.?marcos|unmsm|pucp|catolica|molina|unalm|usmp|pacifico|admision/i.test(blob)) {
    return { util: true, razon: "PDF de dominio universitario/admisión" };
  }
  if (!esPdf && tieneKeyword && /temario|prospecto|modelo|simulacro|examen/i.test(blob)) {
    return { util: true, razon: "Página de temario/modelo/examen (revisar y convertir a material)" };
  }
  return { util: false };
}

function inferirTipo(link) {
  const b = `${link.href} ${link.texto}`.toLowerCase();
  if (b.includes("solucionario") || b.includes("resuelto")) return "solucionario";
  if (b.includes("prospecto")) return "prospecto";
  if (b.includes("temario")) return "temario";
  if (b.includes("modelo")) return "examen_modelo";
  if (b.includes("simulacro")) return "simulacro";
  if (b.includes("guia") || b.includes("guía") || b.includes("banco")) return "guia_estudio";
  return "examen_pasado";
}

function inferirMateria(link, materiasUni) {
  const b = `${link.href} ${link.texto}`.toLowerCase();
  for (const mat of materiasUni) {
    const clave = mat.toLowerCase().split(" ")[0];
    if (clave.length >= 4 && b.includes(clave)) return mat;
  }
  return "General";
}

// Recolecta para UNA universidad: visita sus fuentes oficiales y
// extrae enlaces útiles. Devuelve { universidad, hallazgos[], visitas[] }
async function recolectarUniversidad(uni, opts = {}) {
  const visitas = [];
  const hallazgos = [];
  const urls = [...uni.fuentes.map((f) => f.url)];
  if (opts.incluirRepos !== false) {
    for (const r of REPOSITORIOS_PUBLICOS) if (!urls.includes(r)) urls.push(r);
  }
  const limit = opts.maxPages || 8;
  for (const url of urls.slice(0, limit)) {
    const r = await fetchHtml(url);
    visitas.push({ url, ok: r.ok, status: r.status, error: r.error || null });
    if (!r.ok) continue;
    const links = extractLinks(r.html, url);
    for (const l of links) {
      const ev = esMaterialUtil(l);
      if (!ev.util) continue;
      hallazgos.push({
        universidad: uni.id,
        titulo: l.texto || `Material ${uni.id} — ${inferirTipo(l)}`,
        url_pdf: l.href,
        url_fuente: url,
        tipo: inferirTipo(l),
        materia_sugerida: inferirMateria(l, uni.materias),
        evidencia: ev.razon,
        fecha_hallazgo: new Date().toISOString(),
      });
    }
  }
  // dedup por url_pdf
  const seen = new Set();
  const unicos = hallazgos.filter((h) => (seen.has(h.url_pdf) ? false : (seen.add(h.url_pdf), true)));
  return { universidad: uni.id, visitas, hallazgos: unicos.slice(0, 60), total: unicos.length };
}

async function recolectarTodo(opts = {}) {
  const solo = (opts.uni || "").trim();
  const lista = solo ? UNIVERSIDADES.filter((u) => u.id.toLowerCase() === solo.toLowerCase()) : UNIVERSIDADES;
  const resultados = [];
  for (const uni of lista.length ? lista : UNIVERSIDADES) {
    // eslint-disable-next-line no-await-in-loop
    const r = await recolectarUniversidad(uni, opts);
    resultados.push(r);
  }
  return {
    fecha: new Date().toISOString(),
    total_hallazgos: resultados.reduce((s, r) => s + r.hallazgos.length, 0),
    resultados,
  };
}

module.exports = { fetchHtml, extractLinks, recolectarUniversidad, recolectarTodo };
