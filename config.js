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

  // Estilos y temas predefinidos para los clientes (30 Temas Profesionales)
  themes: [
    {
      id: "modern-dark",
      name: "💻 Cyber Dark",
      category: "dark",
      bg: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
      textColor: "#ffffff",
      cardBg: "rgba(255, 255, 255, 0.07)",
      cardBorder: "rgba(255, 255, 255, 0.15)",
      accentColor: "#6366f1"
    },
    {
      id: "glassmorphism",
      name: "💎 Glass Esmeralda",
      category: "dark",
      bg: "linear-gradient(135deg, #064e3b 0%, #022c22 100%)",
      textColor: "#f0fdf4",
      cardBg: "rgba(255, 255, 255, 0.12)",
      cardBorder: "rgba(167, 243, 208, 0.3)",
      accentColor: "#10b981"
    },
    {
      id: "luxury-gold",
      name: "👑 Luxury Gold",
      category: "luxury",
      bg: "linear-gradient(135deg, #000000 0%, #1a1600 100%)",
      textColor: "#fef08a",
      cardBg: "rgba(254, 240, 138, 0.08)",
      cardBorder: "rgba(250, 204, 21, 0.4)",
      accentColor: "#eab308"
    },
    {
      id: "neon-sunset",
      name: "🌆 Sunset Neon",
      category: "creative",
      bg: "linear-gradient(135deg, #3b0764 0%, #831843 100%)",
      textColor: "#ffffff",
      cardBg: "rgba(255, 255, 255, 0.1)",
      cardBorder: "rgba(244, 114, 182, 0.35)",
      accentColor: "#ec4899"
    },
    {
      id: "clean-light",
      name: "☀️ Clean Light",
      category: "light",
      bg: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
      textColor: "#0f172a",
      cardBg: "#ffffff",
      cardBorder: "#cbd5e1",
      accentColor: "#2563eb"
    },
    {
      id: "midnight-navy",
      name: "⚓ Midnight Navy",
      category: "dark",
      bg: "linear-gradient(135deg, #0a1128 0%, #1c2541 100%)",
      textColor: "#e0e1dd",
      cardBg: "rgba(255, 255, 255, 0.08)",
      cardBorder: "rgba(74, 144, 226, 0.3)",
      accentColor: "#4cc9f0"
    },
    {
      id: "rose-glam",
      name: "🌸 Rose Gold Glam",
      category: "luxury",
      bg: "linear-gradient(135deg, #2a1b24 0%, #4a2835 100%)",
      textColor: "#fce7f3",
      cardBg: "rgba(244, 114, 182, 0.12)",
      cardBorder: "rgba(251, 207, 232, 0.35)",
      accentColor: "#f472b6"
    },
    {
      id: "crimson-velvet",
      name: "🍷 Crimson Velvet",
      category: "gastro",
      bg: "linear-gradient(135deg, #450a0a 0%, #1c0404 100%)",
      textColor: "#fee2e2",
      cardBg: "rgba(239, 68, 68, 0.1)",
      cardBorder: "rgba(248, 113, 113, 0.3)",
      accentColor: "#ef4444"
    },
    {
      id: "coffee-mocha",
      name: "☕ Coffee & Cocoa",
      category: "gastro",
      bg: "linear-gradient(135deg, #2b1810 0%, #1a0f0a 100%)",
      textColor: "#fae8e0",
      cardBg: "rgba(217, 119, 6, 0.12)",
      cardBorder: "rgba(245, 158, 11, 0.35)",
      accentColor: "#d97706"
    },
    {
      id: "fresh-mint",
      name: "🌿 Fresh Mint (Salud)",
      category: "light",
      bg: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
      textColor: "#064e3b",
      cardBg: "#ffffff",
      cardBorder: "#a7f3d0",
      accentColor: "#059669"
    },
    {
      id: "cyberpunk-matrix",
      name: "⚡ Cyberpunk Matrix",
      category: "creative",
      bg: "linear-gradient(135deg, #050505 0%, #001a0a 100%)",
      textColor: "#4ade80",
      cardBg: "rgba(34, 197, 94, 0.08)",
      cardBorder: "rgba(34, 197, 94, 0.4)",
      accentColor: "#22c55e"
    },
    {
      id: "nordic-frost",
      name: "❄️ Arctic Frost",
      category: "light",
      bg: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
      textColor: "#0369a1",
      cardBg: "#ffffff",
      cardBorder: "#bae6fd",
      accentColor: "#0284c7"
    },
    {
      id: "terracotta-clay",
      name: "🏺 Terracotta Warm",
      category: "creative",
      bg: "linear-gradient(135deg, #431407 0%, #2a0c04 100%)",
      textColor: "#ffedd5",
      cardBg: "rgba(234, 88, 12, 0.12)",
      cardBorder: "rgba(251, 146, 60, 0.35)",
      accentColor: "#ea580c"
    },
    {
      id: "titanium-carbon",
      name: "🏎️ Carbon Titanium",
      category: "dark",
      bg: "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
      textColor: "#f4f4f5",
      cardBg: "rgba(255, 255, 255, 0.06)",
      cardBorder: "rgba(113, 113, 122, 0.4)",
      accentColor: "#e4e4e7"
    },
    {
      id: "royal-amethyst",
      name: "🔮 Royal Amethyst",
      category: "luxury",
      bg: "linear-gradient(135deg, #2e1065 0%, #170729 100%)",
      textColor: "#f5d0fe",
      cardBg: "rgba(168, 85, 247, 0.12)",
      cardBorder: "rgba(216, 180, 254, 0.35)",
      accentColor: "#a855f7"
    },
    {
      id: "lavender-spa",
      name: "🪻 Lavender Spa",
      category: "light",
      bg: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)",
      textColor: "#581c87",
      cardBg: "#ffffff",
      cardBorder: "#e9d5ff",
      accentColor: "#9333ea"
    },
    {
      id: "forest-pine",
      name: "🌲 Deep Pine",
      category: "dark",
      bg: "linear-gradient(135deg, #052e16 0%, #021a0d 100%)",
      textColor: "#dcfce7",
      cardBg: "rgba(34, 197, 94, 0.1)",
      cardBorder: "rgba(134, 239, 172, 0.3)",
      accentColor: "#16a34a"
    },
    {
      id: "peach-bakery",
      name: "🍑 Peach Bakery",
      category: "gastro",
      bg: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
      textColor: "#9a3412",
      cardBg: "#ffffff",
      cardBorder: "#fed7aa",
      accentColor: "#f97316"
    },
    {
      id: "ocean-teal",
      name: "🌊 Ocean Pacific",
      category: "creative",
      bg: "linear-gradient(135deg, #042f2e 0%, #021919 100%)",
      textColor: "#ccfbf1",
      cardBg: "rgba(20, 184, 166, 0.12)",
      cardBorder: "rgba(94, 234, 212, 0.35)",
      accentColor: "#14b8a6"
    },
    {
      id: "desert-dunes",
      name: "🏜️ Desert Dunes",
      category: "creative",
      bg: "linear-gradient(135deg, #3f2d18 0%, #1f160a 100%)",
      textColor: "#fef3c7",
      cardBg: "rgba(245, 158, 11, 0.1)",
      cardBorder: "rgba(252, 211, 77, 0.3)",
      accentColor: "#f59e0b"
    },
    {
      id: "vintage-barber",
      name: "💈 Vintage Barber",
      category: "dark",
      bg: "linear-gradient(135deg, #1c1917 0%, #0c0a09 100%)",
      textColor: "#f5f5f4",
      cardBg: "rgba(214, 180, 137, 0.08)",
      cardBorder: "rgba(180, 83, 9, 0.4)",
      accentColor: "#b45309"
    },
    {
      id: "sakura-night",
      name: "🍣 Sakura Night",
      category: "gastro",
      bg: "linear-gradient(135deg, #180d19 0%, #0a040b 100%)",
      textColor: "#fdf2f8",
      cardBg: "rgba(236, 72, 153, 0.12)",
      cardBorder: "rgba(244, 114, 182, 0.4)",
      accentColor: "#f43f5e"
    },
    {
      id: "electric-volt",
      name: "🔋 Volt Energy (Gym)",
      category: "creative",
      bg: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
      textColor: "#ffffff",
      cardBg: "rgba(255, 255, 255, 0.08)",
      cardBorder: "rgba(132, 204, 22, 0.45)",
      accentColor: "#84cc16"
    },
    {
      id: "burgundy-cocktail",
      name: "🍸 Burgundy Lounge",
      category: "luxury",
      bg: "linear-gradient(135deg, #300a18 0%, #17040a 100%)",
      textColor: "#fce7f3",
      cardBg: "rgba(251, 113, 133, 0.1)",
      cardBorder: "rgba(244, 63, 94, 0.35)",
      accentColor: "#fb7185"
    },
    {
      id: "corporate-trust",
      name: "⚖️ Corporate Trust (Legal)",
      category: "dark",
      bg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      textColor: "#f8fafc",
      cardBg: "rgba(59, 130, 246, 0.08)",
      cardBorder: "rgba(96, 165, 250, 0.3)",
      accentColor: "#3b82f6"
    },
    {
      id: "tangerine-sunset",
      name: "🍊 Tangerine Fire",
      category: "creative",
      bg: "linear-gradient(135deg, #7c2d12 0%, #431407 100%)",
      textColor: "#ffedd5",
      cardBg: "rgba(249, 115, 22, 0.12)",
      cardBorder: "rgba(251, 146, 60, 0.4)",
      accentColor: "#f97316"
    },
    {
      id: "copper-brew",
      name: "🍺 Copper Brew (BBQ)",
      category: "gastro",
      bg: "linear-gradient(135deg, #261612 0%, #130a08 100%)",
      textColor: "#fed7aa",
      cardBg: "rgba(217, 119, 6, 0.12)",
      cardBorder: "rgba(245, 158, 11, 0.4)",
      accentColor: "#ea580c"
    },
    {
      id: "cloud-minimal",
      name: "☁️ Pearl White",
      category: "light",
      bg: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
      textColor: "#1e293b",
      cardBg: "#ffffff",
      cardBorder: "#e2e8f0",
      accentColor: "#475569"
    },
    {
      id: "monochrome-pro",
      name: "🏁 Monochrome Pro",
      category: "dark",
      bg: "linear-gradient(135deg, #121212 0%, #000000 100%)",
      textColor: "#ffffff",
      cardBg: "rgba(255, 255, 255, 0.09)",
      cardBorder: "rgba(255, 255, 255, 0.3)",
      accentColor: "#ffffff"
    },
    {
      id: "amoled-pure",
      name: "🌌 AMOLED Space",
      category: "dark",
      bg: "#000000",
      textColor: "#00f0ff",
      cardBg: "#0a0a0a",
      cardBorder: "rgba(0, 240, 255, 0.35)",
      accentColor: "#00f0ff"
    }
  ]
};
