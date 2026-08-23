# Área 52 UNI - Sitio Web Oficial

Centro de Asesoría y Preparación Académica ubicado en San Martín de Porres, Lima, Perú.

## 🚀 Características

- **Sitio Web Responsivo**: Funciona perfectamente en desktop y móvil
- **Diseño Moderno**: Interfaz atractiva y profesional
- **Integración Firebase**: Para almacenamiento de contactos y datos
- **Deployment en Vercel**: Hosting rápido y confiable
- **Redes Sociales**: Enlaces integrados a Instagram, Facebook y TikTok

## 📁 Estructura del Proyecto

```
area52-uni/
├── public/
│   └── index.html           # Página principal
├── src/
│   ├── firebase-config.js   # Configuración de Firebase
│   └── form-handler.js      # Manejador de formularios
├── .github/                 # Configuraciones de GitHub
├── package.json             # Dependencias de Node
├── vercel.json              # Configuración de Vercel
├── firebase.json            # Configuración de Firebase
├── .firebaserc              # Proyecto Firebase
├── .gitignore               # Archivos a ignorar
├── .env.example             # Variables de entorno ejemplo
└── README.md                # Este archivo
```

## 🛠️ Instalación Local

### Requisitos
- Node.js 16+ (https://nodejs.org/)
- npm o yarn
- Git (opcional pero recomendado)

### Pasos

1. **Clonar o descargar el proyecto**
```bash
# Si tienes Git
git clone <tu-repositorio>
cd area52-uni

# O simplemente abre la carpeta en VS Code
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Ejecutar en desarrollo**
```bash
npm run dev
```
Abre http://localhost:3000 en tu navegador.

4. **Ver en tu editor VS Code**
```bash
code .
```

## 🔐 Configurar Firebase

### Paso 1: Crear proyecto en Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Crear Proyecto"
3. Nombre: `area52-uni`
4. Completa la configuración

### Paso 2: Obtener credenciales
1. En Firebase Console, ve a "Configuración del Proyecto"
2. En la sección "General", copia la configuración web
3. Copia el objeto `firebaseConfig`

### Paso 3: Configurar variables de entorno

Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```

Reemplaza los valores con tus credenciales de Firebase:
```
FIREBASE_API_KEY=abc123...
FIREBASE_AUTH_DOMAIN=area52-uni.firebaseapp.com
FIREBASE_PROJECT_ID=area52-uni
FIREBASE_STORAGE_BUCKET=area52-uni.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123...
```

### Paso 4: Habilitar Firestore
1. En Firebase Console, ve a "Firestore Database"
2. Haz clic en "Crear base de datos"
3. Selecciona "Modo de prueba" (para desarrollo)
4. Elige la región más cercana a Lima (Sudamérica)

### Paso 5: Crear colecciones
En Firestore, crea estas colecciones:
- `contactos` - Para mensajes de contacto
- `newsletter` - Para suscriptores

## 🚀 Deployment en Vercel

### Opción 1: Con Vercel CLI

```bash
# Instalar Vercel CLI
npm install -g vercel

# Loguear
vercel login

# Deployar
vercel
```

### Opción 2: Conectar GitHub (Recomendado)

1. Push tu proyecto a GitHub
2. Ve a [Vercel](https://vercel.com/)
3. Haz clic en "New Project"
4. Selecciona tu repositorio
5. En "Environment Variables", agrega:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
6. Click en "Deploy"

## 🔥 Deployment en Firebase Hosting

### Pasos

1. **Instalar Firebase CLI**
```bash
npm install -g firebase-tools
```

2. **Loguear en Firebase**
```bash
firebase login
```

3. **Inicializar Firebase (primera vez)**
```bash
firebase init hosting
# Selecciona tu proyecto (area52-uni)
# Carpeta pública: public
# SPA: yes
```

4. **Deployar**
```bash
npm run deploy:firebase
```

Tu sitio estará en: `https://area52-uni.web.app`

## 📝 Contenido Editable

### Cambiar información de contacto
En `public/index.html`:
- **WhatsApp**: Busca `933 884 059`
- **Redes sociales**: Busca los enlaces en la sección de redes

### Agregar/cambiar planes
En `public/index.html`, sección "Planes y Servicios" (busca `pricing-grid`)

### Cambiar testimonios
En `public/index.html`, busca la sección de testimonios y actualiza:
- Texto del testimonio
- Nombre del estudiante
- Año de ingreso

## 📱 Redes Sociales

- **Instagram**: https://www.instagram.com/acad_area52/
- **Facebook**: https://www.facebook.com/p/AREA-52-UNI-100092290451032/
- **TikTok**: https://www.tiktok.com/@area52uni

## 🎯 Funcionalidades Adicionales

### Añadir formulario de contacto con Firebase
1. En `public/index.html`, agrega un formulario
2. En `src/form-handler.js`, usa la función `submitContactForm()`
3. Guarda los contactos en Firestore automáticamente

### Rastrear Analytics
1. En Firebase Console, habilita Google Analytics
2. Agrega el código de seguimiento en `public/index.html`
3. Ve el tráfico en tiempo real

## 🔒 Seguridad

### Reglas de Firestore
Ve a Firebase Console → Firestore → Reglas de seguridad:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /contactos/{document=**} {
      allow create;
      allow read, update, delete: if request.auth.uid != null;
    }
    match /newsletter/{document=**} {
      allow create, read;
    }
  }
}
```

## 📧 Variables de Entorno

El proyecto soporta estas variables:

```env
FIREBASE_API_KEY          # Clave API de Firebase
FIREBASE_AUTH_DOMAIN      # Dominio de autenticación
FIREBASE_PROJECT_ID       # ID del proyecto
FIREBASE_STORAGE_BUCKET   # Bucket de almacenamiento
FIREBASE_MESSAGING_SENDER_ID  # ID de remitente
FIREBASE_APP_ID           # ID de la app
```

En **Vercel**, configúralas en:
Settings → Environment Variables

En **Firebase Hosting**, no necesitas configurarlas (se usan del archivo `.env`)

## 🐛 Solución de Problemas

### "Firebase no está definido"
- Asegúrate de que los scripts de Firebase estén en `public/index.html`
- Carga los scripts en el correcto orden

### Vercel deployment falla
- Verifica que `public/index.html` existe
- Revisa los Environment Variables en Vercel
- Mira los logs: `vercel logs`

### Firebase no conecta
- Verifica tus credenciales en `.env`
- Comprueba que Firestore está habilitado
- Verifica las reglas de seguridad

## 📞 Contacto

**Área 52 UNI**
- 📍 San Martín de Porres, Lima, Perú
- 📱 WhatsApp: 933 884 059
- 📸 Instagram: @acad_area52
- 👤 Facebook: AREA-52-UNI
- 🎵 TikTok: @area52uni

## 📄 Licencia

MIT License - Libre para usar y modificar

---

**Última actualización**: Agosto 2024
