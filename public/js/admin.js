import { auth, db, storage, ADMIN_EMAIL, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, ref, uploadBytes, getDownloadURL, listAll, deleteObject, signInWithPopup, signOut, onAuthStateChanged, provider } from "./firebase-config.js";

let currentEditId = null;
let currentType = null;
let questions = [];
let existingFiles = [];

document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  setupTabs();
  document.getElementById("logout-btn").addEventListener("click", logout);
});

function checkAuth() {
  onAuthStateChanged(auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
      document.getElementById("login-page").style.display = "none";
      document.getElementById("admin-panel").style.display = "block";
      document.getElementById("user-name").textContent = user.displayName || user.email;
      document.getElementById("user-photo").src = user.photoURL || "";
      loadAllData();
    } else {
      document.getElementById("login-page").style.display = "flex";
      document.getElementById("admin-panel").style.display = "none";
      document.getElementById("google-login-btn").addEventListener("click", login);
    }
  });
}

async function login() {
  try {
    const result = await signInWithPopup(auth, provider);
    if (result.user.email !== ADMIN_EMAIL) {
      await signOut(auth);
      const err = document.getElementById("login-error");
      err.textContent = "Acceso denegado. Solo el administrador puede acceder.";
      err.style.display = "block";
    }
  } catch (error) {
    const err = document.getElementById("login-error");
    err.textContent = "Error: " + error.message;
    err.style.display = "block";
  }
}

async function logout() {
  await signOut(auth);
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

async function loadAllData() {
  await Promise.all([
    loadCollection("test_vocacionales", "tests-list", "test"),
    loadCollection("simulacros_ien", "simulacros-list", "simulacro"),
    loadCollection("videos", "videos-list", "video"),
    loadCollection("temarios", "temarios-list", "temario"),
    loadCollection("examenes", "examenes-list", "examen"),
    loadCollection("materiales_referencia", "materiales-list", "material")
  ]);
  updateStats();
}

async function loadCollection(colName, listId, type) {
  const q = query(collection(db, colName), orderBy("fecha", "desc"));
  const snapshot = await getDocs(q);
  const list = document.getElementById(listId);
  list.innerHTML = "";

  if (snapshot.empty) {
    list.innerHTML = '<div class="card"><p style="color: #888; text-align: center;">No hay elementos creados aún.</p></div>';
    return;
  }

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div class="item-info">
        <h4>${data.titulo || data.nombre || "Sin título"}</h4>
        <p>${data.descripcion || data.materia || data.categoria || ""}</p>
      </div>
      <div class="item-actions">
        <button class="btn btn-sm" onclick="editItem('${colName}', '${docSnap.id}', '${type}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('${colName}', '${docSnap.id}')">Eliminar</button>
      </div>
    `;
    list.appendChild(item);
  });
}

async function updateStats() {
  const collections = ["test_vocacionales", "simulacros_ien", "videos", "temarios", "examenes", "materiales_referencia"];
  const labels = ["Tests", "Simulacros", "Videos", "Temarios", "Exámenes", "Materiales"];
  const grid = document.getElementById("stats-grid");
  grid.innerHTML = "";

  for (let i = 0; i < collections.length; i++) {
    const snap = await getDocs(collection(db, collections[i]));
    grid.innerHTML += `
      <div class="stat-card">
        <h3>${snap.size}</h3>
        <p>${labels[i]}</p>
      </div>
    `;
  }
}

window.openModal = function(type, editData = null, editId = null) {
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
          <label>Archivos del examen (PDF o imágenes)</label>
          <input type="file" id="field-archivos" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style="margin-bottom: 0.5rem;">
          <small style="color: #888;">Puedes seleccionar varios archivos a la vez (PDF, JPG, PNG)</small>
          <div id="existing-files-container" style="margin-top: 0.5rem;"></div>
        </div>
        <div class="form-group">
          <label>Preguntas interactivas (${questions.length} actuales)</label>
          <p style="color: #888; font-size: 0.8rem; margin-bottom: 0.5rem;">Opcional: agrega preguntas de opción múltiple para evaluación</p>
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
      existingFiles = editData?.archivos ? [...editData.archivos] : (editData?.fileUrl ? [{ name: editData.fileName || "Documento", url: editData.fileUrl }] : []);
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
          <label>Archivos del examen (PDF o imágenes)</label>
          <input type="file" id="field-archivos-examen" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple style="margin-bottom: 0.5rem;">
          <small style="color: #888;">Puedes seleccionar varios archivos (PDF, JPG, PNG)</small>
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
          <small style="color: #888;">Sube exámenes pasados, guías, preguntas tipo. La IA los usará como referencia.</small>
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

function renderExistingFiles() {
  const container = document.getElementById("existing-files-container");
  if (!container) return;
  container.innerHTML = "";

  existingFiles.forEach((file, fi) => {
    const div = document.createElement("div");
    div.style.cssText = "display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem; background: #f0f4f8; border-radius: 6px; margin-bottom: 0.3rem;";
    const isImage = file.url && /\.(jpg|jpeg|png|webp)$/i.test(file.name || file.url);
    div.innerHTML = `
      <span style="flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${isImage ? "🖼️" : "📄"} ${file.name || "Archivo"}
      </span>
      <a href="${file.url}" target="_blank" class="btn btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Ver</a>
      <button class="btn btn-sm btn-danger" onclick="removeExistingFile(${fi})" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">X</button>
    `;
    container.appendChild(div);
  });
}

window.removeExistingFile = function(index) {
  existingFiles.splice(index, 1);
  renderExistingFiles();
};

function renderExistingExamenFiles() {
  const container = document.getElementById("existing-examen-files");
  if (!container) return;
  container.innerHTML = "";

  existingFiles.forEach((file, fi) => {
    const div = document.createElement("div");
    div.style.cssText = "display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem; background: #f0f4f8; border-radius: 6px; margin-bottom: 0.3rem;";
    const isImage = file.url && /\.(jpg|jpeg|png|webp)$/i.test(file.name || file.url);
    div.innerHTML = `
      <span style="flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${isImage ? "🖼️" : "📄"} ${file.name || "Archivo"}
      </span>
      <a href="${file.url}" target="_blank" class="btn btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Ver</a>
      <button class="btn btn-sm btn-danger" onclick="removeExistingExamenFile(${fi})" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">X</button>
    `;
    container.appendChild(div);
  });
}

window.removeExistingExamenFile = function(index) {
  existingFiles.splice(index, 1);
  renderExistingExamenFiles();
};

function renderExistingMaterialFiles() {
  const container = document.getElementById("existing-material-files");
  if (!container) return;
  container.innerHTML = "";

  existingFiles.forEach((file, fi) => {
    const div = document.createElement("div");
    div.style.cssText = "display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem; background: #f0f4f8; border-radius: 6px; margin-bottom: 0.3rem;";
    const isImage = file.url && /\.(jpg|jpeg|png|webp)$/i.test(file.name || file.url);
    div.innerHTML = `
      <span style="flex: 1; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${isImage ? "🖼️" : "📄"} ${file.name || "Archivo"}
      </span>
      <a href="${file.url}" target="_blank" class="btn btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Ver</a>
      <button class="btn btn-sm btn-danger" onclick="removeExistingMaterialFile(${fi})" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">X</button>
    `;
    container.appendChild(div);
  });
}

window.removeExistingMaterialFile = function(index) {
  existingFiles.splice(index, 1);
  renderExistingMaterialFiles();
};

async function saveItem() {
  const data = {};

  switch(currentType) {
    case "test":
    case "simulacro":
      data.titulo = document.getElementById("field-titulo").value;
      data.descripcion = document.getElementById("field-descripcion").value;
      data.preguntas = questions;
      if (currentType === "simulacro") {
        data.duracion = parseInt(document.getElementById("field-duracion").value) || 60;
        const fileInput = document.getElementById("field-archivos");
        const uploadedFiles = [];
        if (fileInput.files.length > 0) {
          for (const file of fileInput.files) {
            const storageRef = ref(storage, `simulacros/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            uploadedFiles.push({ name: file.name, url });
          }
        }
        data.archivos = [...existingFiles, ...uploadedFiles];
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
      const fileInputExamen = document.getElementById("field-archivos-examen");
      const uploadedExamenFiles = [];
      if (fileInputExamen.files.length > 0) {
        for (const file of fileInputExamen.files) {
          const storageRef = ref(storage, `examenes/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          uploadedExamenFiles.push({ name: file.name, url });
        }
      }
      data.archivos = [...existingFiles, ...uploadedExamenFiles];
      break;

    case "material":
      data.titulo = document.getElementById("field-titulo").value;
      data.materia = document.getElementById("field-materia").value;
      data.descripcion = document.getElementById("field-descripcion").value;
      const fileInputMaterial = document.getElementById("field-archivos-material");
      const uploadedMaterialFiles = [];
      if (fileInputMaterial.files.length > 0) {
        for (const file of fileInputMaterial.files) {
          const storageRef = ref(storage, `materiales/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          uploadedMaterialFiles.push({ name: file.name, url });
        }
      }
      data.archivos = [...existingFiles, ...uploadedMaterialFiles];
      break;
  }

  data.fecha = new Date().toISOString();

  const colMap = {
    test: "test_vocacionales",
    simulacro: "simulacros_ien",
    video: "videos",
    temario: "temarios",
    examen: "examenes"
  };

  try {
    if (currentEditId) {
      await updateDoc(doc(db, colMap[currentType], currentEditId), data);
    } else {
      await addDoc(collection(db, colMap[currentType]), data);
    }
    closeModal();
    loadAllData();
    alert("Guardado correctamente");
  } catch (error) {
    alert("Error al guardar: " + error.message);
  }
}

window.editItem = async function(colName, id, type) {
  const snap = await getDocs(collection(db, colName));
  let editData = null;
  snap.forEach(docSnap => {
    if (docSnap.id === id) {
      editData = { id: docSnap.id, ...docSnap.data() };
    }
  });
  if (editData) {
    openModal(type, editData, id);
  }
};

window.deleteItem = async function(colName, id) {
  if (confirm("¿Estás seguro de eliminar este elemento?")) {
    try {
      await deleteDoc(doc(db, colName, id));
      loadAllData();
      alert("Eliminado correctamente");
    } catch (error) {
      alert("Error al eliminar: " + error.message);
    }
  }
};
