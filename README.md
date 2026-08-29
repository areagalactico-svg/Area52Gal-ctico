# Área 52 UNI - Sitio Web Oficial

Centro de Asesoría y Preparación Académica ubicado en San Martín de Porres, Lima, Perú.

## Características

- **Sitio Web Responsivo**: Funciona en desktop y móvil
- **Diseño Moderno**: Interfaz atractiva y profesional
- **Backend Supabase**: Base de datos, autenticación y almacenamiento
- **Panel Admin**: CRUD completo para gestionar contenido
- **Deployment en Vercel**: Hosting rápido y confiable
- **Redes Sociales**: Enlaces a Instagram, Facebook y TikTok

## Estructura del Proyecto

```
area52-uni/
├── public/
│   ├── index.html              # Selector de nivel (Preu/Uni)
│   ├── preuniversitario.html   # Portal Preuniversitario
│   ├── universitario.html      # Portal Universitario
│   ├── admin.html              # Panel de administración
│   ├── videos.html             # Videos de clases
│   ├── temarios.html           # Temarios de cursos
│   ├── examenes.html           # Exámenes pasados
│   ├── materiales.html         # Materiales de referencia
│   ├── test-vocacional.html    # Test vocacional con IA
│   ├── simulacro-ien.html      # Simulacro IEN con IA
│   ├── css/styles.css          # Estilos globales
│   └── js/
│       ├── supabase-config.js  # Configuración Supabase
│       ├── admin.js            # Lógica del panel admin
│       └── chat.js             # Widget de chat
├── .github/workflows/          # CI/CD con Vercel
├── package.json
└── README.md
```

## Stack Tecnológico

- **Frontend**: HTML, CSS, JavaScript vanilla
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **IA**: DeepSeek API para generación de preguntas
- **Hosting**: Vercel
- **Chatbot**: WhatsApp widget

## Variables de Entorno

Las credenciales de Supabase están en `public/js/supabase-config.js` (expuestas al cliente, son públicas por diseño de Supabase).

En Vercel solo necesitas:
```
DEEPSEEK_API_KEY=tu_api_key  # Para el chatbot IA
```

## Deployment

### Con Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
```

### Conectar GitHub (Recomendado)
1. Push a GitHub
2. En Vercel: "New Project" → seleccionar repositorio
3. Deploy automático en cada push a `main`

## Contenido Editable

Todo el contenido se gestiona desde el **Panel Admin** (`/admin.html`):
- Test Vocacionales
- Simulacros IEN
- Videos de clases
- Temarios de cursos
- Exámenes pasados
- Materiales de referencia

## Redes Sociales

- **Instagram**: https://www.instagram.com/acad_area52/
- **Facebook**: https://www.facebook.com/p/AREA-52-UNI-100092290451032/
- **TikTok**: https://www.tiktok.com/@area52uni

## Contacto

**Área 52 UNI**
- 📍 San Martín de Porres, Lima, Perú
- 📱 WhatsApp: 933 884 059
- 📸 Instagram: @acad_area52
