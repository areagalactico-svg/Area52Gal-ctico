# 📂 Estructura de Archivos - Área 52 UNI

Aquí está lo que hace cada archivo:

## 🌍 Archivos Principales

| Archivo | Descripción |
|---------|-------------|
| `public/index.html` | **La página web principal** - Edita aquí el contenido, precios, testimonios |
| `README.md` | Documentación completa del proyecto |
| `SETUP.md` | Guía paso a paso para configurar Firebase y Vercel |
| `package.json` | Dependencias del proyecto (librerías) |

---

## 🔧 Archivos de Configuración

### Vercel
| Archivo | Para qué |
|---------|---------|
| `vercel.json` | Configuración para desplegar en Vercel |

**¿Cuándo modificar?**
- Casi nunca. Solo si quieres cambiar regiones o variablse de entorno.

### Firebase
| Archivo | Para qué |
|---------|---------|
| `firebase.json` | Configuración para Firebase Hosting |
| `.firebaserc` | ID del proyecto Firebase |

**¿Cuándo modificar?**
- `.firebaserc`: Cuando cambies de proyecto Firebase
- `firebase.json`: Solo si cambias la carpeta pública

### Entorno
| Archivo | Para qué |
|---------|---------|
| `.env` | **Variables secretas - NO subir a GitHub** ⚠️ |
| `.env.example` | **Ejemplo de `.env`** - Sí subir a GitHub |
| `.gitignore` | Archivos a ignorar en Git |

**¿Cuándo editar `.env`?**
- Cuando agregues o cambies credenciales de Firebase
- **NUNCA** lo subas a GitHub (está en `.gitignore`)

---

## 📝 Carpeta `src/` - Código Adicional

| Archivo | Para qué |
|---------|---------|
| `src/firebase-config.js` | Configuración de Firebase en JavaScript |
| `src/form-handler.js` | Funciones para guardar contactos en Firestore |

**¿Cuándo usar?**
- Si quieres agregar un formulario de contacto real
- Para guardar datos en Firestore automáticamente

### Ejemplo de uso en HTML:
```html
<script src="src/firebase-config.js"></script>
<script src="src/form-handler.js"></script>

<script>
  // Cuando alguien envía un formulario:
  submitContactForm("Juan", "juan@email.com", "Mensaje...", "933884059");
</script>
```

---

## 🔄 Carpeta `.github/` - Automatizaciones

| Archivo | Para qué |
|---------|---------|
| `.github/workflows/deploy.yml` | **CI/CD automático** - Desplega cambios automáticamente |

**¿Cómo funciona?**
1. Haces `git push` a GitHub
2. GitHub Actions ejecuta automáticamente
3. Tu sitio se actualiza en Vercel

---

## 🎯 ¿Qué DEBO Editar?

### Contenido de la página web
**Archivo:** `public/index.html`

**Qué cambiar:**
- Títulos y descripción
- Precios y planes
- Testimonios
- Información de contacto
- Texto de servicios

**Búsqueda rápida en VS Code:**
```
Ctrl+F (Cmd+F en Mac)
Busca: "933 884 059" o "Área 52"
```

### Información de Firebase
**Archivo:** `.env`

**Qué cambiar:**
- `FIREBASE_API_KEY`
- `FIREBASE_PROJECT_ID`
- Etc.

**Cómo conseguirlo:**
1. Firebase Console → Settings
2. Copia la configuración web

### Variables de entorno en Vercel
**Dónde:** Dashboard de Vercel → Settings → Environment Variables

**Qué agregar:**
Mismas variables que en `.env`

---

## ⚠️ ¿Qué NO Debo Editar?

| Archivo | Razón |
|---------|-------|
| `package.json` | Romperá las dependencias (a menos que sepas de npm) |
| `vercel.json` | Puede romper el deploy |
| `firebase.json` | Puede romper el deploy en Firebase |
| `.gitignore` | Subirías archivos secretos a GitHub |

---

## 🚀 Flujo de Trabajo Recomendado

1. **Editar contenido** → `public/index.html`
2. **Probar localmente** → `npm run dev`
3. **Guardar cambios** → `git add .` → `git commit -m "mensaje"`
4. **Subir a GitHub** → `git push`
5. **Auto-despliega en Vercel** ✅

---

## 📋 Checklist Rápido

- [ ] Encontré `public/index.html` ✅
- [ ] Encontré `.env` ✅
- [ ] Entiendo qué archivos editar ✅
- [ ] Abro el proyecto en VS Code ✅
- [ ] Ejecuto `npm install` ✅
- [ ] Corro `npm run dev` ✅

---

**¡Ahora estás listo para editar y desplegar tu sitio!** 🎉
