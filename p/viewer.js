/**
 * LINKTREE VIEWER ENGINE - ALVAP COMPANY
 * Carga de perfiles, aplicación de estilos y telemetría de clics/visitas 100% gratis
 */

(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const businessId = urlParams.get("id") || (window.INITIAL_BUSINESS ? window.INITIAL_BUSINESS.id : "alvap-studio");
  let lastRenderedSignature = "";
  let hasTrackedInitialView = false;
  let currentBusinessData = null;

  // Limpiar Cache Storage, Service Workers y caché local de perfil en móviles (iOS/Android)
  function purgeBrowserCaches(refreshCss = false) {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("alvap_stats_") || k.startsWith("alvap_biz_")) {
          localStorage.removeItem(k);
        }
      });
      if ("caches" in window && typeof window.caches.keys === "function") {
        window.caches.keys().then(keys => {
          keys.forEach(k => window.caches.delete(k));
        }).catch(() => {});
      }
      if ("serviceWorker" in navigator && typeof navigator.serviceWorker.getRegistrations === "function") {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(reg => reg.unregister());
        }).catch(() => {});
      }
      if (refreshCss) {
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          const href = link.getAttribute("href") || "";
          if (href.includes("viewer.css")) {
            link.setAttribute("href", href.split("?")[0] + "?_cb=" + Date.now());
          }
        });
      }
    } catch (e) {}
  }

  function decodeGitHubBase64Utf8(b64) {
    const cleanB64 = (b64 || "").replace(/\s/g, "");
    const binStr = atob(cleanB64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  }

  function getBizTimestamp(b) {
    if (!b || !b.fecha_actualizacion) return 0;
    const t = new Date(b.fecha_actualizacion).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function pickNewestBusiness(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return getBizTimestamp(b) >= getBizTimestamp(a) ? b : a;
  }

  function resolveStandaloneRepoSlug() {
    if (window.STANDALONE_REPO) {
      const segments = window.location.pathname.split("/").filter(Boolean);
      const ignored = ["linktrees", "p", "negocios", "admin", "client"];
      if (segments.length > 0 && !ignored.includes(segments[0].toLowerCase()) && !segments[0].endsWith(".html")) {
        return segments[0];
      }
      if (window.INITIAL_BUSINESS && window.INITIAL_BUSINESS.github_repo) {
        return String(window.INITIAL_BUSINESS.github_repo).split("/").pop();
      }
      return businessId;
    }
    const segments = window.location.pathname.split("/").filter(Boolean);
    const ignored = ["linktrees", "p", "negocios", "admin", "client"];
    if (segments.length > 0 && !ignored.includes(segments[0].toLowerCase()) && !segments[0].endsWith(".html")) {
      return segments[0];
    }
    return null;
  }

  async function fetchGitHubContentsJson(owner, repo, filePath, token) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath}?_t=${Date.now()}`;
    const headers = { "Accept": "application/vnd.github.v3+json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let res = await fetch(url, { headers, cache: "no-store" });
    if (res.status === 401 && headers["Authorization"]) {
      delete headers["Authorization"];
      res = await fetch(url, { headers, cache: "no-store" });
    }
    if (!res.ok) return null;
    const fileData = await res.json();
    const decoded = decodeGitHubBase64Utf8(fileData.content || "");
    return JSON.parse(decoded);
  }

  async function fetchFreshBusinessFromGitHubApi(id) {
    const owner = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.owner) ? CONFIG.github.owner : "alvapcompany";
    const mainRepo = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.repo) ? CONFIG.github.repo : "linktrees";
    const token = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.token) ? CONFIG.github.token.trim() : "";

    try {
      const fallbackRepo = (window.INITIAL_BUSINESS && window.INITIAL_BUSINESS.github_repo)
        ? String(window.INITIAL_BUSINESS.github_repo).split("/").pop()
        : id;
      const standaloneSlug = resolveStandaloneRepoSlug() || (window.STANDALONE_REPO ? fallbackRepo : null);

      const [standaloneBiz, dict] = await Promise.all([
        standaloneSlug ? fetchGitHubContentsJson(owner, standaloneSlug, "business.json", token) : Promise.resolve(null),
        fetchGitHubContentsJson(owner, mainRepo, "data/businesses.json", token)
      ]);

      const validStandalone = (standaloneBiz && (standaloneBiz.id || standaloneBiz.nombre_negocio)) ? standaloneBiz : null;
      const mainBiz = (dict && dict[id]) ? dict[id] : null;
      return pickNewestBusiness(validStandalone, mainBiz);
    } catch (e) {
      console.warn("GitHub API live fetch omitido:", e);
    }
    return null;
  }

  async function fetchStaticFreshBusiness(id) {
    const noCacheOpts = {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      }
    };

    if (window.STANDALONE_REPO) {
      try {
        const res = await fetch(`./business.json?_t=${Date.now()}`, noCacheOpts);
        if (res.ok) {
          const standaloneData = await res.json();
          if (standaloneData && (standaloneData.id || standaloneData.nombre_negocio)) {
            return standaloneData;
          }
        }
      } catch (e) {}
    }

    try {
      const jsonPath = window.location.pathname.includes("/negocios/") ? "../../data/businesses.json" : "../data/businesses.json";
      const res = await fetch(`${jsonPath}?_t=${Date.now()}`, noCacheOpts);
      if (res.ok) {
        const dict = await res.json();
        if (dict && dict[id]) {
          return dict[id];
        }
      }
    } catch (e) {}

    return null;
  }

  // Generar o recuperar ID anónimo de visitante para analíticas únicas
  let visitorId = localStorage.getItem("alvap_visitor_id");
  if (!visitorId) {
    visitorId = "v_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem("alvap_visitor_id", visitorId);
  }

  purgeBrowserCaches();

  // Inicializar carga y recargar en vivo al regresar desde segundo plano en iPhone/Android
  document.addEventListener("DOMContentLoaded", () => {
    loadBusinessProfile(businessId, false);
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      purgeBrowserCaches(true);
      window.location.reload();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      purgeBrowserCaches(true);
      loadBusinessProfile(businessId, true);
    }
  });

  async function loadBusinessProfile(id, isSilentRefresh = false) {
    // Consultar GitHub API en vivo (sin caché CDN) + JSON estático en paralelo
    const [apiData, staticData] = await Promise.all([
      fetchFreshBusinessFromGitHubApi(id),
      fetchStaticFreshBusiness(id)
    ]);

    let networkData = pickNewestBusiness(apiData, staticData);
    let data = networkData || window.INITIAL_BUSINESS || null;

    // Priorizar siempre la red fresca; usar localStorage solo como respaldo offline
    try {
      if (networkData) {
        localStorage.setItem("alvap_biz_" + id, JSON.stringify(networkData));
      } else {
        const localCache = localStorage.getItem("alvap_biz_" + id);
        if (localCache) {
          const parsed = JSON.parse(localCache);
          if (parsed && parsed.nombre_negocio) {
            data = pickNewestBusiness(window.INITIAL_BUSINESS || null, parsed);
          }
        }
      }
    } catch (e) {}

    // Consultar Google Apps Script si aún faltan datos
    if ((!data || !data.nombre_negocio) && typeof CONFIG !== "undefined" && CONFIG.googleAppsScriptUrl) {
      try {
        const gasRes = await fetch(`${CONFIG.googleAppsScriptUrl}?action=get_business&id=${encodeURIComponent(id)}&_t=${Date.now()}`, { cache: "no-store" });
        const json = await gasRes.json();
        if (json.success && json.data) {
          data = json.data;
        }
      } catch (e) {
        console.warn("Error consultando Google Apps Script:", e);
      }
    }

    // Plantilla de demostración si no existe aún
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

    currentBusinessData = data;

    const signature = JSON.stringify(data);
    if (!isSilentRefresh || signature !== lastRenderedSignature) {
      lastRenderedSignature = signature;
      renderProfile(data);
    }

    if (!isSilentRefresh && !hasTrackedInitialView) {
      hasTrackedInitialView = true;
      trackEvent(data.id || id, "view", "pageview");
    }
  }

  function renderProfile(b) {
    document.title = `${b.nombre_negocio} | Enlaces Oficiales`;

    // Aplicar tema
    applyTheme(b.tema, b.color_primario, b.color_acento, b.custom_colors_active);

    const app = document.getElementById("app");
    if (!app) return;

    // Construcción de botones configurados
    const buttons = [];
    const estilo = b.estilo_botones || "icon_only";

    if (b.boton_whatsapp) {
      buttons.push({
        id: "whatsapp",
        title: "Contactar por WhatsApp",
        subtitle: "Respuesta inmediata y cotizaciones",
        url: b.boton_whatsapp,
        icon: "fab fa-whatsapp",
        customClass: "icon-whatsapp",
        customColor: b.color_btn_whatsapp || "#25D366"
      });
    }

    if (b.boton_instagram) {
      buttons.push({
        id: "instagram",
        title: "Instagram Oficial",
        subtitle: "Fotos, promociones e historias",
        url: b.boton_instagram,
        icon: "fab fa-instagram",
        customClass: "icon-instagram",
        customColor: b.color_btn_instagram || "#E1306C"
      });
    }

    if (b.boton_facebook) {
      buttons.push({
        id: "facebook",
        title: "Página de Facebook",
        subtitle: "Comunidad y publicaciones",
        url: b.boton_facebook,
        icon: "fab fa-facebook-f",
        customClass: "icon-facebook",
        customColor: b.color_btn_facebook || "#1877F2"
      });
    }

    if (b.boton_ubicacion) {
      buttons.push({
        id: "ubicacion",
        title: "Cómo Llegar (Google Maps)",
        subtitle: "Ver dirección y navegar en GPS",
        url: b.boton_ubicacion,
        icon: "fas fa-map-marker-alt",
        customClass: "icon-ubicacion",
        customColor: b.color_btn_ubicacion || "#EA4335"
      });
    }

    if (b.boton_extra_url && b.boton_extra_label) {
      buttons.push({
        id: "extra",
        title: b.boton_extra_label,
        subtitle: "Enlace destacado del negocio",
        url: b.boton_extra_url,
        icon: "fas fa-external-link-alt",
        customClass: "icon-extra",
        customColor: b.color_btn_extra || b.color_primario || "#eab308"
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

    // Aplicar orden personalizado definido por el cliente o admin
    if (Array.isArray(b.orden_botones) && b.orden_botones.length > 0) {
      buttons.sort((a, btnB) => {
        const idxA = b.orden_botones.indexOf(a.id);
        const idxB = b.orden_botones.indexOf(btnB.id);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    }

    const effectiveBizId = b.id || businessId;
    const googleInfo = resolveGooglePlaceInfo(b.link_google_negocio);

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
        
        ${googleInfo ? `<a href="${escapeHtml(googleInfo.url)}" target="_blank" rel="noopener noreferrer" class="google-badge" onclick="trackClick('${effectiveBizId}', 'google_reviews_badge')">
          <i class="fab fa-google" style="color: #4285F4;"></i>
          <span>Reseñas Google</span>
          <span class="stars">★★★★★</span>
        </a>` : ""}
      </div>

      <div class="links-list">
        ${buttons.map(btn => {
          let cardStyle = "";
          let iconStyle = btn.customColor ? `background: ${btn.customColor};` : "";
          if (estilo === "full_card") {
            cardStyle = `background: ${btn.customColor}; color: #ffffff; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 4px 15px rgba(0,0,0,0.25);`;
            iconStyle = `background: rgba(0, 0, 0, 0.25); color: #ffffff;`;
          } else if (estilo === "border_glow") {
            cardStyle = `border: 1.5px solid ${btn.customColor}; box-shadow: 0 0 15px ${btn.customColor}40;`;
          } else if (btn.customColor) {
            cardStyle = `border-color: ${btn.customColor}55;`;
          }
          return `
            <a href="${btn.url}" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="link-btn ${estilo === 'full_card' ? 'link-btn-full' : ''}" 
               style="${cardStyle}"
               data-btn-id="${btn.id}"
               onclick="return handleButtonClick(event, '${effectiveBizId}', '${btn.id}', '${btn.url}')">
              <div class="link-icon-box ${btn.customClass || ''}" style="${iconStyle}">
                <i class="${btn.icon}"></i>
              </div>
              <div class="link-content">
                <span class="link-title">${btn.title}</span>
                <span class="link-subtitle" ${estilo === 'full_card' ? 'style="opacity: 0.9;"' : ''}>${btn.subtitle}</span>
              </div>
              <i class="fas fa-chevron-right link-arrow"></i>
            </a>
          `;
        }).join("")}
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

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function resolveGooglePlaceInfo(rawInput) {
    const clean = (rawInput || "").trim();
    if (!clean) return null;
    const pidMatch = clean.match(/(?:placeid=|place_id:|^)(ChIJ[a-zA-Z0-9_-]+)/i);
    const placeId = pidMatch ? pidMatch[1] : "";
    const url = /^https?:\/\//i.test(clean)
      ? clean
      : (placeId ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`);
    return { placeId, url };
  }

  function applyTheme(themeId, primary, accent, customColorsActive) {
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
    if (customColorsActive && primary && accent) {
      document.documentElement.style.setProperty(
        "--bg-gradient",
        `radial-gradient(circle at 18% 15%, ${primary}66 0%, transparent 55%), radial-gradient(circle at 82% 85%, ${accent}66 0%, transparent 55%), linear-gradient(135deg, ${primary}38 0%, ${accent}38 100%), #090d16`
      );
      document.documentElement.style.setProperty("--card-border", `${primary}55`);
    }
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
   * Envía telemetría a Google Apps Script (100% Gratis, sin bloqueo CORS preflight)
   */
  function trackEvent(bId, type, buttonId) {
    const cleanBizId = (bId || businessId || "").trim().toLowerCase();
    const cleanBtnId = (buttonId || "").trim().toLowerCase();
    const todayKey = new Date().toISOString().split("T")[0];

    // Transmitir directamente a Google Apps Script vía GET (?action=track) para evitar bloqueo OPTIONS preflight en Chrome/Safari
    const gasUrl = (currentBusinessData && currentBusinessData.gas_url)
      || (window.INITIAL_BUSINESS && window.INITIAL_BUSINESS.gas_url)
      || ((typeof CONFIG !== "undefined" && CONFIG.googleAppsScriptUrl)
        ? CONFIG.googleAppsScriptUrl
        : localStorage.getItem("alvap_gas_url"));

    if (gasUrl) {
      try {
        const trackParams = new URLSearchParams({
          action: "track",
          id: cleanBizId,
          type: type || "view",
          button: (type === "click" && cleanBtnId) ? `${cleanBtnId}__${todayKey}` : cleanBtnId,
          visitor: visitorId || "anon",
          ua: (navigator.userAgent || "").substring(0, 160),
          ref: document.referrer || "direct",
          _t: String(Date.now())
        });
        const trackUrl = `${gasUrl}${gasUrl.includes("?") ? "&" : "?"}${trackParams.toString()}`;
        fetch(trackUrl, {
          method: "GET",
          mode: "no-cors",
          keepalive: true,
          cache: "no-store"
        }).catch(() => {
          try {
            const img = new Image();
            img.src = trackUrl;
          } catch (e) {}
        });
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
