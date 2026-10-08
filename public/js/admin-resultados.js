// ============================================================
// Admin — Resultados globales + Agentes recolectores + Guías
// Se carga DESPUÉS de admin.js. Usa el mismo supabase client.
// ============================================================
import { supabase } from "./supabase-config.js";

let RES_ALL = [];       // submissions + simulacro titulo
let RES_SIMULACROS = []; // {id, titulo}

/* ---------- RESULTADOS Y ORDEN DE MÉRITO ---------- */

async function cargarSimulacrosParaFiltro() {
  const sel = document.getElementById("res-simulacro");
  if (!sel) return;
  const { data } = await supabase.from("simulacros_ien").select("id, titulo").order("fecha", { ascending: false }).limit(100);
  RES_SIMULACROS = data || [];
  sel.innerHTML = `<option value="ALL">Todos los simulacros</option>` + RES_SIMULACROS.map((s) => `<option value="${s.id}">${escapeHtml(s.titulo || "Sin título")}</option>`).join("");
}

function correctasDe(s) {
  try {
    const ar = s.area_results || {};
    return Object.values(ar).reduce((sum, a) => sum + (a.correct || 0), 0);
  } catch { return 0; }
}

async function cargarResultados() {
  const wrap = document.getElementById("res-tabla-wrap");
  const resumen = document.getElementById("res-resumen");
  if (!wrap) return;
  wrap.innerHTML = `<p style="color:#888; padding:1rem;">Cargando notas de estudiantes...</p>`;

  const sel = document.getElementById("res-simulacro");
  const filtroSim = sel ? sel.value : "ALL";
  const q = (document.getElementById("res-buscar")?.value || "").toLowerCase().trim();

  let query = supabase.from("simulacro_submissions").select("*").order("nota", { ascending: false }).order("puntaje", { ascending: false }).order("tiempo_segundos", { ascending: true }).limit(1000);
  if (filtroSim && filtroSim !== "ALL") query = query.eq("simulacro_id", filtroSim);
  const { data, error } = await query;
  if (error) {
    wrap.innerHTML = `<p style="color:#e74c3c; padding:1rem;">Error: ${escapeHtml(error.message)}</p>`;
    return;
  }
  const titulos = Object.fromEntries(RES_SIMULACROS.map((s) => [s.id, s.titulo]));
  let rows = (data || []).map((s) => ({ ...s, _simTitulo: titulos[s.simulacro_id] || s.simulacro_id?.slice(0, 8) || "-" }));
  if (q) {
    rows = rows.filter((s) => `${s.nombre_completo || ""} ${s.estudiante_email || ""} ${s.whatsapp || ""}`.toLowerCase().includes(q));
  }
  RES_ALL = rows;

  // Resumen
  if (resumen) {
    const n = rows.length;
    const prom = n ? rows.reduce((a, s) => a + Number(s.nota || 0), 0) / n : 0;
    const aprob = rows.filter((s) => Number(s.nota || 0) >= 11).length;
    const top = rows[0];
    resumen.innerHTML = `
      <div class="stat-card" style="flex:1; min-width:140px;"><h3>${n}</h3><p>Estudiantes</p></div>
      <div class="stat-card" style="flex:1; min-width:140px;"><h3>${prom.toFixed(1)}</h3><p>Nota promedio /20</p></div>
      <div class="stat-card" style="flex:1; min-width:140px;"><h3>${aprob}</h3><p>Aprobados (≥11)</p></div>
      <div class="stat-card" style="flex:2; min-width:200px;"><h3 style="font-size:1rem;">${top ? escapeHtml(top.nombre_completo || "—") + " · " + Number(top.nota || 0).toFixed(1) : "—"}</h3><p>Primer puesto actual</p></div>`;
  }

  if (!rows.length) {
    wrap.innerHTML = `<p style="color:#888; padding:1.5rem; text-align:center;">Sin resultados todavía. Cuando un estudiante entregue un simulacro aparecerá aquí con su nota y puesto.</p>`;
    return;
  }

  let html = `<table style="width:100%; border-collapse:collapse; font-size:0.85rem; min-width:900px;">
    <thead><tr style="background:#1a1a2e; color:white;">
      <th style="padding:0.7rem; text-align:left;">Orden</th>
      <th style="padding:0.7rem; text-align:left;">Nombre</th>
      <th style="padding:0.7rem; text-align:left;">Número (WhatsApp)</th>
      <th style="padding:0.7rem; text-align:left;">Correo</th>
      <th style="padding:0.7rem; text-align:left;">Simulacro</th>
      <th style="padding:0.7rem; text-align:center;">Nota /20</th>
      <th style="padding:0.7rem; text-align:center;">Puntaje</th>
      <th style="padding:0.7rem; text-align:center;">%</th>
      <th style="padding:0.7rem; text-align:center;">Tiempo</th>
      <th style="padding:0.7rem; text-align:center;">Fecha</th>
    </tr></thead><tbody>`;
  rows.forEach((s, i) => {
    const medal = i === 0 ? "🥇 1" : i === 1 ? "🥈 2" : i === 2 ? "🥉 3" : `${i + 1}`;
    const bg = i < 3 ? "#fff9e6" : i % 2 === 0 ? "#f8f9fa" : "white";
    const t = Math.floor((s.tiempo_segundos || 0) / 60) + ":" + String((s.tiempo_segundos || 0) % 60).padStart(2, "0");
    const fecha = s.fecha_fin ? new Date(s.fecha_fin).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
    const wa = s.whatsapp ? `<a href="https://wa.me/51${encodeURIComponent(s.whatsapp)}" target="_blank" style="color:#25d366; font-weight:600;">${escapeHtml(s.whatsapp)}</a>` : "—";
    html += `<tr style="background:${bg}; border-bottom:1px solid #eee;">
      <td style="padding:0.6rem; font-weight:bold;">${medal}</td>
      <td style="padding:0.6rem; font-weight:600;">${escapeHtml(s.nombre_completo || "Sin nombre")}</td>
      <td style="padding:0.6rem;">${wa}</td>
      <td style="padding:0.6rem; color:#555;">${escapeHtml(s.estudiante_email || "—")}</td>
      <td style="padding:0.6rem; color:#888;">${escapeHtml(s._simTitulo || "—")}</td>
      <td style="padding:0.6rem; text-align:center; font-weight:bold; color:${Number(s.nota || 0) >= 11 ? "#00a37a" : "#ff6b6b"}; font-size:1rem;">${Number(s.nota || 0).toFixed(1)}</td>
      <td style="padding:0.6rem; text-align:center;">${Number(s.puntaje || 0).toFixed(2)}</td>
      <td style="padding:0.6rem; text-align:center;">${s.porcentaje || 0}%</td>
      <td style="padding:0.6rem; text-align:center;">${t}</td>
      <td style="padding:0.6rem; text-align:center; color:#888;">${fecha}</td>
    </tr>`;
  });
  wrap.innerHTML = html + "</tbody></table>";
}

function exportarCSV() {
  if (!RES_ALL.length) { alert("No hay datos para exportar."); return; }
  const head = ["orden", "nombre", "numero_whatsapp", "correo", "simulacro", "nota_20", "puntaje", "porcentaje", "correctas", "tiempo_seg", "fecha_fin"];
  const lines = [head.join(",")];
  RES_ALL.forEach((s, i) => {
    const cells = [i + 1, s.nombre_completo || "", s.whatsapp || "", s.estudiante_email || "", (s._simTitulo || "").replace(/,/g, ";"), Number(s.nota || 0).toFixed(2), Number(s.puntaje || 0).toFixed(2), s.porcentaje || 0, correctasDe(s), s.tiempo_segundos || 0, s.fecha_fin || ""];
    lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `merito-area52-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- AGENTES ---------- */

async function correrAgentes() {
  const btn = document.getElementById("ag-run");
  const status = document.getElementById("ag-status");
  const box = document.getElementById("ag-resultados");
  const uni = document.getElementById("ag-uni")?.value || "ALL";
  const save = document.getElementById("ag-save")?.checked === true;
  btn.disabled = true;
  btn.textContent = "Recolectando... (puede tardar 1-2 min)";
  status.textContent = `🤖 Agentes visitando páginas oficiales de ${uni === "ALL" ? "las 6 universidades" : uni}...`;
  box.innerHTML = "";
  try {
    const r = await fetch("/api/agents-collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ universidad: uni, save, maxPages: 8 }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Error del servidor");
    status.innerHTML = `✅ <strong>${data.total_hallazgos}</strong> materiales hallados ${data.guardados ? `· <strong>${data.guardados}</strong> guardados en Supabase` : ""} ${data.saveError ? `· ⚠️ ${escapeHtml(data.saveError)}` : ""}`;
    box.innerHTML = (data.resultados || []).map((g) => `
      <div class="card" style="margin-bottom:0.8rem;">
        <h4>${escapeHtml(g.universidad)} — ${g.hallazgos.length} hallazgos <span style="color:#888; font-weight:400;">(${g.visitas.filter((v) => v.ok).length}/${g.visitas.length} páginas OK)</span></h4>
        ${g.hallazgos.length ? `<div style="margin-top:0.5rem; display:flex; flex-direction:column; gap:0.4rem;">` + g.hallazgos.slice(0, 20).map((h) => `
          <div style="display:flex; gap:0.6rem; align-items:center; background:#f8f9fa; border-radius:8px; padding:0.5rem 0.7rem; font-size:0.85rem;">
            <span style="background:#e8f5e9; color:#2e7d32; padding:0.15rem 0.5rem; border-radius:4px; font-size:0.72rem; white-space:nowrap;">${escapeHtml(h.tipo)}</span>
            <span style="background:#eef; color:#334; padding:0.15rem 0.5rem; border-radius:4px; font-size:0.72rem; white-space:nowrap;">${escapeHtml(h.materia_sugerida)}</span>
            <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(h.titulo)}">${escapeHtml(h.titulo)}</span>
            <a href="${escapeHtml(h.url_pdf)}" target="_blank" class="btn btn-sm">Ver PDF</a>
          </div>`).join("") + (g.hallazgos.length > 20 ? `<p style="color:#888; font-size:0.8rem;">…y ${g.hallazgos.length - 20} más (ver JSON completo en la respuesta del API).</p>` : "") + `</div>`
        : `<p style="color:#888;">Sin hallazgos esta vez (las webs pudieron bloquear el bot o cambiar de URL). Prueba de nuevo o súbelos manualmente en Exámenes/Materiales.</p>`}
      </div>`).join("");
  } catch (e) {
    status.innerHTML = `❌ Error: ${escapeHtml(e.message)}`;
  } finally {
    btn.disabled = false;
    btn.textContent = "▶ Recolectar ahora";
  }
}

/* ---------- GUÍAS ---------- */

async function cargarGuias() {
  const box = document.getElementById("guias-list");
  if (!box) return;
  const { data, error } = await supabase.from("guias_personalizadas").select("*").order("created_at", { ascending: false }).limit(30);
  if (error) {
    box.innerHTML = `<div class="card"><p style="color:#888;">Aún no hay guías (se crea la tabla con <code>supabase-agentes-guias.sql</code>). ${escapeHtml(error.message)}</p></div>`;
    return;
  }
  if (!data?.length) {
    box.innerHTML = `<div class="card"><p style="color:#888; text-align:center;">Sin guías todavía. Se generan automáticamente cuando el estudiante pulsa “Generar mi guía” tras su simulacro.</p></div>`;
    return;
  }
  box.innerHTML = "";
  data.forEach((g) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<div class="item-info"><h4>${escapeHtml(g.nombre_completo || g.estudiante_email || "Estudiante")} · ${Number(g.nota || 0).toFixed(1)}/20 · ${escapeHtml(g.universidad || "")}</h4>
      <p>${escapeHtml((g.focos || []).join(" · ").slice(0, 140))}</p></div>
      <div class="item-actions"><button class="btn btn-sm">Ver guía</button></div>`;
    div.querySelector("button").onclick = () => {
      const w = window.open("", "_blank");
      w.document.write(`<html><head><meta charset="utf-8"><title>Guía ${escapeHtml(g.nombre_completo || "")}</title></head><body style="font-family:sans-serif; max-width:800px; margin:2rem auto; padding:0 1rem;"><h1>Guía personalizada — ${escapeHtml(g.nombre_completo || "")} (${Number(g.nota || 0).toFixed(1)}/20)</h1><pre style="white-space:pre-wrap;">${escapeHtml(g.guia_markdown || "")}</pre></body></html>`);
    };
    box.appendChild(div);
  });
}

/* ---------- INIT ---------- */
document.getElementById("res-simulacro")?.addEventListener("change", cargarResultados);
document.getElementById("res-buscar")?.addEventListener("input", () => clearTimeout(window.__resT) || (window.__resT = setTimeout(cargarResultados, 300)));
document.getElementById("res-exportar")?.addEventListener("click", exportarCSV);
document.getElementById("ag-run")?.addEventListener("click", correrAgentes);

// Polling suave: refresca resultados cuando se abre la pestaña
document.querySelectorAll('.tab-btn[data-tab="resultados"]').forEach((b) => b.addEventListener("click", async () => {
  if (!RES_SIMULACROS.length) await cargarSimulacrosParaFiltro();
  cargarResultados(); cargarGuias();
}));
document.querySelectorAll('.tab-btn[data-tab="agentes"]').forEach((b) => b.addEventListener("click", cargarGuias));
cargarSimulacrosParaFiltro();
