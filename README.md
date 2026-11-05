# 🚀 Sistema de Linktrees Inteligentes NFC & Panel de Analíticas
### Desarrollado para **Alvap Company** • 100% Gratuito Para Siempre

Plataforma integral y profesional para crear, personalizar y desplegar páginas de aterrizaje (Linktree) para negocios basadas en tarjetas NFC o códigos QR, con analíticas de visitas/clics, visor de reseñas de Google Maps en vivo y sincronización dual con Google Sheets y GitHub Pages.

---

## 🌟 Características Principales

1. **Panel Administrativo Multinegocio por IDs (`/admin`)**:
   - Organizado por IDs únicos (ej. `alvap-studio`, `tacos-el-pastor`).
   - Selector dinámico para alternar o crear nuevos negocios al instante.
   - Creación de botones esenciales: WhatsApp, Instagram, Facebook, Google Maps (Ubicación) y Botón Destacado Extra.
   - **Botones dinámicos ilimitados**: Agrega cualquier enlace con ícono, texto y color personalizado (TikTok, Uber Eats, Menú, etc.).
   - **Previsualizador en Tiempo Real**: Marco interactivo de smartphone iPhone donde cada cambio de texto, color o tema se refleja instantáneamente antes de guardar.
   - **Selector de Plantillas y Temas**: Cyber Dark, Glassmorphism Esmeralda, Black & Gold Lujoso, Sunset Neón y Minimalist Clean.

2. **Auto-Commit a GitHub (`alvapcompany`)**:
   - Conexión directa mediante la API de GitHub (100% client-side, sin costos de hosting).
   - Crea el repositorio automáticamente si no existe y habilita GitHub Pages.
   - Sube tanto la base de datos `data/businesses.json` como las páginas estáticas individuales de cada ID (`negocios/<id>/index.html`).

3. **Base de Datos en Google Sheets (100% Gratis)**:
   - Almacena automáticamente los perfiles de los negocios: ID, nombre, WhatsApp, Facebook, Instagram, Google Maps, color, etc.
   - Guarda el historial de eventos: cada vista y cada clic con fecha y dispositivo.
   - Archivo backend `google-apps-script/Code.gs` listo para copiar y pegar en 1 minuto.

4. **Portal del Cliente (`/client/dashboard.html?id=<id>`)**:
   - Acceso exclusivo para el dueño del negocio.
   - **KPIs en Vivo**: Visitas totales, visitantes únicos, clics totales hacia sus redes y tasa de conversión (CTR).
   - **Gráficos Interactivos**: Visitas vs clics en el tiempo y desglose de canales (WhatsApp vs Instagram vs Ubicación).
   - **Scraper de Reseñas de Google Maps**: Monitorea en tiempo real la calificación del negocio, el total de opiniones y las reseñas más recientes.
   - **Herramientas NFC**: Código QR de alta resolución listo para imprimir en acrílicos o manteles y enlace directo para programar chips NFC.

5. **Visor de Linktree Móvil (`/p/?id=<id>`)**:
   - Optimizado para escaneos NFC ultrarrápidos en smartphones.
   - Telemetría no intrusiva con `navigator.sendBeacon` para registrar clics sin retrasar la navegación del usuario.
   - Acceso rápido a dejar reseñas en Google Maps con 5 estrellas.

---

## 📁 Estructura del Proyecto

```text
paginas NFC/
├── index.html                 # Página de bienvenida y selector de portales
├── config.js                  # Configuración global y temas
├── admin/                     # Panel de Creación y Administración
│   ├── index.html             # Editor con split-screen y phone mockup
│   ├── admin.css              # Estilos modernos Cyber/Dark
│   └── admin.js               # Lógica de IDs, live preview y guardado
├── p/                         # Visor del Linktree móvil NFC
│   ├── index.html             # Cargador dinámico
│   ├── viewer.css             # Estilos responsivos de alta gama
│   └── viewer.js              # Telemetría y renderizado
├── client/                    # Panel de Estadísticas y Reseñas para el Cliente
│   ├── dashboard.html         # Tablero del negocio
│   ├── dashboard.css          # Estilos tipo SaaS moderno
│   └── dashboard.js           # Métricas, gráficos Chart.js y Scraper
├── google-apps-script/        # Backend gratuito en la nube de Google
│   ├── Code.gs                # Código para Google Sheets API
│   └── INSTRUCCIONES_GOOGLE_SHEETS.md # Guía paso a paso
├── assets/
│   └── github-sync.js         # Motor de commits para GitHub API
└── data/
    └── businesses.json        # Base de datos local/JSON inicial
```

---

## ⚡ Guía de Inicio Rápido

1. **Abrir el Panel de Control**:
   - Abre `admin/index.html` en tu navegador.
2. **Configurar el Token de GitHub**:
   - Ve a la pestaña **Conexiones**.
   - Ingresa tu **Personal Access Token (PAT)** de GitHub con permiso `repo` para la cuenta `alvapcompany`.
   - Haz clic en **Guardar Credenciales**.
3. **Crear o Editar un Negocio**:
   - Selecciona un negocio existente o pulsa **+ Nuevo ID**.
   - Personaliza sus redes sociales, WhatsApp, colores y plantilla.
   - Observa la previsualización en vivo en el smartphone de la derecha.
4. **Publicar y Sincronizar**:
   - Pulsa **Auto-Commit a GitHub** para que los cambios se suban directamente al repositorio y queden en línea para tus tarjetas NFC.
   - Pulsa **Guardar en Sheet** para respaldar en tu hoja de cálculo.
5. **Entregar al Cliente**:
   - Entrega al cliente su enlace público: `https://alvapcompany.github.io/linktrees/p/?id=nombre-negocio`
   - Entrega a tu cliente su panel de métricas y reseñas: `https://alvapcompany.github.io/linktrees/client/dashboard.html?id=nombre-negocio`
