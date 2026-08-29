import { supabase, ADMIN_EMAIL } from "./supabase-config.js";

let currentEditId = null;
let currentType = null;
let questions = [];
let existingFiles = [];

document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  setupTabs();
  document.getElementById("logout-btn").addEventListener("click", logout);
});

async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user.email === ADMIN_EMAIL) {
    showAdmin(session.user);
  } else {
    document.getElementById("login-page").style.display = "flex";
    document.getElementById("admin-panel").style.display = "none";
    document.getElementById("google-login-btn").addEventListener("click", login);
  }
}

function showAdmin(user) {
  document.getElementById("login-page").style.display = "none";
  document.getElementById("admin-panel").style.display = "block";
  document.getElementById("user-name").textContent = user.user_metadata?.full_name || user.email;
  document.getElementById("user-photo").src = user.user_metadata?.avatar_url || "";
  loadAllData();
}

async function login() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + "/admin.html" }
  });
  if (error) {
    document.getElementById("login-error").textContent = "Error: " + error.message;
    document.getElementById("login-error").style.display = "block";
  }
}

async function logout() {
  await supabase.auth.signOut();
  localStorage.removeItem("area52_user");
  location.reload();
}

function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

const COLLECTIONS = {
  tests: { table: "test_vocacionales", listId: "tests-list", type: "test" },
  simulacros: { table: "simulacros_ien", listId: "simulacros-list", type: "simulacro" },
  videos: { table: "videos", listId: "videos-list", type: "video" },
  temarios: { table: "temarios", listId: "temarios-list", type: "temario" },
  examenes: { table: "examenes", listId: "examenes-list", type: "examen" },
  materiales: { table: "materiales_referencia", listId: "materiales-list", type: "material" }
};

async function loadAllData() {
  await Promise.all([
    loadCollection("tests"),
    loadCollection("simulacros"),
    loadCollection("videos"),
    loadCollection("temarios"),
    loadCollection("examenes"),
    loadCollection("materiales")
  ]);
  updateStats();
}

async function loadCollection(key) {
  const col = COLLECTIONS[key];
  const { data, error } = await supabase
    .from(col.table)
    .select("*")
    .order("fecha", { ascending: false });

  const list = document.getElementById(col.listId);
  if (!list) return;

  if (error || !data || data.length === 0) {
    list.innerHTML = '<div class="card"><p style="color: #888; text-align: center;">No hay elementos creados aún.</p></div>';
    return;
  }

  list.innerHTML = "";
  data.forEach(item => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="item-info">
        <h4>${item.titulo || item.nombre || "Sin título"}</h4>
        <p>${item.descripcion || item.materia || item.categoria || item.curso || ""}</p>
      </div>
      <div class="item-actions">
        <button class="btn btn-sm" onclick="editItem('${col.table}', '${item.id}', '${col.type}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('${col.table}', '${item.id}')">Eliminar</button>
      </div>
    `;
    list.appendChild(div);
  });
}

async function updateStats() {
  const grid = document.getElementById("stats-grid");
  grid.innerHTML = "";
  for (const [key, col] of Object.entries(COLLECTIONS)) {
    const { count } = await supabase.from(col.table).select("*", { count: "exact", head: true });
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    grid.innerHTML += `
      <div class="stat-card">
        <h3>${count || 0}</h3>
        <p>${label}</p>
      </div>
    `;
  }
}

async function uploadFiles(files, bucket) {
  const uploaded = [];
  for (const file of files) {
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) { console.error("Upload error:", error); continue; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    uploaded.push({ name: file.name, url: data.publicUrl });
  }
  return uploaded;
}

window.openModal = async function(type, editData = null, editId = null) {
  currentType = type;
  currentEditId = editId;
  questions = editData?.preguntas ? [...editData.preguntas] : [];
  existingFiles = editData?.archivos ? [...editData.archivos] : [];
  const overlay = document.getElementById("modal-overlay");
  const title = document.getElementById("modal-title");
  const body = document.getElementById("modal-body");
  const saveBtn = document.getElementById("modal-save-btn");

  saveBtn.onclick = () => saveItem();

  switch(type) {
    case "test":
    case "simulacro":
      title.textContent = editData ? "Editar " + (type === "test" ? "Test" : "Simulacro") : "Nuevo " + (type === "test" ? "Test" : "Simulacro");
      body.innerHTML = `
        <div class="form-group">
          <label>Título</label>
          <input type="text" id="field-titulo" value="${editData?.titulo || ""}" placeholder="Ej: Test de Orientación Vocacional">
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea id="field-descripcion" placeholder="Describe el test...">${editData?.descripcion || ""}</textarea>
        </div>
        ${type === "simulacro" ? `
        <div class="form-group">
          <label>Duración (minutos)</label>
          <input type="number" id="field-duracion" value="${editData?.duracion || 60}" min="1">
        </div>` : ""}
        <div class="form-group">
          <label>Archivos (PDF o imágenes)</label>
          <input type="file" id="field-archivos" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style="margin-bottom: 0.5rem;">
          <small style="color: #888;">Selecciona varios archivos (PDF, JPG, PNG)</small>
          <div id="existing-files-container" style="margin-top: 0.5rem;"></div>
        </div>
        <div class="form-group">
          <label>Preguntas interactivas (${questions.length} actuales)</label>
          <p style="color: #888; font-size: 0.8rem; margin-bottom: 0.5rem;">Opcional: preguntas de opción múltiple</p>
          <div id="questions-container"></div>
          <button class="btn btn-sm" onclick="addQuestion()" style="margin-top: 0.5rem;">+ Agregar Pregunta</button>
        </div>
      `;
      renderQuestions();
      renderExistingFiles();
      break;

    case "video":
      title.textContent = editData ? "Editar Video" : "Nuevo Video";
      body.innerHTML = `
        <div class="form-group">
          <label>Título</label>
          <input type="text" id="field-titulo" value="${editData?.titulo || ""}" placeholder="Ej: Clase de Cálculo I">
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea id="field-descripcion" placeholder="Describe el video...">${editData?.descripcion || ""}</textarea>
        </div>
        <div class="form-group">
          <label>URL de YouTube</label>
          <input type="url" id="field-url" value="${editData?.urlYoutube || ""}" placeholder="https://www.youtube.com/watch?v=...">
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select id="field-categoria">
            <option value="Matemáticas" ${editData?.categoria === "Matemáticas" ? "selected" : ""}>Matemáticas</option>
            <option value="Física" ${editData?.categoria === "Física" ? "selected" : ""}>Física</option>
            <option value="Química" ${editData?.categoria === "Química" ? "selected" : ""}>Química</option>
            <option value="Comentario" ${editData?.categoria === "Comentario" ? "selected" : ""}>Comentario</option>
            <option value="General" ${editData?.categoria === "General" ? "selected" : ""}>General</option>
          </select>
        </div>
      `;
      break;

    case "temario":
      title.textContent = editData ? "Editar Temario" : "Nuevo Temario";
      body.innerHTML = `
        <div class="form-group">
          <label>Título</label>
          <input type="text" id="field-titulo" value="${editData?.titulo || ""}" placeholder="Ej: Temario Cálculo I">
        </div>
        <div class="form-group">
          <label>Curso / Especialidad</label>
          <select id="field-curso">
            <option value="Cálculo I" ${editData?.curso === "Cálculo I" ? "selected" : ""}>Cálculo I</option>
            <option value="Cálculo II" ${editData?.curso === "Cálculo II" ? "selected" : ""}>Cálculo II</option>
            <option value="Cálculo III" ${editData?.curso === "Cálculo III" ? "selected" : ""}>Cálculo III</option>
            <option value="Física I" ${editData?.curso === "Física I" ? "selected" : ""}>Física I</option>
            <option value="Física II" ${editData?.curso === "Física II" ? "selected" : ""}>Física II</option>
            <option value="Álgebra Lineal" ${editData?.curso === "Álgebra Lineal" ? "selected" : ""}>Álgebra Lineal</option>
            <option value="Química" ${editData?.curso === "Química" ? "selected" : ""}>Química</option>
            <option value="Preuniversitario" ${editData?.curso === "Preuniversitario" ? "selected" : ""}>Preuniversitario</option>
          </select>
        </div>
        <div class="form-group">
          <label>Contenido del Temario</label>
          <textarea id="field-contenido" style="min-height: 200px;" placeholder="Escribe el temario completo...">${editData?.contenido || ""}</textarea>
        </div>
      `;
      break;

    case "examen":
      existingFiles = editData?.archivos ? [...editData.archivos] : [];
      title.textContent = editData ? "Editar Examen" : "Nuevo Examen";
      body.innerHTML = `
        <div class="form-group">
          <label>Título</label>
          <input type="text" id="field-titulo" value="${editData?.titulo || ""}" placeholder="Ej: Examen Parcial 2023">
        </div>
        <div class="form-group">
          <label>Año</label>
          <input type="number" id="field-year" value="${editData?.year || new Date().getFullYear()}" min="2000" max="2099">
        </div>
        <div class="form-group">
          <label>Materia</label>
          <select id="field-materia">
            <option value="Cálculo I" ${editData?.materia === "Cálculo I" ? "selected" : ""}>Cálculo I</option>
            <option value="Cálculo II" ${editData?.materia === "Cálculo II" ? "selected" : ""}>Cálculo II</option>
            <option value="Cálculo III" ${editData?.materia === "Cálculo III" ? "selected" : ""}>Cálculo III</option>
            <option value="Física I" ${editData?.materia === "Física I" ? "selected" : ""}>Física I</option>
            <option value="Física II" ${editData?.materia === "Física II" ? "selected" : ""}>Física II</option>
            <option value="Álgebra Lineal" ${editData?.materia === "Álgebra Lineal" ? "selected" : ""}>Álgebra Lineal</option>
            <option value="Química" ${editData?.materia === "Química" ? "selected" : ""}>Química</option>
          </select>
        </div>
        <div class="form-group">
          <label>Descripción</label>
          <textarea id="field-descripcion" placeholder="Descripción del examen...">${editData?.descripcion || ""}</textarea>
        </div>
        <div class="form-group">
          <label>Archivos (PDF o imágenes)</label>
          <input type="file" id="field-archivos-examen" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style="margin-bottom: 0.5rem;">
          <small style="color: #888;">Selecciona varios archivos (PDF, JPG, PNG)</small>
          <div id="existing-examen-files" style="margin-top: 0.5rem;"></div>
        </div>
      `;
      renderExistingExamenFiles();
      break;

    case "material":
      existingFiles = editData?.archivos ? [...editData.archivos] : [];
      title.textContent = editData ? "Editar Material" : "Subir Material de Referencia";
      body.innerHTML = `
        <div class="form-group">
          <label>Nombre del material</label>
          <input type="text" id="field-titulo" value="${editData?.titulo || ""}" placeholder="Ej: Examen IEN 2023 - Cálculo">
        </div>
        <div class="form-group">
          <label>Materia / Tema</label>
          <select id="field-materia">
            <option value="Cálculo I" ${editData?.materia === "Cálculo I" ? "selected" : ""}>Cálculo I</option>
            <option value="Cálculo II" ${editData?.materia === "Cálculo II" ? "selected" : ""}>Cálculo II</option>
            <option value="Cálculo III" ${editData?.materia === "Cálculo III" ? "selected" : ""}>Cálculo III</option>
            <option value="Física I" ${editData?.materia === "Física I" ? "selected" : ""}>Física I</option>
            <option value="Física II" ${editData?.materia === "Física II" ? "selected" : ""}>Física II</option>
            <option value="Álgebra Lineal" ${editData?.materia === "Álgebra Lineal" ? "selected" : ""}>Álgebra Lineal</option>
            <option value="Química" ${editData?.materia === "Química" ? "selected" : ""}>Química</option>
            <option value="Matemática Básica" ${editData?.materia === "Matemática Básica" ? "selected" : ""}>Matemática Básica</option>
            <option value="General" ${editData?.materia === "General" ? "selected" : ""}>General</option>
          </select>
        </div>
        <div class="form-group">
          <label>Descripción (opcional)</label>
          <textarea id="field-descripcion" placeholder="Describe el contenido del material...">${editData?.descripcion || ""}</textarea>
        </div>
        <div class="form-group">
          <label>Archivos (PDF o imágenes)</label>
          <input type="file" id="field-archivos-material" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style="margin-bottom: 0.5rem;">
          <small style="color: #888;">Sube exámenes pasados, guías, preguntas tipo.</small>
          <div id="existing-material-files" style="margin-top: 0.5rem;"></div>
        </div>
      `;
      renderExistingMaterialFiles();
      break;
  }

  overlay.classList.add("active");
};

window.closeModal = function() {
  document.getElementById("modal-overlay").classList.remove("active");
  currentEditId = null;
  currentType = null;
  questions = [];
  existingFiles = [];
};

window.addQuestion = function() {
  questions.push({ texto: "", opciones: ["", "", "", ""], respuestaCorrecta: 0 });
  renderQuestions();
};

window.removeQuestion = function(index) {
  questions.splice(index, 1);
  renderQuestions();
};

window.updateQuestionText = function(index, value) {
  questions[index].texto = value;
};

window.updateOption = function(qIndex, oIndex, value) {
  questions[qIndex].opciones[oIndex] = value;
};

window.updateCorrectAnswer = function(qIndex, value) {
  questions[qIndex].respuestaCorrecta = parseInt(value);
};

function renderQuestions() {
  const container = document.getElementById("questions-container");
  if (!container) return;
  container.innerHTML = "";
  questions.forEach((q, qi) => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.marginBottom = "0.5rem";
    div.style.padding = "1rem";
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <strong>Pregunta ${qi + 1}</strong>
        <button class="btn btn-sm btn-danger" onclick="removeQuestion(${qi})">X</button>
      </div>
      <div class="form-group">
        <input type="text" value="${q.texto}" onchange="updateQuestionText(${qi}, this.value)" placeholder="Escribe la pregunta...">
      </div>
      ${q.opciones.map((o, oi) => `
        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
          <input type="radio" name="correct-${qi}" ${q.respuestaCorrecta === oi ? "checked" : ""} onchange="updateCorrectAnswer(${qi}, ${oi})">
          <input type="text" value="${o}" onchange="updateOption(${qi}, ${oi}, this.value)" placeholder="Opción ${oi + 1}" style="flex: 1;">
        </div>
      `).join("")}
    `;
    container.appendChild(div);
  });
}

function renderFileList(containerId, files, removeFn) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  files.forEach((file, fi) => {
    const div = document.createElement("div");
    div.style.cssText = "display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem; background: #f0f4f8; border-radius: 6px; margin-bottom: 0.3rem;";
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(file.name || file.url);
    div.innerHTML = `
      <span style="flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${isImage ? "🖼️" : "📄"} ${file.name || "Archivo"}
      </span>
      <a href="${file.url}" target="_blank" class="btn btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Ver</a>
      <button class="btn btn-sm btn-danger" onclick="${removeFn}(${fi})" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">X</button>
    `;
    container.appendChild(div);
  });
}

function renderExistingFiles() { renderFileList("existing-files-container", existingFiles, "removeExistingFile"); }
function renderExistingExamenFiles() { renderFileList("existing-examen-files", existingFiles, "removeExistingExamenFile"); }
function renderExistingMaterialFiles() { renderFileList("existing-material-files", existingFiles, "removeExistingMaterialFile"); }

window.removeExistingFile = (i) => { existingFiles.splice(i, 1); renderExistingFiles(); };
window.removeExistingExamenFile = (i) => { existingFiles.splice(i, 1); renderExistingExamenFiles(); };
window.removeExistingMaterialFile = (i) => { existingFiles.splice(i, 1); renderExistingMaterialFiles(); };

const TABLE_MAP = {
  test: "test_vocacionales",
  simulacro: "simulacros_ien",
  video: "videos",
  temario: "temarios",
  examen: "examenes",
  material: "materiales_referencia"
};

const BUCKET_MAP = {
  simulacro: "simulacros",
  examen: "examenes",
  material: "materiales"
};

async function saveItem() {
  const data = {};
  const table = TABLE_MAP[currentType];

  switch(currentType) {
    case "test":
    case "simulacro":
      data.titulo = document.getElementById("field-titulo").value;
      data.descripcion = document.getElementById("field-descripcion").value;
      data.preguntas = questions;
      if (currentType === "simulacro") {
        data.duracion = parseInt(document.getElementById("field-duracion").value) || 60;
      }
      const fileInput = document.getElementById("field-archivos");
      if (fileInput?.files.length > 0) {
        const uploaded = await uploadFiles(fileInput.files, BUCKET_MAP[currentType]);
        data.archivos = [...existingFiles, ...uploaded];
      } else {
        data.archivos = existingFiles;
      }
      break;

    case "video":
      data.titulo = document.getElementById("field-titulo").value;
      data.descripcion = document.getElementById("field-descripcion").value;
      data.urlYoutube = document.getElementById("field-url").value;
      data.categoria = document.getElementById("field-categoria").value;
      break;

    case "temario":
      data.titulo = document.getElementById("field-titulo").value;
      data.curso = document.getElementById("field-curso").value;
      data.contenido = document.getElementById("field-contenido").value;
      break;

    case "examen":
      data.titulo = document.getElementById("field-titulo").value;
      data.year = parseInt(document.getElementById("field-year").value);
      data.materia = document.getElementById("field-materia").value;
      data.descripcion = document.getElementById("field-descripcion").value;
      const fileInputEx = document.getElementById("field-archivos-examen");
      if (fileInputEx?.files.length > 0) {
        const uploaded = await uploadFiles(fileInputEx.files, BUCKET_MAP[currentType]);
        data.archivos = [...existingFiles, ...uploaded];
      } else {
        data.archivos = existingFiles;
      }
      break;

    case "material":
      data.titulo = document.getElementById("field-titulo").value;
      data.materia = document.getElementById("field-materia").value;
      data.descripcion = document.getElementById("field-descripcion").value;
      const fileInputMat = document.getElementById("field-archivos-material");
      if (fileInputMat?.files.length > 0) {
        const uploaded = await uploadFiles(fileInputMat.files, BUCKET_MAP[currentType]);
        data.archivos = [...existingFiles, ...uploaded];
      } else {
        data.archivos = existingFiles;
      }
      break;
  }

  data.fecha = new Date().toISOString();

  try {
    if (currentEditId) {
      const { error } = await supabase.from(table).update(data).eq("id", currentEditId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).insert([data]);
      if (error) throw error;
    }
    closeModal();
    loadAllData();
    alert("Guardado correctamente");
  } catch (error) {
    alert("Error al guardar: " + error.message);
  }
}

window.editItem = async function(table, id, type) {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
  if (data) openModal(type, data, id);
};

window.deleteItem = async function(table, id) {
  if (!confirm("¿Estás seguro de eliminar este elemento?")) return;
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (!error) {
    loadAllData();
    alert("Eliminado correctamente");
  } else {
    alert("Error al eliminar: " + error.message);
  }
};
