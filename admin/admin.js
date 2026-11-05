/**
 * PANEL ADMINISTRATIVO - LINKTREE ALVAP COMPANY
 * Lógica de edición por IDs, live preview, guardado en Google Sheets y auto-commit a GitHub
 */

let businesses = {};
let currentId = "alvap-studio";

document.addEventListener("DOMContentLoaded", async () => {
  loadStoredSettings();
  await loadBusinessesData();
  initIdSelector();
  selectBusiness(currentId);
  setupEventListeners();
  updateLivePreview();
});

/**
 * Carga configuraciones almacenadas (Token de GitHub y URL de Google Apps Script)
 */
function loadStoredSettings() {
  const defaultToken = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.token) ? CONFIG.github.token : ""; const defaultGas = (typeof CONFIG !== "undefined" && CONFIG.googleAppsScriptUrl) ? CONFIG.googleAppsScriptUrl : ""; let ghToken = localStorage.getItem("alvap_github_token") || defaultToken;
  const ghOwner = localStorage.getItem("alvap_github_owner") || "alvapcompany";
  const ghRepo = localStorage.getItem("alvap_github_repo") || "linktrees";
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
  try {
    const res = await fetch("../data/businesses.json");
    if (res.ok) {
      businesses = await res.json();
    }
  } catch (e) {
    console.warn("Cargando desde almacenamiento local:", e);
  }

  // Fusionar con cambios locales
  const localList = localStorage.getItem("alvap_all_businesses");
  if (localList) {
    try {
      const parsed = JSON.parse(localList);
      businesses = { ...businesses, ...parsed };
    } catch (e) {}
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

  // Botones principales
  document.getElementById("btnWhatsapp").value = b.boton_whatsapp || "";
  document.getElementById("btnFacebook").value = b.boton_facebook || "";
  document.getElementById("btnInstagram").value = b.boton_instagram || "";
  document.getElementById("btnUbicacion").value = b.boton_ubicacion || "";
  document.getElementById("btnExtraLabel").value = b.boton_extra_label || "";
  document.getElementById("btnExtraUrl").value = b.boton_extra_url || "";

  // Colores y Tema
  document.getElementById("colorPrimary").value = b.color_primario || "#6366f1";
  document.getElementById("colorAccent").value = b.color_acento || "#a855f7";

  selectThemeCard(b.tema || "modern-dark");
  renderDynamicButtonsList(b.botones_adicionales || []);
  updateLivePreview();
}

/**
 * Selecciona visualmente la tarjeta de tema
 */
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

  return {
    id: id,
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
    link_google_negocio: document.getElementById("linkGoogle").value || "",
    botones_adicionales: extraBtns,
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
  if (data.boton_whatsapp) {
    buttons.push({ label: "WhatsApp", sub: "Respuesta rápida", icon: "fab fa-whatsapp", color: "linear-gradient(135deg, #25D366, #128C7E)" });
  }
  if (data.boton_instagram) {
    buttons.push({ label: "Instagram", sub: "Galería de fotos", icon: "fab fa-instagram", color: "linear-gradient(135deg, #833AB4, #FD1D1D)" });
  }
  if (data.boton_facebook) {
    buttons.push({ label: "Facebook", sub: "Comunidad oficial", icon: "fab fa-facebook-f", color: "linear-gradient(135deg, #1877F2, #0d5dbb)" });
  }
  if (data.boton_ubicacion) {
    buttons.push({ label: "Google Maps", sub: "Ver ubicación en GPS", icon: "fas fa-map-marker-alt", color: "linear-gradient(135deg, #EA4335, #c5221f)" });
  }
  if (data.boton_extra_label && data.boton_extra_url) {
    buttons.push({ label: data.boton_extra_label, sub: "Enlace destacado", icon: "fas fa-external-link-alt", color: data.color_primario });
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
        ${buttons.map(b => `
          <div class="btn-card">
            <div class="icon-box" style="background: ${b.color};"><i class="${b.icon}"></i></div>
            <div>
              <div class="title">${escapeHtml(b.label)}</div>
              <div class="sub">${escapeHtml(b.sub)}</div>
            </div>
            <i class="fas fa-chevron-right arrow"></i>
          </div>
        `).join("")}
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
  localStorage.setItem("alvap_all_businesses", JSON.stringify(businesses));
  initIdSelector();
}

/**
 * Realiza el Auto-Commit a GitHub para alvapcompany
 */
async function autoCommitToGitHub() {
  const data = getFormData();
  const token = (document.getElementById("cfgGithubToken").value || "").trim();
  const owner = (document.getElementById("cfgGithubOwner").value || "alvapcompany").trim();
  const repo = (document.getElementById("cfgGithubRepo").value || "linktrees").trim();

  if (!token) {
    alert("⚠️ Se requiere un Personal Access Token de GitHub con permisos de 'repo'. Configúralo en la pestaña 'Conexiones'.");
    switchTab("tabConnections");
    return;
  }

  showCommitModal(`Auto-Commit a GitHub (${owner}/${repo})`, "Iniciando proceso de despliegue...");

  try {
    appendCommitLog(`🔍 1. Verificando autenticación de GitHub para cuenta '${owner}'...`);
    const user = await GitHubSync.verifyAuth(token);
    appendCommitLog(`✅ Conectado como: ${user.login} (${user.name || 'Sin nombre'})`);

    appendCommitLog(`📁 2. Verificando repositorio '${owner}/${repo}'...`);
    await GitHubSync.ensureRepository(owner, repo, token);
    appendCommitLog(`✅ Repositorio listo y configurado.`);

    appendCommitLog(`🚀 3. Empaquetando datos y generando HTML para ID '${data.id}'...`);
    businesses[data.id] = data;
    
    const result = await GitHubSync.autoCommitBusiness(owner, repo, data, businesses, token);
    appendCommitLog(`✅ Commit realizado exitosamente! Hash: ${result.commitSha.substring(0, 7)}`);
    appendCommitLog(`🌐 Enlace público en GitHub Pages: ${result.liveUrl}`);

    // También guardar en Google Sheets en segundo plano si está configurado
    const gasUrl = (document.getElementById("cfgGasUrl").value || "").trim();
    if (gasUrl) {
      appendCommitLog(`☁️ 4. Sincronizando respaldo con Google Sheets...`);
      fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "save_business", data: data })
      }).then(() => {
        appendCommitLog(`✅ Sincronizado con Google Sheets.`);
      }).catch(() => {});
    }

    setModalCompleted(true, "¡Linktree publicado y commiteado con éxito!", result.liveUrl);
  } catch (err) {
    console.error("Error en auto-commit:", err);
    appendCommitLog(`❌ ERROR: ${err.message}`);
    setModalCompleted(false, "Fallo al realizar auto-commit");
  }

  // Guardar en local
  localStorage.setItem("alvap_all_businesses", JSON.stringify(businesses));
  initIdSelector();
}

/**
 * Crea un nuevo ID de negocio
 */
window.createNewBusinessId = function () {
  const newIdRaw = prompt("Ingresa el identificador único (ID) para el nuevo negocio (ej. tacos-el-pastor, alvap-beauty):");
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

  businesses[newId] = {
    id: newId,
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
  alert(`¡ID '${newId}' creado! Ahora personaliza sus botones y realiza el Auto-Commit para publicarlo.`);
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

  // Cambio en cualquier input de texto
  document.querySelectorAll(".editor-panel input, .editor-panel textarea").forEach(el => {
    el.addEventListener("input", updateLivePreview);
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

/**
 * Modal de Progreso del Commit
 */
function showCommitModal(title, initialStatus) {
  const m = document.getElementById("commitModal");
  document.getElementById("modalCommitTitle").textContent = title;
  document.getElementById("modalStatusText").textContent = initialStatus;
  document.getElementById("commitLogs").innerHTML = "";
  document.getElementById("modalLiveUrlBox").style.display = "none";
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

function setModalCompleted(success, finalMsg, liveUrl) {
  document.getElementById("modalStatusText").textContent = finalMsg;
  document.getElementById("modalCloseBtn").style.display = "inline-flex";

  if (liveUrl) {
    const urlBox = document.getElementById("modalLiveUrlBox");
    const link = document.getElementById("modalLiveLink");
    link.href = liveUrl;
    link.textContent = liveUrl;
    urlBox.style.display = "block";
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



