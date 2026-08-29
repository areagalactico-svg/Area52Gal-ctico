# Guía Rápida de Setup - Área 52 UNI

## Inicio Rápido (3 minutos)

### 1. Abrir en VS Code
```bash
cd area52-uni
code .
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar en desarrollo
```bash
npm run dev
```
Abre http://localhost:3000

## Deployment en Vercel

### Opción 1: Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
```

### Opción 2: GitHub (Recomendado)
1. Push a GitHub
2. En Vercel: "New Project" → seleccionar repositorio
3. Auto-deploy en cada push a `main`

## Variables de Entorno en Vercel

Solo necesitas una:
```
DEEPSEEK_API_KEY=tu_api_key_del_chatbot
```

Las credenciales de Supabase están en `public/js/supabase-config.js`.

## Panel Admin

Accede a `/admin.html` para gestionar todo el contenido:
- Login con `areagalactico@gmail.com`
- Crear/editar/eliminar: Tests, Simulacros, Videos, Temarios, Exámenes, Materiales
- Los archivos se suben a Supabase Storage

## Estructura

- `index.html` → Selector de nivel (Preuniversitario / Universitario)
- `preuniversitario.html` → Portal para estudiantes de pregrado
- `universitario.html` → Portal para estudiantes universitarios
- `admin.html` → Panel de administración
- `videos.html`, `temarios.html`, `examenes.html`, `materiales.html` → Contenido público
