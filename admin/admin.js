/**
 * PANEL ADMINISTRATIVO - LINKTREE ALVAP COMPANY
 * Lógica de edición por IDs, live preview, guardado en Google Sheets y auto-commit a GitHub
 */

let businesses = {};
let currentId = "alvap-studio";

// Firma criptogr�fica SHA-256 de autorizaci�n (imposible de revertir desde el repositorio)
const SECURE_AUTH_HASH = "e318981c6fc3f0613db54042d31b4dc3afeadfd2904b0b92cef04229b28ac56f";

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function checkAdminAuth() {
  const isAuth = sessionStorage.getItem("alvap_admin_authenticated");
  const lock = document.getElementById("authLockScreen");
  if (isAuth === "true") {
    if (lock) lock.style.display = "none";
  } else {
    if (lock) lock.style.display = "flex";
  }
}

window.handleAdminLogin = async function (e) {
  if (e) e.preventDefault();
  const input = document.getElementById("adminSecretInput");
  const errorMsg = document.getElementById("authErrorMsg");
  if (!input) return;

  const enteredHash = await sha256(input.value.trim());
  if (enteredHash === SECURE_AUTH_HASH) {
    sessionStorage.setItem("alvap_admin_authenticated", "true");
    const lock = document.getElementById("authLockScreen");
    if (lock) lock.style.display = "none";
  } else {
    if (errorMsg) errorMsg.style.display = "block";
    input.value = "";
    input.focus();
  }
};

window.logoutAdmin = function () {
  sessionStorage.removeItem("alvap_admin_authenticated");
  window.location.reload();
};

document.addEventListener("DOMContentLoaded", async () => {
  checkAdminAuth();
  loadStoredSettings();
  renderThemeGrid();
  await loadBusinessesData();

  const urlId = new URLSearchParams(window.location.search).get("id");
  if (urlId && businesses[urlId]) {
    currentId = urlId;
  }

  initIdSelector();
  selectBusiness(currentId);
  renderLinkedReposDirectory();
  setupEventListeners();
  updateLivePreview();
});

/**
 * Carga configuraciones almacenadas (Token de GitHub y URL de Google Apps Script)
 */
function loadStoredSettings() {
  const defaultToken = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.token) ? CONFIG.github.token : ""; const defaultGas = (typeof CONFIG !== "undefined" && CONFIG.googleAppsScriptUrl) ? CONFIG.googleAppsScriptUrl : ""; let ghToken = localStorage.getItem("alvap_github_token") || defaultToken;
  const ghOwner = localStorage.getItem("alvap_github_owner") || (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.owner) || "alvapcompany";
  const ghRepo = localStorage.getItem("alvap_github_repo") || (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.repo) || "linktrees";
  let gasUrl = localStorage.getItem("alvap_gas_url") || defaultGas;

  const tokenInput = document.getElementById("cfgGithubToken");
  const ownerInput = document.getElementById("cfgGithubOwner");
  const repoInput = document.getElementById("cfgGithubRepo");
  const gasInput = document.getElementById("cfgGasUrl");

  if (tokenInput) tokenInput.value = ghToken;
  if (ownerInput) ownerInput.value = ghOwner;
  if (repoInput) repoInput.value = ghRepo;
  if (gasInput) gasInput.value = gasUrl;

  updateConnectionBadges(ghToken, gasUrl);
}

function updateConnectionBadges(token, gasUrl) {
  const ghStatus = document.getElementById("githubStatusBadge");
  const gasStatus = document.getElementById("gasStatusBadge");

  if (ghStatus) {
    if (token) {
      ghStatus.innerHTML = '<i class="fas fa-check-circle"></i> GitHub Conectado';
      ghStatus.className = "brand-badge";
      ghStatus.style.background = "#10b981";
    } else {
      ghStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Token pendiente';
      ghStatus.className = "brand-badge";
      ghStatus.style.background = "#f59e0b";
    }
  }

  if (gasStatus) {
    if (gasUrl) {
      gasStatus.innerHTML = '<i class="fas fa-table"></i> Sheets Activo';
      gasStatus.className = "brand-badge";
      gasStatus.style.background = "#0284c7";
    } else {
      gasStatus.innerHTML = '<i class="fas fa-database"></i> Local/Offline';
      gasStatus.className = "brand-badge";
      gasStatus.style.background = "#6b7280";
    }
  }
}

/**
 * Carga los datos de los negocios desde data/businesses.json o localStorage
 */
async function loadBusinessesData() {
  const defaultOwner = ((document.getElementById("cfgGithubOwner") && document.getElementById("cfgGithubOwner").value) || "alvapcompany").trim();
  let remoteBusinesses = {};

  try {
    const res = await fetch(`../data/businesses.json?_t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      remoteBusinesses = await res.json();
    }
  } catch (e) {
    console.warn("Cargando desde almacenamiento local:", e);
  }

  let localParsed = {};
  const localList = localStorage.getItem("alvap_all_businesses");
  if (localList) {
    try {
      localParsed = JSON.parse(localList) || {};
    } catch (e) {}
  }

  // Fusión inteligente: no sobrescribir negocios más recientes del servidor ni perder metadata de repos
  if (typeof GitHubSync !== "undefined" && GitHubSync.mergeBusinessesMaps) {
    businesses = GitHubSync.mergeBusinessesMaps(remoteBusinesses, localParsed, null, null, defaultOwner);
  } else {
    businesses = { ...localParsed, ...remoteBusinesses };
  }

  // Si no hay datos, inicializar demo
  if (Object.keys(businesses).length === 0) {
    businesses["alvap-studio"] = {
      id: "alvap-studio",
      nombre_negocio: "Alvap Digital Studio",
      categoria: "Agencia NFC & Digital",
      descripcion: "Tarjetas inteligentes NFC y diseño web.",
      avatar_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200",
      portada_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800",
      tema: "modern-dark",
      boton_whatsapp: "https://wa.me/5215512345678",
      boton_facebook: "https://facebook.com/alvapcompany",
      boton_instagram: "https://instagram.com/alvapcompany",
      boton_ubicacion: "https://maps.google.com",
      boton_extra_label: "Catálogo NFC",
      boton_extra_url: "https://alvapcompany.com",
      color_primario: "#6366f1",
      color_acento: "#a855f7",
      link_google_negocio: "https://maps.google.com",
      botones_adicionales: []
    };
  }

  // Garantizar que todos los negocios tengan metadata normalizada de repo + dashboard
  Object.keys(businesses).forEach(id => {
    const b = businesses[id];
    if (b && b.google_reviews) delete b.google_reviews;
    const repoInfo = getResolvedRepoUrls(b.github_repo || id, id);
    const isIndividual = b.deploy_individual_repo !== false;
    businesses[id] = {
      ...b,
      id: b.id || id,
      github_repo: b.github_repo || id,
      deploy_individual_repo: isIndividual,
      repo_url: b.repo_url || (isIndividual ? repoInfo.repoUrl : ""),
      pages_url: b.pages_url || (isIndividual ? repoInfo.pagesUrl : ""),
      dashboard_url: b.dashboard_url || (isIndividual ? repoInfo.dashboardUrl : "")
    };
  });
}

/**
 * Llena el <select> de IDs de negocio
 */
function initIdSelector() {
  const select = document.getElementById("businessSelect");
  if (!select) return;

  select.innerHTML = "";
  Object.keys(businesses).forEach(id => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `${businesses[id].nombre_negocio || id} (${id})`;
    select.appendChild(opt);
  });

  if (businesses[currentId]) {
    select.value = currentId;
  } else {
    currentId = Object.keys(businesses)[0];
    select.value = currentId;
  }
}

/**
 * Selecciona un negocio y puebla el formulario
 */
function selectBusiness(id) {
  if (!businesses[id]) return;
  currentId = id;

  const b = businesses[id];
  document.getElementById("businessId").value = b.id || id;
  document.getElementById("nombreNegocio").value = b.nombre_negocio || "";
  document.getElementById("categoria").value = b.categoria || "";
  document.getElementById("descripcion").value = b.descripcion || "";
  document.getElementById("avatarUrl").value = b.avatar_url || "";
  document.getElementById("portadaUrl").value = b.portada_url || "";
  document.getElementById("linkGoogle").value = b.link_google_negocio || "";
  if (document.getElementById("businessPassword")) {
    document.getElementById("businessPassword").value = b.password || "";
  }
  if (document.getElementById("githubRepoName")) {
    document.getElementById("githubRepoName").value = b.github_repo || id;
  }
  if (document.getElementById("bizGasUrl")) {
    document.getElementById("bizGasUrl").value = b.gas_url || "";
  }
  if (document.getElementById("deployIndividualRepo")) {
    document.getElementById("deployIndividualRepo").checked = b.deploy_individual_repo !== false;
  }

  // Botones principales
  document.getElementById("btnWhatsapp").value = b.boton_whatsapp || "";
  document.getElementById("btnFacebook").value = b.boton_facebook || "";
  document.getElementById("btnInstagram").value = b.boton_instagram || "";
  document.getElementById("btnUbicacion").value = b.boton_ubicacion || "";
  document.getElementById("btnExtraLabel").value = b.boton_extra_label || "";
  document.getElementById("btnExtraUrl").value = b.boton_extra_url || "";

  // Colores individuales de botones
  if (document.getElementById("btnWhatsappColor")) document.getElementById("btnWhatsappColor").value = b.color_btn_whatsapp || "#25D366";
  if (document.getElementById("btnInstagramColor")) document.getElementById("btnInstagramColor").value = b.color_btn_instagram || "#E1306C";
  if (document.getElementById("btnFacebookColor")) document.getElementById("btnFacebookColor").value = b.color_btn_facebook || "#1877F2";
  if (document.getElementById("btnUbicacionColor")) document.getElementById("btnUbicacionColor").value = b.color_btn_ubicacion || "#EA4335";
  if (document.getElementById("btnExtraColor")) document.getElementById("btnExtraColor").value = b.color_btn_extra || "#eab308";
  if (document.getElementById("estiloBotones")) document.getElementById("estiloBotones").value = b.estilo_botones || "icon_only";

  // Colores y Tema
  document.getElementById("colorPrimary").value = b.color_primario || "#6366f1";
  document.getElementById("colorAccent").value = b.color_acento || "#a855f7";

  selectThemeCard(b.tema || "modern-dark");
  renderDynamicButtonsList(b.botones_adicionales || []);
  updateLinkedRepoPreviewLinks();
  renderLinkedReposDirectory();
  updateLivePreview();
}

/**
 * Calcula las URLs del repositorio individual enlazado
 */
function getResolvedRepoUrls(repoInput, idFallback) {
  const defaultOwner = ((document.getElementById("cfgGithubOwner") && document.getElementById("cfgGithubOwner").value) || "alvapcompany").trim();
  const parsed = (typeof GitHubSync !== "undefined" && GitHubSync.parseRepoRef)
    ? GitHubSync.parseRepoRef(repoInput || idFallback, defaultOwner)
    : { owner: defaultOwner, repo: (repoInput || idFallback || "").trim() };
  const pagesUrl = `https://${parsed.owner.toLowerCase()}.github.io/${parsed.repo}/`;
  return {
    owner: parsed.owner,
    repo: parsed.repo,
    fullSlug: `${parsed.owner}/${parsed.repo}`,
    repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
    pagesUrl: pagesUrl,
    dashboardUrl: `${pagesUrl}dashboard.html`
  };
}

/**
 * Actualiza los enlaces visuales e indicadores del repositorio individual enlazado
 */
window.updateLinkedRepoPreviewLinks = function () {
  const id = (document.getElementById("businessId") && document.getElementById("businessId").value) || currentId;
  const repoInput = (document.getElementById("githubRepoName") && document.getElementById("githubRepoName").value) || id;
  const info = getResolvedRepoUrls(repoInput, id);

  const badge = document.getElementById("activeRepoBadge");
  if (badge) {
    badge.innerHTML = `<i class="fab fa-github"></i> Repo: ${escapeHtml(info.fullSlug)}`;
  }

  const previewBadge = document.getElementById("previewRepoBadge");
  if (previewBadge) {
    previewBadge.textContent = info.fullSlug;
  }

  const repoLinkEl = document.getElementById("linkedRepoUrl");
  if (repoLinkEl) {
    repoLinkEl.href = info.repoUrl;
    repoLinkEl.textContent = info.fullSlug;
  }

  const pagesLinkEl = document.getElementById("linkedPagesUrl");
  if (pagesLinkEl) {
    pagesLinkEl.href = info.pagesUrl;
    pagesLinkEl.textContent = info.pagesUrl;
  }

  const dashLinkEl = document.getElementById("linkedDashboardUrl");
  if (dashLinkEl) {
    dashLinkEl.href = info.dashboardUrl;
    dashLinkEl.textContent = info.dashboardUrl;
  }
};

/**
 * Renderiza el directorio central de todos los repositorios de Linktrees enlazados
 */
window.renderLinkedReposDirectory = function () {
  const container = document.getElementById("linkedReposDirectory");
  if (!container) return;

  const keys = Object.keys(businesses);
  if (keys.length === 0) {
    container.innerHTML = `<p style="color: #9ca3af; font-size: 0.85rem;">No hay negocios registrados aún.</p>`;
    return;
  }

  container.innerHTML = keys.map(id => {
    const b = businesses[id];
    const isActive = id === currentId;
    const repoInfo = getResolvedRepoUrls(b.github_repo || id, id);
    const isIndividual = b.deploy_individual_repo !== false;
    const pagesUrl = b.pages_url || (isIndividual ? repoInfo.pagesUrl : `../p/?id=${encodeURIComponent(id)}`);
    const dashboardUrl = b.dashboard_url || (isIndividual ? repoInfo.dashboardUrl : `../client/dashboard.html?id=${encodeURIComponent(id)}`);

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: ${isActive ? 'rgba(99, 102, 241, 0.14)' : '#111827'}; border: 1px solid ${isActive ? '#6366f1' : '#374151'}; border-radius: 12px; padding: 12px 14px;">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 190px;">
          <img src="${escapeHtml(b.avatar_url || 'https://via.placeholder.com/80')}" alt="${escapeHtml(b.nombre_negocio || id)}" style="width: 38px; height: 38px; border-radius: 10px; object-fit: cover; border: 1px solid #4b5563;">
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: #f9fafb; display: flex; align-items: center; gap: 6px;">
              ${escapeHtml(b.nombre_negocio || id)}
              ${isActive ? '<span style="font-size: 0.68rem; background: #6366f1; color: #fff; padding: 2px 6px; border-radius: 6px;">En Editor</span>' : ''}
            </div>
            <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 2px;">
              <i class="fab fa-github"></i> <code>${escapeHtml(repoInfo.fullSlug)}</code>
              <span style="margin-left: 6px; color: ${isIndividual ? '#34d399' : '#fbbf24'};">• ${isIndividual ? 'Repo Individual + Dashboard' : 'Solo Principal'}</span>
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="selectBusinessFromDirectory('${escapeHtml(id)}')" title="Previsualizar y modificar en el editor">
            <i class="fas fa-eye"></i> Preview & Editar
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="deploySingleBusinessRepo('${escapeHtml(id)}')" title="Crear o actualizar este repositorio con Linktree + Dashboard" style="border-color: #6366f1; color: #a5b4fc;">
            <i class="fas fa-cloud-upload-alt"></i> Crear/Actualizar Repo
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="pullFromClientRepo('${escapeHtml(id)}')" title="Leer cambios actuales desde su repositorio individual" style="border-color: #38bdf8; color: #38bdf8;">
            <i class="fas fa-sync-alt"></i> Leer Repo
          </button>
          <a href="${escapeHtml(pagesUrl)}" target="_blank" class="btn btn-secondary btn-sm" title="Abrir Linktree Web en GitHub Pages" style="color: #34d399;">
            <i class="fas fa-external-link-alt"></i> Linktree Web
          </a>
          <a href="${escapeHtml(dashboardUrl)}" target="_blank" class="btn btn-secondary btn-sm" title="Abrir Dashboard de Clics del negocio" style="color: #fbbf24;">
            <i class="fas fa-chart-line"></i> Dashboard
          </a>
          <a href="${escapeHtml(repoInfo.repoUrl)}" target="_blank" class="btn btn-secondary btn-sm" title="Ver código del repositorio en GitHub" style="color: #cbd5e1;">
            <i class="fab fa-github"></i> GitHub Repo
          </a>
        </div>
      </div>
    `;
  }).join("");
};

window.selectBusinessFromDirectory = function (id) {
  const select = document.getElementById("businessSelect");
  if (select) select.value = id;
  selectBusiness(id);
};

/**
 * Selecciona visualmente la tarjeta de tema
 */

/**
 * Renderiza la grilla de 30 temas de CONFIG
 */
function renderThemeGrid() {
  const grid = document.getElementById("themeGrid");
  if (!grid || typeof CONFIG === "undefined" || !CONFIG.themes) return;

  grid.innerHTML = CONFIG.themes.map(t => `
    <div class="theme-card" data-theme="${t.id}" data-category="${t.category || 'all'}">
      <div class="theme-preview-bubble" style="background: ${t.bg}; ${t.cardBorder ? 'border: 1px solid ' + t.cardBorder : ''}"></div>
      <span style="color: ${t.textColor || '#fff'};">${t.name}</span>
    </div>
  `).join("");

  grid.querySelectorAll(".theme-card").forEach(c => {
    c.addEventListener("click", () => {
      grid.querySelectorAll(".theme-card").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      updateLivePreview();
    });
  });
}

window.filterThemes = function (category) {
  document.querySelectorAll(".theme-filters .filter-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === category);
  });
  document.querySelectorAll("#themeGrid .theme-card").forEach(card => {
    if (category === "all") {
      card.style.display = "block";
    } else {
      const cat = card.getAttribute("data-category");
      card.style.display = (cat === category) ? "block" : "none";
    }
  });
};

function selectThemeCard(themeId) {
  document.querySelectorAll(".theme-card").forEach(c => {
    c.classList.toggle("active", c.getAttribute("data-theme") === themeId);
  });
}

function getSelectedTheme() {
  const active = document.querySelector(".theme-card.active");
  return active ? active.getAttribute("data-theme") : "modern-dark";
}

/**
 * Renderiza los botones dinámicos adicionales en el editor
 */
function renderDynamicButtonsList(extraButtons) {
  const container = document.getElementById("extraButtonsContainer");
  if (!container) return;

  container.innerHTML = "";
  extraButtons.forEach((btn, index) => {
    const item = document.createElement("div");
    item.className = "button-item";
    item.innerHTML = `
      <div class="button-item-header">
        <span class="button-tag"><i class="${btn.icon || 'fas fa-link'}"></i> ${btn.label || 'Botón Extra'}</span>
        <button type="button" class="btn btn-secondary btn-sm" onclick="removeDynamicButton(${index})" style="color: #ef4444;">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
      <div class="form-row">
        <input type="text" class="form-control dyn-label" placeholder="Texto del botón" value="${escapeHtml(btn.label || '')}" oninput="updateLivePreview()">
        <input type="url" class="form-control dyn-url" placeholder="https://..." value="${escapeHtml(btn.url || '')}" oninput="updateLivePreview()">
      </div>
      <div class="color-input-wrapper">
        <label style="font-size: 0.78rem; opacity: 0.8;">Color del Botón:</label>
        <input type="color" class="color-picker dyn-color" value="${btn.color || '#6366f1'}" onchange="updateLivePreview()">
      </div>
    `;
    container.appendChild(item);
  });
}

window.addDynamicButton = function () {
  const current = getFormData();
  const list = current.botones_adicionales || [];
  list.push({
    id: "btn_extra_" + Date.now(),
    label: "Nuevo Botón",
    url: "https://",
    color: current.color_primario || "#6366f1",
    icon: "fas fa-star"
  });
  businesses[currentId].botones_adicionales = list;
  renderDynamicButtonsList(list);
  updateLivePreview();
};

window.removeDynamicButton = function (index) {
  const current = getFormData();
  const list = current.botones_adicionales || [];
  list.splice(index, 1);
  businesses[currentId].botones_adicionales = list;
  renderDynamicButtonsList(list);
  updateLivePreview();
};

/**
 * Obtiene los datos del formulario actual
 */
function getFormData() {
  const id = (document.getElementById("businessId").value || currentId).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  
  // Recoger botones extras
  const extraBtns = [];
  document.querySelectorAll("#extraButtonsContainer .button-item").forEach((el, i) => {
    const label = el.querySelector(".dyn-label").value;
    const url = el.querySelector(".dyn-url").value;
    const color = el.querySelector(".dyn-color").value;
    if (label && url) {
      extraBtns.push({
        id: "btn_extra_" + i,
        label: label,
        url: url,
        color: color,
        icon: "fas fa-external-link-alt"
      });
    }
  });

  const repoInputVal = document.getElementById("githubRepoName") ? document.getElementById("githubRepoName").value.trim() : "";
  const bizGasUrlVal = document.getElementById("bizGasUrl") ? document.getElementById("bizGasUrl").value.trim() : "";
  const deployIndividual = document.getElementById("deployIndividualRepo") ? document.getElementById("deployIndividualRepo").checked : true;
  const effectiveRepo = repoInputVal || id;
  const repoInfo = getResolvedRepoUrls(effectiveRepo, id);

  return {
    id: id,
    github_repo: effectiveRepo,
    gas_url: bizGasUrlVal,
    deploy_individual_repo: deployIndividual,
    repo_url: deployIndividual ? repoInfo.repoUrl : ((businesses[id] && businesses[id].repo_url) || ""),
    pages_url: deployIndividual ? repoInfo.pagesUrl : ((businesses[id] && businesses[id].pages_url) || ""),
    dashboard_url: deployIndividual ? repoInfo.dashboardUrl : ((businesses[id] && businesses[id].dashboard_url) || ""),
    nombre_negocio: document.getElementById("nombreNegocio").value || "Mi Negocio",
    categoria: document.getElementById("categoria").value || "Comercio",
    descripcion: document.getElementById("descripcion").value || "",
    avatar_url: document.getElementById("avatarUrl").value || "",
    portada_url: document.getElementById("portadaUrl").value || "",
    tema: getSelectedTheme(),
    boton_whatsapp: document.getElementById("btnWhatsapp").value || "",
    boton_facebook: document.getElementById("btnFacebook").value || "",
    boton_instagram: document.getElementById("btnInstagram").value || "",
    boton_ubicacion: document.getElementById("btnUbicacion").value || "",
    boton_extra_label: document.getElementById("btnExtraLabel").value || "",
    boton_extra_url: document.getElementById("btnExtraUrl").value || "",
    color_primario: document.getElementById("colorPrimary").value || "#6366f1",
    color_acento: document.getElementById("colorAccent").value || "#a855f7",
    color_btn_whatsapp: document.getElementById("btnWhatsappColor") ? document.getElementById("btnWhatsappColor").value : "#25D366",
    color_btn_instagram: document.getElementById("btnInstagramColor") ? document.getElementById("btnInstagramColor").value : "#E1306C",
    color_btn_facebook: document.getElementById("btnFacebookColor") ? document.getElementById("btnFacebookColor").value : "#1877F2",
    color_btn_ubicacion: document.getElementById("btnUbicacionColor") ? document.getElementById("btnUbicacionColor").value : "#EA4335",
    color_btn_extra: document.getElementById("btnExtraColor") ? document.getElementById("btnExtraColor").value : "#eab308",
    estilo_botones: document.getElementById("estiloBotones") ? document.getElementById("estiloBotones").value : "icon_only",
    link_google_negocio: document.getElementById("linkGoogle").value || "",
    password: document.getElementById("businessPassword") ? document.getElementById("businessPassword").value.trim() : "",
    botones_adicionales: extraBtns,
    orden_botones: (businesses[id] && Array.isArray(businesses[id].orden_botones)) ? businesses[id].orden_botones : undefined,
    fecha_actualizacion: new Date().toISOString()
  };
}

/**
 * Actualiza la previsualización interactiva en el frame móvil en tiempo real
 */
function updateLivePreview() {
  const data = getFormData();
  const frame = document.getElementById("phonePreviewFrame");
  if (!frame) return;

  const doc = frame.contentDocument || frame.contentWindow.document;
  if (!doc) return;

  // Inyectar o actualizar HTML del perfil
  const theme = (typeof CONFIG !== "undefined" && CONFIG.themes) 
    ? CONFIG.themes.find(t => t.id === data.tema) || {}
    : {};

  const bgGrad = theme.bg || "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)";
  const txtColor = theme.textColor || "#fff";
  const cardBg = theme.cardBg || "rgba(255, 255, 255, 0.08)";
  const cardBorder = theme.cardBorder || "rgba(255, 255, 255, 0.16)";

  const buttons = [];
  const estilo = data.estilo_botones || "icon_only";

  if (data.boton_whatsapp) {
    buttons.push({ label: "WhatsApp", sub: "Respuesta rápida", icon: "fab fa-whatsapp", color: data.color_btn_whatsapp || "#25D366" });
  }
  if (data.boton_instagram) {
    buttons.push({ label: "Instagram", sub: "Galería de fotos", icon: "fab fa-instagram", color: data.color_btn_instagram || "#E1306C" });
  }
  if (data.boton_facebook) {
    buttons.push({ label: "Facebook", sub: "Comunidad oficial", icon: "fab fa-facebook-f", color: data.color_btn_facebook || "#1877F2" });
  }
  if (data.boton_ubicacion) {
    buttons.push({ label: "Google Maps", sub: "Ver ubicación en GPS", icon: "fas fa-map-marker-alt", color: data.color_btn_ubicacion || "#EA4335" });
  }
  if (data.boton_extra_label && data.boton_extra_url) {
    buttons.push({ label: data.boton_extra_label, sub: "Enlace destacado", icon: "fas fa-external-link-alt", color: data.color_btn_extra || data.color_primario || "#eab308" });
  }
  (data.botones_adicionales || []).forEach(b => {
    buttons.push({ label: b.label, sub: "Directo", icon: "fas fa-link", color: b.color || data.color_primario });
  });

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body {
          background: ${bgGrad};
          color: ${txtColor};
          padding: 24px 16px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .cover { width: 100%; height: 90px; border-radius: 14px 14px 0 0; object-fit: cover; margin-bottom: -40px; }
        .avatar { width: 84px; height: 84px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.3); object-fit: cover; background: #1e293b; z-index: 2; margin-bottom: 10px; }
        h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 2px; text-align: center; }
        .category { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.75; margin-bottom: 6px; }
        .desc { font-size: 0.85rem; opacity: 0.85; text-align: center; margin-bottom: 12px; }
        .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.12); padding: 5px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 600; margin-bottom: 16px; }
        .buttons-list { width: 100%; display: flex; flex-direction: column; gap: 10px; }
        .btn-card { display: flex; align-items: center; padding: 12px 14px; border-radius: 14px; background: ${cardBg}; border: 1px solid ${cardBorder}; text-decoration: none; color: inherit; }
        .icon-box { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; margin-right: 12px; font-size: 1.1rem; flex-shrink: 0; }
        .title { font-size: 0.88rem; font-weight: 600; }
        .sub { font-size: 0.7rem; opacity: 0.7; }
        .arrow { margin-left: auto; font-size: 0.8rem; opacity: 0.6; }
      </style>
    </head>
    <body>
      ${data.portada_url ? `<img class="cover" src="${escapeHtml(data.portada_url)}">` : ''}
      <img class="avatar" src="${escapeHtml(data.avatar_url || 'https://via.placeholder.com/150')}">
      <h2>${escapeHtml(data.nombre_negocio)}</h2>
      ${data.categoria ? `<div class="category">${escapeHtml(data.categoria)}</div>` : ''}
      ${data.descripcion ? `<div class="desc">${escapeHtml(data.descripcion)}</div>` : ''}
      
      <div class="badge">
        <i class="fab fa-google" style="color: #4285F4;"></i>
        <span>4.9</span> <span style="color: #f59e0b;">★★★★★</span>
      </div>

      <div class="buttons-list">
        ${buttons.map(b => {
          let cardStyle = `background: ${cardBg}; border: 1px solid ${cardBorder};`;
          let iconStyle = `background: ${b.color};`;
          if (estilo === "full_card") {
            cardStyle = `background: ${b.color}; color: #ffffff; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 4px 14px rgba(0,0,0,0.25);`;
            iconStyle = `background: rgba(0,0,0,0.25); color: #fff;`;
          } else if (estilo === "border_glow") {
            cardStyle = `background: ${cardBg}; border: 1.5px solid ${b.color}; box-shadow: 0 0 12px ${b.color}40;`;
            iconStyle = `background: ${b.color};`;
          }
          return `
            <div class="btn-card" style="${cardStyle}">
              <div class="icon-box" style="${iconStyle}"><i class="${b.icon}"></i></div>
              <div>
                <div class="title">${escapeHtml(b.label)}</div>
                <div class="sub" style="${estilo === 'full_card' ? 'opacity: 0.9;' : ''}">${escapeHtml(b.sub)}</div>
              </div>
              <i class="fas fa-chevron-right arrow"></i>
            </div>
          `;
        }).join("")}
      </div>
    </body>
    </html>
  `);
  doc.close();
}

/**
 * Guarda el negocio en Google Sheets (100% Gratis)
 */
async function saveToGoogleSheets() {
  const data = getFormData();
  const gasUrl = (document.getElementById("cfgGasUrl").value || "").trim();

  if (!gasUrl) {
    alert("⚠️ Configura primero la URL de Google Apps Script en la pestaña 'Conexiones'.");
    switchTab("tabConnections");
    return;
  }

  showCommitModal("Guardando en Google Sheets...", "Conectando con base de datos en la nube...");

  try {
    const payload = {
      action: "save_business",
      data: data
    };

    // Google Apps Script doPost admite json
    await fetch(gasUrl, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) });
    appendCommitLog("✅ Fila insertada/actualizada con éxito en la pestaña 'Negocios' de Google Sheets.");
    appendCommitLog(`ID guardado: ${data.id}`);
    appendCommitLog(`Fecha: ${new Date().toLocaleString()}`);
    setModalCompleted(true, "¡Guardado exitoso en Google Sheets!");
  } catch (err) {
    console.error("Error al guardar en GAS:", err);
    appendCommitLog("⚠️ Advertencia: Error de respuesta HTTP o CORS. Los datos fueron almacenados en caché local.");
    setModalCompleted(true, "Guardado en caché local");
  }

  // Guardar siempre en local
  businesses[data.id] = data;
  localStorage.setItem("alvap_biz_" + data.id, JSON.stringify(data)); localStorage.setItem("alvap_all_businesses", JSON.stringify(businesses));
  initIdSelector();
}

/**
 * Ejecuta el despliegue sincronizado de un negocio (repo individual con Linktree + Dashboard + enlace central)
 */
async function runSingleBusinessCommit(data) {
  const token = (document.getElementById("cfgGithubToken").value || "").trim();
  const owner = (document.getElementById("cfgGithubOwner").value || "alvapcompany").trim();
  const repo = (document.getElementById("cfgGithubRepo").value || "linktrees").trim();

  if (!token) {
    alert("⚠️ Se requiere un Personal Access Token de GitHub con permisos de 'repo'. Configúralo en la pestaña 'Conexiones'.");
    switchTab("tabConnections");
    return;
  }

  showCommitModal(`Auto-Commit Multi-Repositorio [${data.id}]`, "Iniciando despliegue sincronizado...");

  try {
    appendCommitLog(`🔍 1. Verificando autenticación de GitHub para cuenta '${owner}'...`);
    const user = await GitHubSync.verifyAuth(token);
    appendCommitLog(`✅ Conectado como: ${user.login} (${user.name || 'Sin nombre'})`);

    appendCommitLog(`📁 2. Verificando repositorio principal '${owner}/${repo}'...`);
    await GitHubSync.ensureRepository(owner, repo, token);
    appendCommitLog(`✅ Repositorio principal listo.`);

    if (data.deploy_individual_repo !== false && data.github_repo && data.github_repo.toLowerCase() !== repo.toLowerCase()) {
      const repoInfo = getResolvedRepoUrls(data.github_repo, data.id);
      appendCommitLog(`🌐 3. Creando/actualizando repositorio individual '${repoInfo.fullSlug}' (Linktree + Dashboard + GitHub Pages)...`);
    }

    appendCommitLog(`🚀 4. Publicando business.json, index.html y dashboard.html, y enlazando en '${owner}/${repo}'...`);
    businesses[data.id] = data;

    const result = await GitHubSync.autoCommitBusiness(owner, repo, data, businesses, token);
    if (result.businesses) {
      businesses = result.businesses;
    }

    appendCommitLog(`✅ Commit realizado exitosamente! Hash: ${result.commitSha.substring(0, 7)}`);
    appendCommitLog(`🔗 Índice Central (${owner}/${repo}): ${result.liveUrl}`);
    if (result.individualPagesUrl) {
      appendCommitLog(`🌐 Repo Individual: ${result.individualRepoUrl}`);
      appendCommitLog(`🚀 Linktree Individual: ${result.individualPagesUrl}`);
    }
    if (result.individualDashboardUrl) {
      appendCommitLog(`📊 Dashboard del Cliente: ${result.individualDashboardUrl}`);
    }

    // También guardar en Google Sheets en segundo plano si está configurado
    const gasUrl = (document.getElementById("cfgGasUrl").value || "").trim();
    if (gasUrl) {
      appendCommitLog(`☁️ 5. Sincronizando respaldo con Google Sheets...`);
      fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "save_business", data: businesses[data.id] || data })
      }).then(() => {
        appendCommitLog(`✅ Sincronizado con Google Sheets.`);
      }).catch(() => {});
    }

    updateLinkedRepoPreviewLinks();
    renderLinkedReposDirectory();
    setModalCompleted(
      true,
      "¡Linktree y Dashboard desplegados y enlazados con éxito!",
      result.liveUrl,
      result.individualPagesUrl,
      result.individualRepoUrl,
      result.individualDashboardUrl
    );
  } catch (err) {
    console.error("Error en auto-commit:", err);
    appendCommitLog(`❌ ERROR: ${err.message}`);
    setModalCompleted(false, "Fallo al realizar auto-commit");
  }

  localStorage.setItem("alvap_biz_" + data.id, JSON.stringify(businesses[data.id] || data));
  localStorage.setItem("alvap_all_businesses", JSON.stringify(businesses));
  initIdSelector();
}

/**
 * Realiza el Auto-Commit a GitHub del negocio activo en el editor
 */
async function autoCommitToGitHub() {
  const data = getFormData();
  await runSingleBusinessCommit(data);
}

/**
 * Crea o actualiza directamente el repositorio individual + Dashboard de un negocio del directorio
 */
window.deploySingleBusinessRepo = async function (id) {
  if (!id || !businesses[id]) return;
  const targetData = id === currentId
    ? getFormData()
    : { ...businesses[id], deploy_individual_repo: true, fecha_actualizacion: new Date().toISOString() };
  await runSingleBusinessCommit(targetData);
};

/**
 * Crea y sincroniza TODOS los repositorios individuales + dashboards y actualiza el enlace en el repo principal
 */
window.syncAllReposToGitHub = async function () {
  const token = (document.getElementById("cfgGithubToken").value || "").trim();
  const owner = (document.getElementById("cfgGithubOwner").value || "alvapcompany").trim();
  const repo = (document.getElementById("cfgGithubRepo").value || "linktrees").trim();

  if (!token) {
    alert("⚠️ Se requiere un Personal Access Token de GitHub con permisos de 'repo'. Configúralo en la pestaña 'Conexiones'.");
    switchTab("tabConnections");
    return;
  }

  // Conservar ediciones activas antes de sincronizar todo
  if (currentId) {
    businesses[currentId] = getFormData();
  }

  showCommitModal("Sincronización Masiva Multi-Repositorio", "Creando y enlazando todos los repositorios + Dashboards...");

  try {
    appendCommitLog(`🔍 Verificando autenticación para '${owner}'...`);
    const user = await GitHubSync.verifyAuth(token);
    appendCommitLog(`✅ Conectado como: ${user.login}`);

    const result = await GitHubSync.deployAllBusinesses(owner, repo, businesses, token, (msg) => {
      appendCommitLog(msg);
    });

    if (result.businesses) {
      businesses = result.businesses;
    }

    Object.keys(businesses).forEach(bizId => {
      localStorage.setItem("alvap_biz_" + bizId, JSON.stringify(businesses[bizId]));
    });
    localStorage.setItem("alvap_all_businesses", JSON.stringify(businesses));

    initIdSelector();
    updateLinkedRepoPreviewLinks();
    renderLinkedReposDirectory();

    const hubUrl = `https://${owner.toLowerCase()}.github.io/${repo}/`;
    const activeBiz = businesses[currentId] || {};
    appendCommitLog(`🎉 ¡Listo! Se sincronizaron ${result.deployedCount} repositorio(s) individuales con su Linktree y Dashboard.`);
    setModalCompleted(
      true,
      `¡${result.deployedCount} repositorios sincronizados y enlazados!`,
      hubUrl,
      activeBiz.pages_url || null,
      activeBiz.repo_url || null,
      activeBiz.dashboard_url || null
    );
  } catch (err) {
    console.error("Error en sincronización masiva:", err);
    appendCommitLog(`❌ ERROR: ${err.message}`);
    setModalCompleted(false, "Fallo en sincronización masiva");
  }
};

/**
 * Importa la configuración actual desde el repositorio individual enlazado al editor central
 */
window.pullFromClientRepo = async function (targetId) {
  const id = targetId || (document.getElementById("businessId") && document.getElementById("businessId").value) || currentId;
  if (targetId && businesses[targetId]) {
    selectBusinessFromDirectory(targetId);
  }

  const token = (document.getElementById("cfgGithubToken").value || "").trim();
  const owner = (document.getElementById("cfgGithubOwner").value || "alvapcompany").trim();
  const repoInput = targetId
    ? ((businesses[id] && businesses[id].github_repo) || id)
    : ((document.getElementById("githubRepoName") && document.getElementById("githubRepoName").value.trim()) || id);

  if (!token) {
    alert("⚠️ Configura el Token de GitHub primero para leer el repositorio.");
    switchTab("tabConnections");
    return;
  }

  try {
    const remoteData = await GitHubSync.fetchBusinessFromRepo(owner, repoInput, token);
    const repoInfo = getResolvedRepoUrls(repoInput, id);
    const merged = {
      ...(businesses[id] || {}),
      ...remoteData,
      id: id,
      github_repo: repoInput,
      deploy_individual_repo: true,
      repo_url: repoInfo.repoUrl,
      pages_url: repoInfo.pagesUrl,
      dashboard_url: repoInfo.dashboardUrl
    };
    businesses[id] = merged;
    localStorage.setItem("alvap_biz_" + id, JSON.stringify(merged));
    localStorage.setItem("alvap_all_businesses", JSON.stringify(businesses));
    initIdSelector();
    selectBusiness(id);
    alert(`✅ Configuración sincronizada desde '${repoInfo.fullSlug}' y cargada en la vista previa.`);
  } catch (err) {
    alert(`⚠️ No se pudo importar desde el repositorio '${repoInput}':\n${err.message}\n\nSi el repositorio aún no tiene 'business.json', haz clic en "Auto-Commit a GitHub" para crearlo e inicializarlo.`);
  }
};

/**
 * Enlaza un repositorio individual existente (o crea un nuevo Linktree vinculado a ese repo)
 */
window.linkExistingRepoPrompt = async function () {
  const raw = prompt("Ingresa el nombre del repositorio en GitHub a enlazar (ej. mi-cafeteria o usuario/mi-cafeteria):");
  if (!raw) return;

  const defaultOwner = ((document.getElementById("cfgGithubOwner") && document.getElementById("cfgGithubOwner").value) || "alvapcompany").trim();
  const parsed = GitHubSync.parseRepoRef(raw, defaultOwner);
  if (!parsed.repo) {
    alert("Nombre de repositorio inválido.");
    return;
  }

  const newId = parsed.repo.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const repoRef = parsed.owner.toLowerCase() === defaultOwner.toLowerCase() ? parsed.repo : `${parsed.owner}/${parsed.repo}`;
  const repoInfo = getResolvedRepoUrls(repoRef, newId);
  const token = (document.getElementById("cfgGithubToken").value || "").trim();

  let imported = null;
  if (token) {
    try {
      imported = await GitHubSync.fetchBusinessFromRepo(defaultOwner, repoRef, token);
    } catch (e) {
      // Si el repo aún no tiene business.json o no existe, se inicializará como plantilla lista para Auto-Commit
    }
  }

  businesses[newId] = {
    ...(businesses[newId] || {}),
    ...(imported || {}),
    id: newId,
    github_repo: repoRef,
    deploy_individual_repo: true,
    repo_url: repoInfo.repoUrl,
    pages_url: repoInfo.pagesUrl,
    dashboard_url: repoInfo.dashboardUrl,
    nombre_negocio: (imported && imported.nombre_negocio) || (businesses[newId] && businesses[newId].nombre_negocio) || `Linktree (${newId})`,
    categoria: (imported && imported.categoria) || (businesses[newId] && businesses[newId].categoria) || "Comercio Local",
    descripcion: (imported && imported.descripcion) || (businesses[newId] && businesses[newId].descripcion) || "Perfil oficial interactivo NFC.",
    avatar_url: (imported && imported.avatar_url) || (businesses[newId] && businesses[newId].avatar_url) || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
    tema: (imported && imported.tema) || (businesses[newId] && businesses[newId].tema) || "modern-dark",
    color_primario: (imported && imported.color_primario) || "#6366f1",
    color_acento: (imported && imported.color_acento) || "#a855f7",
    botones_adicionales: (imported && imported.botones_adicionales) || []
  };

  initIdSelector();
  selectBusiness(newId);

  if (imported) {
    alert(`✅ Repositorio '${repoInfo.fullSlug}' enlazado e importado en tiempo real al editor y vista previa.\n\nHaz clic en "Auto-Commit a GitHub" para guardar el enlace en el repositorio principal.`);
  } else {
    alert(`🔗 Repositorio '${repoInfo.fullSlug}' enlazado al editor.\n\nEdita sus botones en la izquierda y haz clic en "Auto-Commit a GitHub" para crearlo/actualizarlo y publicarlo en GitHub Pages.`);
  }
};

/**
 * Crea un nuevo ID de negocio (y le asigna su repositorio individual por defecto)
 */
window.createNewBusinessId = function () {
  const newIdRaw = prompt("Ingresa el identificador único (ID) para el nuevo negocio y su repositorio (ej. tacos-el-pastor, alvap-beauty):");
  if (!newIdRaw) return;

  const newId = newIdRaw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  if (!newId) {
    alert("ID inválido.");
    return;
  }

  if (businesses[newId]) {
    alert("Ya existe un negocio con este ID. Seleccionándolo...");
    selectBusiness(newId);
    return;
  }

  const repoInfo = getResolvedRepoUrls(newId, newId);

  businesses[newId] = {
    id: newId,
    github_repo: newId,
    deploy_individual_repo: true,
    repo_url: repoInfo.repoUrl,
    pages_url: repoInfo.pagesUrl,
    dashboard_url: repoInfo.dashboardUrl,
    nombre_negocio: "Nuevo Negocio (" + newId + ")",
    categoria: "Comercio Local",
    descripcion: "Descripción de los servicios ofrecidos.",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200",
    portada_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800",
    tema: "modern-dark",
    boton_whatsapp: "https://wa.me/5215500000000",
    boton_facebook: "",
    boton_instagram: "",
    boton_ubicacion: "",
    boton_extra_label: "",
    boton_extra_url: "",
    color_primario: "#6366f1",
    color_acento: "#a855f7",
    link_google_negocio: "",
    botones_adicionales: [],
    fecha_creacion: new Date().toISOString()
  };

  initIdSelector();
  selectBusiness(newId);
  alert(`¡ID '${newId}' creado con repositorio individual '${repoInfo.fullSlug}'! Personaliza sus botones y haz Auto-Commit para publicarlo en ambos repositorios.`);
};

/**
 * Configurar manejadores de eventos
 */
function setupEventListeners() {
  // Selector de ID
  const select = document.getElementById("businessSelect");
  if (select) {
    select.addEventListener("change", (e) => {
      selectBusiness(e.target.value);
    });
  }

  // Cambio en cualquier input, color picker o selector para actualizar la vista previa en vivo
  document.querySelectorAll(".editor-panel input, .editor-panel textarea, .editor-panel select").forEach(el => {
    el.addEventListener("input", updateLivePreview);
    el.addEventListener("change", updateLivePreview);
  });

  // Selector de tema
  document.querySelectorAll(".theme-card").forEach(c => {
    c.addEventListener("click", () => {
      document.querySelectorAll(".theme-card").forEach(x => x.classList.remove("active"));
      c.classList.add("active");
      updateLivePreview();
    });
  });

  // Guardar configuración de conexiones
  const btnSaveCfg = document.getElementById("btnSaveSettings");
  if (btnSaveCfg) {
    btnSaveCfg.addEventListener("click", () => {
      const token = document.getElementById("cfgGithubToken").value.trim();
      const owner = document.getElementById("cfgGithubOwner").value.trim();
      const repo = document.getElementById("cfgGithubRepo").value.trim();
      const gas = document.getElementById("cfgGasUrl").value.trim();

      localStorage.setItem("alvap_github_token", token);
      localStorage.setItem("alvap_github_owner", owner);
      localStorage.setItem("alvap_github_repo", repo);
      localStorage.setItem("alvap_gas_url", gas);

      updateConnectionBadges(token, gas);
      updateLinkedRepoPreviewLinks();
      renderLinkedReposDirectory();
      alert("✅ Conexiones guardadas exitosamente.");
    });
  }
}

/**
 * Pestañas
 */
window.switchTab = function (tabId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

  const targetBtn = document.querySelector(`[data-tab="${tabId}"]`);
  const targetPane = document.getElementById(tabId);
  if (targetBtn) targetBtn.classList.add("active");
  if (targetPane) targetPane.classList.add("active");
};

/**
 * Abrir visor en pestaña nueva
 */
window.previewInNewTab = function () {
  const data = getFormData();
  localStorage.setItem("alvap_biz_" + data.id, JSON.stringify(data));
  window.open(`../p/?id=${data.id}`, "_blank");
};

window.openStandalonePreview = function () {
  const data = getFormData();
  if (data.pages_url) {
    window.open(data.pages_url, "_blank");
  } else {
    window.open(`../p/?id=${data.id}`, "_blank");
  }
};

window.openClientDashboardInNewTab = function () {
  const data = getFormData();
  localStorage.setItem("alvap_biz_" + data.id, JSON.stringify(data));
  const targetUrl = (data.deploy_individual_repo !== false && data.dashboard_url)
    ? data.dashboard_url
    : `../client/dashboard.html?id=${encodeURIComponent(data.id)}`;
  window.open(targetUrl, "_blank");
};

/**
 * Modal de Progreso del Commit
 */
function showCommitModal(title, initialStatus) {
  const m = document.getElementById("commitModal");
  document.getElementById("modalCommitTitle").textContent = title;
  document.getElementById("modalStatusText").textContent = initialStatus;
  document.getElementById("commitLogs").innerHTML = "";
  document.getElementById("modalLiveUrlBox").style.display = "none";
  const indWrap = document.getElementById("modalIndividualUrlWrap");
  if (indWrap) indWrap.style.display = "none";
  const indDash = document.getElementById("modalIndividualDashboardLink");
  if (indDash) indDash.style.display = "none";
  document.getElementById("modalCloseBtn").style.display = "none";
  if (m) m.classList.add("active");
}

function appendCommitLog(text) {
  const box = document.getElementById("commitLogs");
  if (!box) return;
  const p = document.createElement("div");
  p.textContent = text;
  box.appendChild(p);
  box.scrollTop = box.scrollHeight;
}

function setModalCompleted(success, finalMsg, liveUrl, individualPagesUrl, individualRepoUrl, individualDashboardUrl) {
  document.getElementById("modalStatusText").textContent = finalMsg;
  document.getElementById("modalCloseBtn").style.display = "inline-flex";

  if (liveUrl) {
    const urlBox = document.getElementById("modalLiveUrlBox");
    const link = document.getElementById("modalLiveLink");
    link.href = liveUrl;
    link.textContent = liveUrl;
    urlBox.style.display = "block";

    const indWrap = document.getElementById("modalIndividualUrlWrap");
    const indPages = document.getElementById("modalIndividualPagesLink");
    const indDash = document.getElementById("modalIndividualDashboardLink");
    const indRepo = document.getElementById("modalIndividualRepoLink");
    if (indWrap && (individualPagesUrl || individualDashboardUrl || individualRepoUrl)) {
      if (indPages && individualPagesUrl) {
        indPages.href = individualPagesUrl;
        indPages.textContent = individualPagesUrl;
        indPages.style.display = "block";
      }
      if (indDash && individualDashboardUrl) {
        indDash.href = individualDashboardUrl;
        indDash.textContent = individualDashboardUrl;
        indDash.style.display = "block";
      }
      if (indRepo && individualRepoUrl) {
        indRepo.href = individualRepoUrl;
        indRepo.textContent = "Ver Repo: " + individualRepoUrl;
      }
      indWrap.style.display = "block";
    }
  }
}

window.closeCommitModal = function () {
  const m = document.getElementById("commitModal");
  if (m) m.classList.remove("active");
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// GESTOR DEL REPOSITORIO DEDICADO DE IMÁGENES (alvapcompany/imagenes)
// ============================================================================

const IMAGES_REPO_NAME = "imagenes";
const IMAGE_PRESETS = {
  logo: { maxW: 400, maxH: 400, folder: "logos", quality: 0.85 },
  portada: { maxW: 800, maxH: 400, folder: "portadas", quality: 0.84 },
  original: { maxW: Infinity, maxH: Infinity, folder: "otros", quality: 0.86 }
};
let pendingImageUpload = null;

function getAdminGitHubConfig() {
  return {
    token: ((document.getElementById("cfgGithubToken") && document.getElementById("cfgGithubToken").value) || "").trim(),
    owner: ((document.getElementById("cfgGithubOwner") && document.getElementById("cfgGithubOwner").value) || "alvapcompany").trim()
  };
}

function setImagesRepoStatus(message, level = "info") {
  const el = document.getElementById("imgRepoStatusMsg");
  if (!el) return;
  if (!message) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  const palette = {
    info: { bg: "rgba(56, 189, 248, 0.12)", border: "#0284c7", color: "#bae6fd" },
    success: { bg: "rgba(16, 185, 129, 0.12)", border: "#10b981", color: "#a7f3d0" },
    error: { bg: "rgba(239, 68, 68, 0.12)", border: "#ef4444", color: "#fecaca" }
  }[level] || { bg: "rgba(56, 189, 248, 0.12)", border: "#0284c7", color: "#bae6fd" };

  el.style.display = "block";
  el.style.background = palette.bg;
  el.style.border = `1px solid ${palette.border}`;
  el.style.color = palette.color;
  el.textContent = message;
}

window.openImagesRepoModal = function (targetType) {
  const modal = document.getElementById("imagesRepoModal");
  if (!modal) return;

  const { owner } = getAdminGitHubConfig();
  const badge = document.getElementById("imgRepoNameBadge");
  if (badge) badge.textContent = `${owner}/${IMAGES_REPO_NAME}`;

  const targetSel = document.getElementById("imgRepoAssignTarget");
  const presetSel = document.getElementById("imgRepoPreset");
  if (targetType === "avatar" || targetType === "portada") {
    if (targetSel) targetSel.value = targetType;
    if (presetSel) presetSel.value = targetType === "portada" ? "portada" : "logo";
  }

  const fileNameInput = document.getElementById("imgRepoFileName");
  const activeBizId = (document.getElementById("businessId") && document.getElementById("businessId").value) || currentId || "negocio";
  if (fileNameInput && !pendingImageUpload) {
    fileNameInput.value = activeBizId;
  }

  setImagesRepoStatus("");
  const resBox = document.getElementById("imgRepoResultBox");
  if (resBox) resBox.style.display = "none";

  modal.classList.add("active");

  if (pendingImageUpload && pendingImageUpload.originalFile) {
    reprocessSelectedImageForRepo();
  }
  const detailsEl = document.getElementById("imgRepoGalleryDetails");
  if (detailsEl && detailsEl.open) {
    loadImagesRepoCatalog();
  }
};

window.closeImagesRepoModal = function () {
  const modal = document.getElementById("imagesRepoModal");
  if (modal) modal.classList.remove("active");
};

function optimizeImageInBrowser(file, presetKey) {
  const cfg = IMAGE_PRESETS[presetKey] || IMAGE_PRESETS.logo;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo seleccionado no es una imagen válida."));
      img.onload = () => {
        let targetW = img.naturalWidth || img.width;
        let targetH = img.naturalHeight || img.height;

        if (Number.isFinite(cfg.maxW) && Number.isFinite(cfg.maxH)) {
          const ratio = Math.min(cfg.maxW / targetW, cfg.maxH / targetH, 1);
          targetW = Math.max(1, Math.round(targetW * ratio));
          targetH = Math.max(1, Math.round(targetH * ratio));
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        let dataUrl = canvas.toDataURL("image/webp", cfg.quality);
        let ext = "webp";
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", cfg.quality);
          ext = "jpg";
        }

        const base64 = dataUrl.split(",")[1] || "";
        const bytes = Math.round((base64.length * 3) / 4);
        resolve({
          originalFile: file,
          originalBytes: file.size,
          dataUrl,
          base64,
          ext,
          width: targetW,
          height: targetH,
          bytes,
          folder: cfg.folder
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderPendingImagePreview(info) {
  const box = document.getElementById("imgRepoPreviewBox");
  const imgEl = document.getElementById("imgRepoPreviewImg");
  const statsEl = document.getElementById("imgRepoStatsText");
  if (!box || !imgEl || !statsEl) return;

  const origKb = (info.originalBytes / 1024).toFixed(1);
  const optKb = (info.bytes / 1024).toFixed(1);
  const savedPct = info.originalBytes > 0
    ? Math.max(0, Math.round((1 - info.bytes / info.originalBytes) * 100))
    : 0;

  imgEl.src = info.dataUrl;
  statsEl.innerHTML = `
    <div>Formato: <strong>.${info.ext.toUpperCase()}</strong> • Resolución: <strong>${info.width}×${info.height} px</strong></div>
    <div>Peso: <strong>${origKb} KB</strong> → <strong style="color:#34d399;">${optKb} KB</strong> (${savedPct}% más ligera) • Carpeta: <code>${escapeHtml(info.folder)}/</code></div>
  `;
  box.style.display = "flex";
}

window.handleImageRepoFileSelect = async function (event) {
  const file = event && event.target && event.target.files && event.target.files[0];
  if (!file) return;

  setImagesRepoStatus("");
  const resBox = document.getElementById("imgRepoResultBox");
  if (resBox) resBox.style.display = "none";

  const preset = (document.getElementById("imgRepoPreset") && document.getElementById("imgRepoPreset").value) || "logo";
  const nameInput = document.getElementById("imgRepoFileName");
  const activeBizId = (document.getElementById("businessId") && document.getElementById("businessId").value) || currentId || "";
  if (nameInput && !nameInput.value.trim()) {
    const cleanBase = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    nameInput.value = activeBizId || cleanBase || "imagen";
  }

  try {
    pendingImageUpload = await optimizeImageInBrowser(file, preset);
    renderPendingImagePreview(pendingImageUpload);
  } catch (err) {
    pendingImageUpload = null;
    setImagesRepoStatus(err.message || "No se pudo procesar la imagen.", "error");
  }
};

window.reprocessSelectedImageForRepo = async function () {
  if (!pendingImageUpload || !pendingImageUpload.originalFile) return;
  const preset = (document.getElementById("imgRepoPreset") && document.getElementById("imgRepoPreset").value) || "logo";
  try {
    pendingImageUpload = await optimizeImageInBrowser(pendingImageUpload.originalFile, preset);
    renderPendingImagePreview(pendingImageUpload);
  } catch (err) {
    setImagesRepoStatus(err.message || "Error optimizando la imagen.", "error");
  }
};

function applyUploadedImageUrlToEditor(cdnUrl, assignTarget) {
  if (assignTarget === "avatar") {
    const avatarInput = document.getElementById("avatarUrl");
    if (avatarInput) avatarInput.value = cdnUrl;
    updateLivePreview();
    return "Aplicado automáticamente al campo Foto de Perfil. Haz clic en Auto-Commit a GitHub para publicarlo en el Linktree.";
  }
  if (assignTarget === "portada") {
    const coverInput = document.getElementById("portadaUrl");
    if (coverInput) coverInput.value = cdnUrl;
    updateLivePreview();
    return "Aplicado automáticamente al campo Portada / Banner. Haz clic en Auto-Commit a GitHub para publicarlo en el Linktree.";
  }
  return "Link listo para pegar donde lo necesites.";
}

window.uploadSelectedImageToRepo = async function () {
  if (!pendingImageUpload) {
    setImagesRepoStatus("Primero selecciona una imagen desde tu dispositivo.", "error");
    return;
  }

  const { token, owner } = getAdminGitHubConfig();
  if (!token) {
    setImagesRepoStatus("Falta el Token de GitHub en la pestaña 'Conexiones (GitHub / Sheets)'.", "error");
    return;
  }

  const rawSlug = ((document.getElementById("imgRepoFileName") && document.getElementById("imgRepoFileName").value) || currentId || "imagen")
    .trim()
    .toLowerCase()
    .replace(/\.(webp|jpg|jpeg|png|gif)$/i, "")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/^-+|-+$/g, "");
  const finalName = rawSlug || `img-${Date.now()}`;
  const filePath = `${pendingImageUpload.folder}/${finalName}.${pendingImageUpload.ext}`;
  const assignTarget = (document.getElementById("imgRepoAssignTarget") && document.getElementById("imgRepoAssignTarget").value) || "none";

  const btn = document.getElementById("btnUploadImgRepo");
  const prevBtnHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo a GitHub...';
  }
  setImagesRepoStatus(`Subiendo ${filePath} al repositorio ${owner}/${IMAGES_REPO_NAME}...`, "info");

  try {
    const res = await GitHubSync.uploadImageToImagesRepo(
      owner,
      filePath,
      pendingImageUpload.base64,
      token,
      IMAGES_REPO_NAME
    );

    const cdnInput = document.getElementById("imgRepoCdnUrl");
    const pagesInput = document.getElementById("imgRepoPagesUrl");
    const resBox = document.getElementById("imgRepoResultBox");
    const noteEl = document.getElementById("imgRepoAppliedNote");

    if (cdnInput) cdnInput.value = res.cdnUrl;
    if (pagesInput) pagesInput.value = res.pagesUrl;
    if (noteEl) noteEl.textContent = applyUploadedImageUrlToEditor(res.cdnUrl, assignTarget);
    if (resBox) resBox.style.display = "block";

    setImagesRepoStatus(`✅ Imagen subida con éxito (${res.path}).`, "success");

    const detailsEl = document.getElementById("imgRepoGalleryDetails");
    if (detailsEl && detailsEl.open) {
      loadImagesRepoCatalog();
    }
  } catch (err) {
    setImagesRepoStatus(`❌ Error al subir: ${err.message}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = prevBtnHtml;
    }
  }
};

window.copyImagesRepoLink = function (inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input.value) return;
  navigator.clipboard.writeText(input.value).then(() => {
    setImagesRepoStatus("📋 Enlace copiado al portapapeles.", "success");
  }).catch(() => {
    input.select();
    document.execCommand("copy");
    setImagesRepoStatus("📋 Enlace copiado al portapapeles.", "success");
  });
};

window.useCatalogImage = function (url, target) {
  if (!url) return;
  if (target === "copy") {
    navigator.clipboard.writeText(url).then(() => {
      setImagesRepoStatus("📋 Link CDN copiado al portapapeles.", "success");
    }).catch(() => {});
    return;
  }
  const msg = applyUploadedImageUrlToEditor(url, target);
  setImagesRepoStatus(`✅ ${msg}`, "success");
};

window.loadImagesRepoCatalog = async function () {
  const listEl = document.getElementById("imgRepoCatalogList");
  const countEl = document.getElementById("imgRepoCatalogCount");
  if (!listEl) return;

  const { token, owner } = getAdminGitHubConfig();
  listEl.innerHTML = '<div style="font-size: 0.78rem; color: #9ca3af;"><i class="fas fa-spinner fa-spin"></i> Consultando galería...</div>';

  try {
    const res = await GitHubSync.listRepoImages(owner, token, IMAGES_REPO_NAME);
    if (countEl) countEl.textContent = res.images.length ? `(${res.images.length})` : "";

    if (!res.exists || res.images.length === 0) {
      listEl.innerHTML = '<div style="font-size: 0.78rem; color: #9ca3af; grid-column: 1 / -1;">Aún no hay imágenes en este repositorio. Sube la primera arriba.</div>';
      return;
    }

    listEl.innerHTML = res.images.map(img => `
      <div style="background: #1f2937; border: 1px solid #374151; border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 6px;">
        <img src="${escapeHtml(img.cdnUrl)}" alt="${escapeHtml(img.name)}" loading="lazy" style="width: 100%; height: 84px; object-fit: cover; border-radius: 6px; background: #0f172a;">
        <div style="font-size: 0.72rem; font-weight: 700; color: #f3f4f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(img.path)}">${escapeHtml(img.name)}</div>
        <div style="font-size: 0.66rem; color: #9ca3af;">${escapeHtml(img.folder)} • ${(img.size / 1024).toFixed(1)} KB</div>
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm img-cat-action" data-action="avatar" data-url="${escapeHtml(img.cdnUrl)}" style="padding: 3px 6px; font-size: 0.68rem; flex: 1;">Perfil</button>
          <button type="button" class="btn btn-secondary btn-sm img-cat-action" data-action="portada" data-url="${escapeHtml(img.cdnUrl)}" style="padding: 3px 6px; font-size: 0.68rem; flex: 1;">Portada</button>
          <button type="button" class="btn btn-secondary btn-sm img-cat-action" data-action="copy" data-url="${escapeHtml(img.cdnUrl)}" style="padding: 3px 6px; font-size: 0.68rem;" title="Copiar link CDN"><i class="fas fa-copy"></i></button>
        </div>
      </div>
    `).join("");

    listEl.onclick = function (e) {
      const btn = e.target.closest(".img-cat-action");
      if (!btn) return;
      useCatalogImage(btn.getAttribute("data-url"), btn.getAttribute("data-action"));
    };
  } catch (err) {
    listEl.innerHTML = `<div style="font-size: 0.78rem; color: #fca5a5; grid-column: 1 / -1;">No se pudo cargar la galería: ${escapeHtml(err.message)}</div>`;
  }
};






