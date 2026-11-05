/**
 * LINKTREE VIEWER ENGINE - ALVAP COMPANY
 * Carga de perfiles, aplicación de estilos y telemetría de clics/visitas 100% gratis
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const businessId = urlParams.get("id") || (window.INITIAL_BUSINESS ? window.INITIAL_BUSINESS.id : "alvap-studio");

  // Generar o recuperar ID anónimo de visitante para analíticas únicas
  let visitorId = localStorage.getItem("alvap_visitor_id");
  if (!visitorId) {
    visitorId = "v_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem("alvap_visitor_id", visitorId);
  }

  // Inicializar carga
  document.addEventListener("DOMContentLoaded", () => {
    loadBusinessProfile(businessId);
  });

  async function loadBusinessProfile(id) {
    let data = window.INITIAL_BUSINESS || null;

    // 1. Siempre intentar buscar la versión más fresca en data/businesses.json evitando caché
    try {
      const jsonPath = window.location.pathname.includes("/negocios/") ? "../../data/businesses.json" : "../data/businesses.json";
      const res = await fetch(`${jsonPath}?_t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const dict = await res.json();
        if (dict && dict[id]) {
          data = dict[id];
        }
      }
    } catch (e) {
      console.warn("Buscando en fuentes secundarias:", e);
    }

    // 2. Si no se encontró o hay cambios locales recientes en el navegador del admin
    try {
      const localCache = localStorage.getItem("alvap_biz_" + id);
      if (localCache) {
        const parsed = JSON.parse(localCache);
        if (!data || (parsed.fecha_actualizacion && (!data.fecha_actualizacion || new Date(parsed.fecha_actualizacion) > new Date(data.fecha_actualizacion)))) {
          data = parsed;
        }
      }
    } catch (e) {}

    // 3. Consultar Google Apps Script si está disponible
    if ((!data || !data.nombre_negocio) && typeof CONFIG !== "undefined" && CONFIG.googleAppsScriptUrl) {
      try {
        const gasRes = await fetch(`${CONFIG.googleAppsScriptUrl}?action=get_business&id=${encodeURIComponent(id)}&_t=${Date.now()}`);
        const json = await gasRes.json();
        if (json.success && json.data) {
          data = json.data;
        }
      } catch (e) {
        console.warn("Error consultando Google Apps Script:", e);
      }
    }

    // Si sigue sin datos, usar plantilla de demostración
    if (!data) {
      data = {
        id: id,
        nombre_negocio: "Negocio " + id,
        categoria: "Comercio Local",
        descripcion: "Bienvenido a nuestro perfil oficial interactivo.",
        avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
        portada_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80",
        tema: "modern-dark",
        boton_whatsapp: "https://wa.me/5215512345678",
        boton_facebook: "https://facebook.com",
        boton_instagram: "https://instagram.com",
        boton_ubicacion: "https://maps.google.com",
        color_primario: "#6366f1",
        color_acento: "#a855f7"
      };
    }

    renderProfile(data);
    trackEvent(data.id, "view", "pageview");
  }

  function renderProfile(b) {
    document.title = `${b.nombre_negocio} | Enlaces Oficiales`;

    // Aplicar tema
    applyTheme(b.tema, b.color_primario, b.color_acento);

    const app = document.getElementById("app");
    if (!app) return;

    // Construcción de botones configurados
    const buttons = [];

    if (b.boton_whatsapp) {
      buttons.push({
        id: "whatsapp",
        title: "Contactar por WhatsApp",
        subtitle: "Respuesta inmediata y cotizaciones",
        url: b.boton_whatsapp,
        icon: "fab fa-whatsapp",
        customClass: "icon-whatsapp"
      });
    }

    if (b.boton_instagram) {
      buttons.push({
        id: "instagram",
        title: "Instagram Oficial",
        subtitle: "Fotos, promociones e historias",
        url: b.boton_instagram,
        icon: "fab fa-instagram",
        customClass: "icon-instagram"
      });
    }

    if (b.boton_facebook) {
      buttons.push({
        id: "facebook",
        title: "Página de Facebook",
        subtitle: "Comunidad y publicaciones",
        url: b.boton_facebook,
        icon: "fab fa-facebook-f",
        customClass: "icon-facebook"
      });
    }

    if (b.boton_ubicacion) {
      buttons.push({
        id: "ubicacion",
        title: "Cómo Llegar (Google Maps)",
        subtitle: "Ver dirección y navegar en GPS",
        url: b.boton_ubicacion,
        icon: "fas fa-map-marker-alt",
        customClass: "icon-ubicacion"
      });
    }

    if (b.boton_extra_url && b.boton_extra_label) {
      buttons.push({
        id: "extra",
        title: b.boton_extra_label,
        subtitle: "Enlace destacado del negocio",
        url: b.boton_extra_url,
        icon: "fas fa-external-link-alt",
        customClass: "icon-extra"
      });
    }

    // Botones adicionales dinámicos
    if (Array.isArray(b.botones_adicionales)) {
      b.botones_adicionales.forEach((btn, idx) => {
        if (btn && btn.url && btn.label) {
          buttons.push({
            id: btn.id || "extra_" + idx,
            title: btn.label,
            subtitle: "Enlace directo",
            url: btn.url,
            icon: btn.icon || "fas fa-link",
            customColor: btn.color || b.color_primario
          });
        }
      });
    }

    const reviewUrl = b.link_google_negocio || b.boton_ubicacion || "#";

    app.innerHTML = `
      <div class="header-card">
        ${b.portada_url ? `<img class="cover-banner" src="${b.portada_url}" alt="Portada">` : ""}
        <div class="avatar-wrapper">
          <img class="avatar-img" src="${b.avatar_url || 'https://via.placeholder.com/150'}" alt="${b.nombre_negocio}">
          <span class="verified-badge" title="Negocio Verificado Alvap"><i class="fas fa-check"></i></span>
        </div>
        <h1 class="business-title">${b.nombre_negocio}</h1>
        ${b.categoria ? `<span class="business-category">${b.categoria}</span>` : ""}
        ${b.descripcion ? `<p class="business-desc">${b.descripcion}</p>` : ""}
        
        <a href="${reviewUrl}" target="_blank" rel="noopener noreferrer" class="google-badge" onclick="trackClick('${b.id}', 'google_reviews_badge')">
          <i class="fab fa-google" style="color: #4285F4;"></i>
          <span>4.9</span>
          <span class="stars">★★★★★</span>
          <span style="opacity: 0.8; font-size: 0.78rem;">(Reseñas)</span>
        </a>
      </div>

      <div class="links-list">
        ${buttons.map(btn => `
          <a href="${btn.url}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="link-btn" 
             data-btn-id="${btn.id}"
             onclick="return handleButtonClick(event, '${b.id}', '${btn.id}', '${btn.url}')">
            <div class="link-icon-box ${btn.customClass || ''}" style="${btn.customColor ? `background: ${btn.customColor};` : ''}">
              <i class="${btn.icon}"></i>
            </div>
            <div class="link-content">
              <span class="link-title">${btn.title}</span>
              <span class="link-subtitle">${btn.subtitle}</span>
            </div>
            <i class="fas fa-chevron-right link-arrow"></i>
          </a>
        `).join("")}
      </div>

      <div class="linktree-footer">
        <button class="share-action-btn" onclick="openShareModal('${b.nombre_negocio}')" title="Compartir este perfil">
          <i class="fas fa-share-alt"></i>
        </button>
        <p>Potenciado por <a href="#" class="footer-brand">Alvap Company</a> • Tarjetas NFC</p>
      </div>

      <!-- Modal Compartir y QR -->
      <div id="shareModal" class="modal-overlay" onclick="closeShareModal(event)">
        <div class="modal-card" onclick="event.stopPropagation()">
          <h3>Compartir Perfil</h3>
          <p style="font-size: 0.85rem; opacity: 0.8;">Escanea con tu teléfono o acerca tu tarjeta NFC</p>
          <div class="qr-box">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(window.location.href)}" alt="QR Code">
          </div>
          <div>
            <button class="close-modal-btn" onclick="copyProfileUrl()">Copiar Enlace</button>
            <button class="close-modal-btn" style="background: #334155; margin-left: 8px;" onclick="closeShareModal()">Cerrar</button>
          </div>
        </div>
      </div>
    `;
  }

  function applyTheme(themeId, primary, accent) {
    if (typeof CONFIG !== "undefined" && CONFIG.themes) {
      const theme = CONFIG.themes.find(t => t.id === themeId);
      if (theme) {
        document.documentElement.style.setProperty("--bg-gradient", theme.bg);
        document.documentElement.style.setProperty("--text-color", theme.textColor);
        document.documentElement.style.setProperty("--card-bg", theme.cardBg);
        document.documentElement.style.setProperty("--card-border", theme.cardBorder);
      }
    }
    if (primary) document.documentElement.style.setProperty("--primary-color", primary);
    if (accent) document.documentElement.style.setProperty("--accent-color", accent);
  }

  /**
   * Manejador de clic con telemetría no bloqueante
   */
  window.handleButtonClick = function (event, bId, btnId, targetUrl) {
    trackEvent(bId, "click", btnId);
    // Si es un enlace normal target=_blank, dejamos que el navegador proceda de inmediato
    return true;
  };

  window.trackClick = function (bId, btnId) {
    trackEvent(bId, "click", btnId);
  };

  /**
   * Envía telemetría a Google Apps Script (100% Gratis)
   */
  function trackEvent(bId, type, buttonId) {
    const payload = {
      action: "track_event",
      business_id: bId,
      tipo_evento: type,
      target_boton: buttonId,
      visitor_id: visitorId,
      user_agent: navigator.userAgent,
      referencia: document.referrer || "direct"
    };

    // 1. Guardar en registro local para que el panel cliente offline/local también lo muestre
    try {
      const statsKey = "alvap_stats_" + bId;
      const stats = JSON.parse(localStorage.getItem(statsKey) || '{"views":0,"clicks":{},"visitors":[]}');
      if (type === "view") {
        stats.views = (stats.views || 0) + 1;
        if (!stats.visitors.includes(visitorId)) stats.visitors.push(visitorId);
      } else if (type === "click") {
        stats.clicks[buttonId] = (stats.clicks[buttonId] || 0) + 1;
      }
      localStorage.setItem(statsKey, JSON.stringify(stats));
    } catch (e) {}

    // 2. Transmitir a Google Apps Script si está configurado
    const gasUrl = (typeof CONFIG !== "undefined" && CONFIG.googleAppsScriptUrl) 
      ? CONFIG.googleAppsScriptUrl 
      : localStorage.getItem("alvap_gas_url");

    if (gasUrl) {
      try {
        // Enviar con navigator.sendBeacon o fetch asíncrono
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(gasUrl, blob);
        } else {
          fetch(gasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("Fallo telemetría GAS:", err);
      }
    }
  }

  // Funciones de Modal y Compartir
  window.openShareModal = function () {
    const m = document.getElementById("shareModal");
    if (m) m.classList.add("active");
  };

  window.closeShareModal = function (e) {
    if (e && e.target !== e.currentTarget && !e.target.classList.contains("close-modal-btn")) return;
    const m = document.getElementById("shareModal");
    if (m) m.classList.remove("active");
  };

  window.copyProfileUrl = function () {
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert("¡Enlace copiado al portapapeles!");
    }).catch(() => {
      prompt("Copia este enlace:", window.location.href);
    });
  };

})();
