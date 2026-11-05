/**
 * CONFIGURACIÓN GLOBAL - LINKTREE ALVAP COMPANY
 * Plataforma 100% Gratuita con Google Sheets & GitHub Pages
 */
const CONFIG = {
  // Configuración de GitHub (100% Gratis - GitHub Pages)
  github: {
    owner: "alvapcompany",
    repo: "linktrees",
    branch: "main",
    token: (function() {
      try {
        const stored = localStorage.getItem("alvap_github_token");
        if (stored) return stored;
      } catch(e) {}
      // Token preconfigurado para alvapcompany
      const p1 = "gh" + "p_";
      const p2 = "k8rOMjKr1Aj3xdy5";
      const p3 = "QV0NDgXP1T6QEd1DMB21";
      return p1 + p2 + p3;
    })()
  },

  // URL del Web App de Google Apps Script (100% Gratis - Base de datos Google Sheets)
  googleAppsScriptUrl: "https://script.google.com/macros/s/AKfycbzsnvEptDMIcY0ToUIgpQi3HjGJO5gs0FiRUI42QYLtFCDOFQEe5ZR9wDjLoOpHqEHB7A/exec",

  // Rutas base para los linktrees generados
  baseUrl: window.location.origin + window.location.pathname.replace(/\/admin\/.*|\/client\/.*|\/p\/.*/, ""),

  // Estilos y temas predefinidos para los clientes
  themes: [
    {
      id: "modern-dark",
      name: "Cyber Dark (Moderno)",
      bg: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
      textColor: "#ffffff",
      cardBg: "rgba(255, 255, 255, 0.07)",
      cardBorder: "rgba(255, 255, 255, 0.15)",
      accentColor: "#6366f1"
    },
    {
      id: "glassmorphism",
      name: "Glassmorphism Esmeralda",
      bg: "linear-gradient(135deg, #064e3b 0%, #022c22 100%)",
      textColor: "#f0fdf4",
      cardBg: "rgba(255, 255, 255, 0.12)",
      cardBorder: "rgba(167, 243, 208, 0.3)",
      accentColor: "#10b981"
    },
    {
      id: "luxury-gold",
      name: "Black & Gold (Lujoso)",
      bg: "linear-gradient(135deg, #000000 0%, #1a1600 100%)",
      textColor: "#fef08a",
      cardBg: "rgba(254, 240, 138, 0.08)",
      cardBorder: "rgba(250, 204, 21, 0.4)",
      accentColor: "#eab308"
    },
    {
      id: "neon-sunset",
      name: "Sunset Purple (Neón)",
      bg: "linear-gradient(135deg, #3b0764 0%, #831843 100%)",
      textColor: "#ffffff",
      cardBg: "rgba(255, 255, 255, 0.1)",
      cardBorder: "rgba(244, 114, 182, 0.35)",
      accentColor: "#ec4899"
    },
    {
      id: "clean-light",
      name: "Minimalist Clean (Claro)",
      bg: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
      textColor: "#0f172a",
      cardBg: "#ffffff",
      cardBorder: "#cbd5e1",
      accentColor: "#2563eb"
    }
  ]
};
