# ¡COMIENZA AQUÍ! - Área 52 UNI

## En 3 Minutos

### 1. Instalar dependencias
```bash
npm install
```

### 2. Ejecutar
```bash
npm run dev
```

### 3. Abrir
http://localhost:3000

## ¿Qué hace cada página?

| Página | Descripción |
|--------|-------------|
| `/` | Selector de nivel (Preuniversitario / Universitario) |
| `/preuniversitario.html` | Portal Preuniversitario |
| `/universitario.html` | Portal Universitario |
| `/admin.html` | Panel de administración (solo admin) |
| `/videos.html` | Videos de clases |
| `/temarios.html` | Temarios de cursos |
| `/examenes.html` | Exámenes pasados |
| `/materiales.html` | Materiales de referencia |
| `/test-vocacional.html` | Test vocacional con IA |
| `/simulacro-ien.html` | Simulacro IEN con IA |

## ¿Cómo agregar contenido?

1. Ve a `/admin.html`
2. Login con credenciales de administrador
3. Selecciona la pestaña (Tests, Videos, Temarios, etc.)
4. Crea, edita o elimina contenido
5. Los cambios se ven inmediatamente en las páginas públicas

## Tech Stack

- **Frontend**: HTML/CSS/JS vanilla
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **IA**: DeepSeek API (generación de preguntas)
- **Hosting**: Vercel
