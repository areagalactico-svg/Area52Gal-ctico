# Estructura de Archivos - Área 52 UNI

## Archivos Principales

| Archivo | Descripción |
|---------|-------------|
| `public/index.html` | Selector de nivel (Preuniversitario / Universitario) |
| `public/preuniversitario.html` | Portal Preuniversitario |
| `public/universitario.html` | Portal Universitario |
| `public/admin.html` | Panel de administración |
| `public/videos.html` | Galería de videos |
| `public/temarios.html` | Temarios de cursos |
| `public/examenes.html` | Exámenes pasados |
| `public/materiales.html` | Materiales de referencia |
| `public/test-vocacional.html` | Test vocacional con IA |
| `public/simulacro-ien.html` | Simulacro IEN con IA |

## JavaScript

| Archivo | Descripción |
|---------|-------------|
| `public/js/supabase-config.js` | Configuración de Supabase |
| `public/js/admin.js` | Lógica del panel admin |
| `public/js/chat.js` | Widget de chat (WhatsApp) |

## CSS

| Archivo | Descripción |
|---------|-------------|
| `public/css/styles.css` | Estilos globales compartidos |

## Configuración

| Archivo | Descripción |
|---------|-------------|
| `package.json` | Dependencias de Node.js |
| `.github/workflows/deploy.yml` | CI/CD automático con Vercel |
| `.env.example` | Variables de entorno ejemplo |

## Backend (Supabase)

Las tablas en Supabase son:

| Tabla | Contenido |
|-------|-----------|
| `test_vocacionales` | Tests vocacionales |
| `simulacros_ien` | Simulacros IEN |
| `videos` | Videos de clases |
| `temarios` | Temarios de cursos |
| `examenes` | Exámenes pasados |
| `materiales_referencia` | Materiales de referencia |
| `contactos` | Mensajes de contacto |
| `newsletter` | Suscriptores |

Los buckets de Storage son:
- `examenes` — Archivos de exámenes
- `simulacros` — Archivos de simulacros
- `materiales` — Materiales de referencia
