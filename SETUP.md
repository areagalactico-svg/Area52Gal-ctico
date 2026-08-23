# 🚀 Guía Rápida de Setup - Área 52 UNI

Sigue estos pasos para tener tu sitio funcionando en **Vercel** y **Firebase**.

---

## ⚡ Inicio Rápido (5 minutos)

### 1. Abrir en Visual Studio Code
```bash
# En la terminal de tu computadora
cd area52-uni
code .
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar localmente
```bash
npm run dev
```
Abre: http://localhost:3000

---

## 🔥 Configurar Firebase (10 minutos)

### A. Crear Proyecto en Firebase

1. Ve a: https://console.firebase.google.com/
2. Click en "Create Project"
3. Nombre: `area52-uni`
4. Desactiva Google Analytics (opcional)
5. Click "Create Project"

### B. Obtener Credenciales

1. En Firebase Console, haz click en el ícono de engranaje ⚙️
2. Click en "Project Settings"
3. Baja hasta "Your apps"
4. Click en el ícono de web `</>`
5. Copia el objeto dentro de `firebaseConfig`

```javascript
// Verá algo como esto:
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "area52-uni.firebaseapp.com",
  projectId: "area52-uni",
  storageBucket: "area52-uni.appspot.com",
  messagingSenderId: "123456789...",
  appId: "1:123456789...",
};
```

### C. Crear archivo .env

1. En VS Code, crea un archivo `.env` en la raíz (carpeta principal)
2. Copia esto y reemplaza con tus valores:

```env
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=area52-uni.firebaseapp.com
FIREBASE_PROJECT_ID=area52-uni
FIREBASE_STORAGE_BUCKET=area52-uni.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789...
FIREBASE_APP_ID=1:123456789:web:abc123...
```

### D. Habilitar Firestore

1. En Firebase Console, ve a **Firestore Database** (lado izquierdo)
2. Click "Create database"
3. Elige "Start in test mode" (para desarrollo)
4. Región: **South America (São Paulo)** o la más cercana
5. Click "Create"

### E. Crear Colecciones en Firestore

En la consola de Firestore:

**Crear colección "contactos":**
- Collection ID: `contactos`
- Primer documento (dejar vacío por ahora)

**Crear colección "newsletter":**
- Collection ID: `newsletter`
- Primer documento (dejar vacío por ahora)

---

## 🌐 Desplegar en Vercel (5 minutos)

### Opción A: Vercel CLI (Más fácil)

```bash
# 1. Instalar Vercel CLI
npm install -g vercel

# 2. Loguear (abre tu navegador)
vercel login

# 3. Deployar
vercel
```

Sigue las instrucciones. Tu sitio estará en: `https://area52-uni.vercel.app`

### Opción B: GitHub + Vercel (Recomendado)

1. **Crear repositorio en GitHub:**
   - Ve a https://github.com/new
   - Nombre: `area52-uni`
   - Visibility: Public o Private
   - Click "Create repository"

2. **Subir código:**
   ```bash
   cd area52-uni
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/tuusuario/area52-uni.git
   git push -u origin main
   ```

3. **Conectar con Vercel:**
   - Ve a https://vercel.com/
   - Login con GitHub
   - Click "Import Project"
   - Selecciona `area52-uni`
   - Click "Import"

4. **Agregar Environment Variables:**
   - En el dashboard de Vercel, ve a **Settings → Environment Variables**
   - Agrega cada variable de `.env`:
     - `FIREBASE_API_KEY`
     - `FIREBASE_AUTH_DOMAIN`
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_STORAGE_BUCKET`
     - `FIREBASE_MESSAGING_SENDER_ID`
     - `FIREBASE_APP_ID`
   - Click "Save"

5. **Redeploy:**
   - Vercel automáticamente desplegará con las nuevas variables

---

## 🔥 Desplegar en Firebase Hosting (Opcional)

Si prefieres usar solo Firebase:

```bash
# 1. Instalar Firebase CLI
npm install -g firebase-tools

# 2. Loguear
firebase login

# 3. Deployar
firebase deploy
```

Tu sitio estará en: `https://area52-uni.web.app`

---

## ✅ Checklist Final

- [ ] Firebase project creado
- [ ] Firestore habilitado
- [ ] Colecciones "contactos" y "newsletter" creadas
- [ ] `.env` configurado
- [ ] Sitio funciona localmente (`npm run dev`)
- [ ] GitHub repository creado (opcional)
- [ ] Sitio deployado en Vercel o Firebase
- [ ] Dominio personalizado (opcional)

---

## 🎯 Próximos Pasos (Opcionales)

### Agregar Dominio Personalizado

**En Vercel:**
1. Settings → Domains
2. Agrega `area52uni.pe` o tu dominio
3. Configura DNS en tu registrador

**En Firebase:**
1. Hosting → Domain
2. Agrega tu dominio
3. Sigue instrucciones de DNS

### Habilitar Google Analytics

1. Firebase Console → Analytics
2. Habilitar
3. Se agregará automáticamente a tu sitio

### Crear Formulario de Contacto

En `public/index.html`, agrega esto antes de `</body>`:

```html
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js"></script>
<script>
  // Aquí va tu código de Firebase
  const firebaseConfig = {
    // Tus credenciales
  };
  firebase.initializeApp(firebaseConfig);
</script>
```

---

## 🆘 Solución de Problemas

### Error: "Vercel command not found"
```bash
npm install -g vercel
vercel login
```

### Error: "Firebase not defined"
Asegúrate que los scripts de Firebase están en `public/index.html` ANTES de cerrarse `</body>`

### Error: "FIREBASE_API_KEY not found"
1. Verifica que `.env` existe
2. Que tiene los valores correctos
3. Reinicia `npm run dev`

### Firestore "Permission denied"
1. Ve a Firestore → Rules
2. Reemplaza con:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
⚠️ **NOTA:** Usa "test mode" solo para desarrollo. En producción, sé más restrictivo.

---

## 📞 Ayuda

Si tienes problemas:

1. Revisa el [README.md](./README.md)
2. Busca el error en Google
3. Consulta documentación:
   - Vercel: https://vercel.com/docs
   - Firebase: https://firebase.google.com/docs
   - GitHub: https://docs.github.com

---

**¡Listo! Tu sitio de Área 52 UNI está en línea.** 🎉
