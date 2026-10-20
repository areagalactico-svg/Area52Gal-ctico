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
| `public/js/admin-resultados.js` | Pestaña Resultados y Mérito del admin |
| `public/js/chat.js` | Widget de chat (WhatsApp) |

## APIs (Vercel Serverless — `api/`)

| Archivo | Descripción |
|---------|-------------|
| `api/generate-questions.js` | Preguntas de simulacro con anti-repetición y nivel 100% difícil |
| `api/generate-guide.js` | Guía de aprendizaje personalizada con IA |
| `api/tutor.js` | Tutor adaptativo: explicar, practicar, socrático, errores, pista escalonada (1-2-3) y corrección de procedimiento |
| `api/clone-problem.js` | Clonador infinito de problemas (varía datos, conserva estructura; tabla `pregunta_clones`) |
| `api/weekly-plan.js` | Plan de estudio semanal lunes→domingo con IA (tabla `planes_semanales`) |
| `api/registrar-vistas.js` | Memoria anti-repetición del estudiante (`pregunta_vistas`) |
| `api/agents-collect.js` | Endpoint de los agentes recolectores |
| `api/resolve-tiktok.js` | Resuelve enlaces cortos de TikTok |
| `api/chat.js` | Chat del sitio |

## Agentes recolectores (`agents/`)

| Archivo | Descripción |
|---------|-------------|
| `agents/config.cjs` | Fuentes y parámetros de recolección |
| `agents/collector.js` | Rastreo y scoring de calidad de contenido |
| `agents/run-collect.js` | CLI: `npm run agents:collect -- --uni=UNI --save` |
| `agents/seed-contenido.js` | Semilla de temarios/materiales (requiere `SUPABASE_SERVICE_KEY`) |
| `agents/backfill-banco.js` | Rellena hashes del banco de preguntas |

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
| `simulacro_submissions` | Presentaciones y notas por estudiante |
| `banco_preguntas` | Banco anti-repetición de preguntas IA |
| `pregunta_vistas` | Preguntas vistas/falladas por estudiante |
| `pregunta_clones` | Clones infinitos de problemas (práctica) |
| `planes_semanales` | Planes semanales IA por estudiante |
| `estrategia_auditoria` | Auditoría de estrategia por simulacro |
| `guias_personalizadas` | Guías de aprendizaje IA |
| `datos_ingreso` | Fecha/vacantes/puntaje por universidad |

Los buckets de Storage son:
- `examenes` — Archivos de exámenes
- `simulacros` — Archivos de simulacros
- `materiales` — Materiales de referencia
