/**
 * CLIENT DASHBOARD LOGIC - ALVAP COMPANY
 * Visualización de Vistas y Desglose Detallado de Clics por Botón
 */

const params = new URLSearchParams(window.location.search);

function resolveDashboardBusinessId() {
  const queryId = params.get("id");
  if (queryId) return queryId;
  if (window.STANDALONE_BUSINESS_ID) return window.STANDALONE_BUSINESS_ID;
  if (window.INITIAL_BUSINESS && window.INITIAL_BUSINESS.id) return window.INITIAL_BUSINESS.id;

  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments.length > 0) {
    const first = segments[0];
    const ignored = ["linktrees", "client", "negocios", "admin", "p"];
    if (!ignored.includes(first.toLowerCase()) && !first.endsWith(".html")) {
      return first;
    }
  }
  return "alvap-studio";
}

const businessId = resolveDashboardBusinessId();

let businessData = null;
let timelineChart = null;
let buttonsChart = null;
let isRefreshingDashboard = false;

function purgeBrowserCaches() {
  try {
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
  return JSON.parse(decodeGitHubBase64Utf8(fileData.content || ""));
}

async function fetchFreshBusinessFromGitHubApi(id) {
  const owner = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.owner) ? CONFIG.github.owner : "alvapcompany";
  const mainRepo = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.repo) ? CONFIG.github.repo : "linktrees";
  const token = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.token) ? CONFIG.github.token.trim() : "";

  try {
    const isInsideLinktrees = window.location.pathname.includes("/linktrees/") || window.location.pathname.includes("/client/") || window.location.pathname.includes("/negocios/");
    const segments = window.location.pathname.split("/").filter(Boolean);
    const ignored = ["linktrees", "client", "negocios", "admin", "p"];
    const pathSlug = (segments.length > 0 && !ignored.includes(segments[0].toLowerCase()) && !segments[0].endsWith(".html"))
      ? segments[0]
      : null;
    const standaloneSlug = window.STANDALONE_REPO ? (pathSlug || id) : (!isInsideLinktrees ? pathSlug : null);

    if (standaloneSlug) {
      const standaloneBiz = await fetchGitHubContentsJson(owner, standaloneSlug, "business.json", token);
      if (standaloneBiz && (standaloneBiz.id || standaloneBiz.nombre_negocio)) {
        return standaloneBiz;
      }
    }

    const allBiz = await fetchGitHubContentsJson(owner, mainRepo, "data/businesses.json", token);
    if (allBiz && allBiz[id]) {
      return allBiz[id];
    }
  } catch (e) {
    console.warn("GitHub API live fetch omitido en dashboard:", e);
  }
  return null;
}

async function refreshDashboardState() {
  if (isRefreshingDashboard) return;
  isRefreshingDashboard = true;
  try {
    await loadBusinessInfo();
    checkClientAuth();
    await loadMetrics();
  } finally {
    isRefreshingDashboard = false;
  }
}

purgeBrowserCaches();

document.addEventListener("DOMContentLoaded", refreshDashboardState);

window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    purgeBrowserCaches();
    refreshDashboardState();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshDashboardState();
  }
});

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const SECURE_AUTH_HASH = "e318981c6fc3f0613db54042d31b4dc3afeadfd2904b0b92cef04229b28ac56f";

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function checkClientAuth() {
  const lock = document.getElementById("clientLockScreen");
  const lockBiz = document.getElementById("lockBizName");
  const lockBtn = document.getElementById("btnLockDashboard");

  if (lockBiz && businessData && businessData.nombre_negocio) {
    lockBiz.textContent = `Panel Privado de ${businessData.nombre_negocio}`;
  }

  const isClientAuth = sessionStorage.getItem("alvap_client_auth_" + businessId) === "true";
  const isAdminAuth = sessionStorage.getItem("alvap_admin_authenticated") === "true";

  if (isClientAuth || isAdminAuth) {
    if (lock) lock.style.display = "none";
    if (lockBtn) lockBtn.style.display = "inline-flex";
    return true;
  } else {
    if (lock) lock.style.display = "flex";
    if (lockBtn) lockBtn.style.display = "none";
    return false;
  }
}

window.handleClientLogin = async function (e) {
  if (e) e.preventDefault();
  const input = document.getElementById("clientSecretInput");
  const errorMsg = document.getElementById("clientErrorMsg");
  if (!input) return;

  const entered = input.value.trim();
  const enteredHash = await sha256(entered);
  const actualPass = (businessData && businessData.password) ? String(businessData.password).trim() : "";

  const matchesAdmin = enteredHash === SECURE_AUTH_HASH;
  const matchesClient = actualPass !== "" && entered === actualPass;

  if (matchesAdmin || matchesClient) {
    sessionStorage.setItem("alvap_client_auth_" + businessId, "true");
    if (matchesAdmin) {
      sessionStorage.setItem("alvap_admin_authenticated", "true");
    }
    const lock = document.getElementById("clientLockScreen");
    if (lock) lock.style.display = "none";
    const lockBtn = document.getElementById("btnLockDashboard");
    if (lockBtn) lockBtn.style.display = "inline-flex";
    if (errorMsg) errorMsg.style.display = "none";
  } else {
    if (errorMsg) errorMsg.style.display = "block";
    input.value = "";
    input.focus();
  }
};

window.lockClientDashboard = function () {
  sessionStorage.removeItem("alvap_client_auth_" + businessId);
  sessionStorage.removeItem("alvap_admin_authenticated");
  window.location.reload();
};

/**
 * Carga información del negocio
 */
async function fetchStaticFreshBusinessForDashboard() {
  const isInsideLinktrees = window.location.pathname.includes("/linktrees/") || window.location.pathname.includes("/client/") || window.location.pathname.includes("/negocios/");
  const noCacheOpts = {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache"
    }
  };

  if (window.STANDALONE_REPO || !isInsideLinktrees) {
    for (const candidate of ["./business.json", "../business.json"]) {
      try {
        const res = await fetch(`${candidate}?_t=${Date.now()}`, noCacheOpts);
        if (res.ok) {
          const parsed = await res.json();
          if (parsed && (parsed.id || parsed.nombre_negocio)) {
            return parsed;
          }
        }
      } catch (e) {}
    }
  }

  const mainCandidates = [];
  if (window.location.pathname.includes("/negocios/")) {
    mainCandidates.push("../../data/businesses.json");
  } else if (isInsideLinktrees) {
    mainCandidates.push("../data/businesses.json");
  } else {
    mainCandidates.push("https://alvapcompany.github.io/linktrees/data/businesses.json");
  }

  for (const jsonPath of mainCandidates) {
    const opts = jsonPath.startsWith("http") ? { cache: "no-store" } : noCacheOpts;
    try {
      const res = await fetch(`${jsonPath}?_t=${Date.now()}`, opts);
      if (res.ok) {
        const allBusinesses = await res.json();
        if (allBusinesses && allBusinesses[businessId]) {
          return allBusinesses[businessId];
        }
      }
    } catch (e) {}
  }
  return null;
}

async function loadBusinessInfo() {
  const [apiData, staticData] = await Promise.all([
    fetchFreshBusinessFromGitHubApi(businessId),
    fetchStaticFreshBusinessForDashboard()
  ]);

  const networkData = pickNewestBusiness(apiData, staticData);
  businessData = networkData || window.INITIAL_BUSINESS || null;

  // Purgar/actualizar caché local salvo que localStorage tenga una edición aún más reciente del admin
  try {
    const local = localStorage.getItem("alvap_biz_" + businessId);
    if (local) {
      const parsed = JSON.parse(local);
      if (!networkData && parsed && parsed.nombre_negocio) {
        businessData = pickNewestBusiness(window.INITIAL_BUSINESS || null, parsed);
      } else if (networkData && parsed && getBizTimestamp(parsed) > getBizTimestamp(networkData)) {
        businessData = parsed;
      } else if (networkData) {
        localStorage.setItem("alvap_biz_" + businessId, JSON.stringify(networkData));
      }
    } else if (networkData) {
      localStorage.setItem("alvap_biz_" + businessId, JSON.stringify(networkData));
    }
  } catch (e) {}

  if (!businessData) {
    businessData = {
      id: businessId,
      nombre_negocio: "Negocio " + businessId,
      categoria: "Comercio Afiliado",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200"
    };
  }

  // Renderizar cabecera
  document.getElementById("bizTitle").textContent = businessData.nombre_negocio;
  document.getElementById("bizCategory").textContent = businessData.categoria || "Portal de Métricas y Clics por Botón";
  document.getElementById("bizAvatar").src = businessData.avatar_url || "https://via.placeholder.com/150";

  const fallbackPublicUrl = `https://alvapcompany.github.io/linktrees/p/?id=${encodeURIComponent(businessId)}`;
  const owner = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.owner) ? CONFIG.github.owner.toLowerCase() : "alvapcompany";
  const repoSlug = (businessData.github_repo || businessId).trim();
  const repoPagesFallback = repoSlug.includes("/")
    ? `https://${repoSlug.split("/")[0].toLowerCase()}.github.io/${repoSlug.split("/")[1]}/`
    : `https://${owner}.github.io/${repoSlug}/`;
  const targetPublicUrl = businessData.deploy_individual_repo === false
    ? fallbackPublicUrl
    : (businessData.pages_url || repoPagesFallback);

  const viewBtn = document.getElementById("btnViewProfile");
  if (viewBtn) viewBtn.href = targetPublicUrl;
}

function normalizeNumericMap(obj, lowercaseKeys) {
  const out = {};
  if (!obj || typeof obj !== "object") return out;
  Object.keys(obj).forEach(k => {
    const cleanKey = lowercaseKeys ? String(k).trim().toLowerCase() : String(k).trim();
    if (!cleanKey) return;
    out[cleanKey] = (Number(out[cleanKey]) || 0) + (Number(obj[k]) || 0);
  });
  return out;
}

function mergeNumericMapsMax(mapA, mapB, lowercaseKeys) {
  const a = normalizeNumericMap(mapA, lowercaseKeys);
  const b = normalizeNumericMap(mapB, lowercaseKeys);
  const merged = { ...a };
  Object.keys(b).forEach(k => {
    merged[k] = Math.max(Number(merged[k]) || 0, Number(b[k]) || 0);
  });
  return merged;
}

/**
 * Carga y computa métricas de vistas y clics consolidando nube (GAS) + dispositivo local
 */
async function loadMetrics() {
  let cloudMetrics = null;

  // 1. Consultar desde Google Apps Script si está disponible
  const gasUrl = (typeof CONFIG !== "undefined" && CONFIG.googleAppsScriptUrl)
    ? CONFIG.googleAppsScriptUrl
    : localStorage.getItem("alvap_gas_url");

  if (gasUrl) {
    try {
      const cleanQueryId = String(businessId || "").trim().toLowerCase();
      const res = await fetch(`${gasUrl}?action=get_metrics&id=${encodeURIComponent(cleanQueryId)}&_t=${Date.now()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data) {
        cloudMetrics = json.data;
      }
    } catch (e) {
      console.warn("Fallo consultando métricas en GAS, usando respaldo local:", e);
    }
  }

  // 2. Leer métricas locales del dispositivo para reflejo inmediato
  let localStats = null;
  try {
    const cleanId = String(businessId || "").trim().toLowerCase();
    const raw = localStorage.getItem("alvap_stats_" + cleanId) || localStorage.getItem("alvap_stats_" + businessId);
    if (raw) {
      localStats = JSON.parse(raw);
    }
  } catch (e) {}

  // 3. Consolidar nube + local (sin datos falsos de demostración)
  const mergedClicksByButton = mergeNumericMapsMax(
    cloudMetrics && cloudMetrics.clicks_by_button,
    localStats && localStats.clicks,
    true
  );
  const sumButtonClicks = Object.values(mergedClicksByButton).reduce((a, b) => a + (Number(b) || 0), 0);
  const totalClicks = Math.max(Number(cloudMetrics && cloudMetrics.total_clicks) || 0, sumButtonClicks);
  const totalViews = Math.max(Number(cloudMetrics && cloudMetrics.total_views) || 0, Number(localStats && localStats.views) || 0);
  const localVisitorsCount = (localStats && Array.isArray(localStats.visitors)) ? localStats.visitors.length : 0;
  const uniqueVisitors = Math.max(
    Number(cloudMetrics && cloudMetrics.unique_visitors) || 0,
    localVisitorsCount,
    totalViews > 0 ? 1 : 0
  );
  const ctrPercent = totalViews > 0 ? Number(((totalClicks / totalViews) * 100).toFixed(1)) : 0;

  const metrics = {
    total_views: totalViews,
    unique_visitors: uniqueVisitors,
    total_clicks: totalClicks,
    ctr_percent: ctrPercent,
    clicks_by_button: mergedClicksByButton,
    views_by_date: mergeNumericMapsMax(cloudMetrics && cloudMetrics.views_by_date, localStats && localStats.views_by_date, false),
    clicks_by_date: mergeNumericMapsMax(cloudMetrics && cloudMetrics.clicks_by_date, localStats && localStats.clicks_by_date, false)
  };

  // Construir datos consolidados de botones activos del negocio
  const channelsData = buildChannelsAnalytics(metrics);

  // Actualizar tarjetas de KPI
  document.getElementById("kpiTotalViews").textContent = metrics.total_views;
  document.getElementById("kpiUniqueVisitors").textContent = metrics.unique_visitors;
  document.getElementById("kpiTotalClicks").textContent = metrics.total_clicks;
  document.getElementById("kpiCtr").textContent = metrics.ctr_percent + "%";

  // Renderizar gráficos y desglose por botón
  renderCharts(metrics, channelsData);
  renderButtonsBreakdown(metrics, channelsData);
}

/**
 * Construye el mapa unificado de todos los botones activos y sus clics exactos
 */
function buildChannelsAnalytics(metrics) {
  const b = businessData || {};
  const definitions = [];

  if (b.boton_whatsapp) {
    definitions.push({
      id: "whatsapp",
      aliases: ["whatsapp", "btn_whatsapp"],
      label: "WhatsApp",
      url: b.boton_whatsapp,
      icon: "fab fa-whatsapp",
      color: b.color_btn_whatsapp || "#25D366"
    });
  }
  if (b.boton_instagram) {
    definitions.push({
      id: "instagram",
      aliases: ["instagram", "btn_instagram"],
      label: "Instagram",
      url: b.boton_instagram,
      icon: "fab fa-instagram",
      color: b.color_btn_instagram || "#E1306C"
    });
  }
  if (b.boton_facebook) {
    definitions.push({
      id: "facebook",
      aliases: ["facebook", "btn_facebook"],
      label: "Facebook",
      url: b.boton_facebook,
      icon: "fab fa-facebook-f",
      color: b.color_btn_facebook || "#1877F2"
    });
  }
  if (b.boton_ubicacion) {
    definitions.push({
      id: "ubicacion",
      aliases: ["ubicacion", "btn_ubicacion", "maps"],
      label: "Google Maps",
      url: b.boton_ubicacion,
      icon: "fas fa-map-marker-alt",
      color: b.color_btn_ubicacion || "#EA4335"
    });
  }
  if (b.boton_extra_url) {
    definitions.push({
      id: "extra",
      aliases: ["extra", "btn_extra"],
      label: b.boton_extra_label || "Enlace Destacado",
      url: b.boton_extra_url,
      icon: "fas fa-star",
      color: b.color_btn_extra || b.color_primario || "#eab308"
    });
  }
  if (b.link_google_negocio) {
    definitions.push({
      id: "google_reviews",
      aliases: ["google_reviews", "google_reviews_badge", "btn_google_review"],
      label: "Insignia Google",
      url: b.link_google_negocio,
      icon: "fab fa-google",
      color: "#fbbf24"
    });
  }
  (b.botones_adicionales || []).forEach((btn, idx) => {
    if (!btn || !btn.url) return;
    const aliases = ["extra_" + idx, "btn_extra_" + idx];
    if (btn.id) aliases.push(String(btn.id).toLowerCase());
    definitions.push({
      id: btn.id || "extra_" + idx,
      aliases: aliases,
      label: btn.label || "Botón Extra",
      url: btn.url,
      icon: btn.icon || "fas fa-external-link-alt",
      color: btn.color || b.color_primario || "#6366f1"
    });
  });

  const rawClicks = metrics.clicks_by_button || {};
  const totalClicks = metrics.total_clicks || Object.values(rawClicks).reduce((a, n) => a + (Number(n) || 0), 0);
  const views = Number(metrics.total_views) || 0;

  // Asignar clics reales registrados a cada botón activo
  const mapped = definitions.map(ch => {
    let clicks = 0;
    Object.keys(rawClicks).forEach(k => {
      const kLower = k.toLowerCase();
      const kNorm = kLower.replace(/^btn_/, "");
      const matchesAlias = ch.aliases.includes(kLower) || ch.aliases.includes(kNorm);
      const matchesGoogle = ch.id === "google_reviews" && kLower.includes("google_review");
      if (matchesAlias || matchesGoogle) {
        clicks += (Number(rawClicks[k]) || 0);
      }
    });
    return {
      ...ch,
      clicks: clicks
    };
  });

  const sumMapped = mapped.reduce((acc, item) => acc + item.clicks, 0);
  const denom = Math.max(1, sumMapped || totalClicks || 0);

  return mapped.map(item => ({
    ...item,
    sharePercent: (sumMapped > 0 || totalClicks > 0) ? ((item.clicks / denom) * 100).toFixed(1) : "0.0",
    ctrPercent: views > 0 ? ((item.clicks / views) * 100).toFixed(1) : "0.0"
  }));
}

/**
 * Renderizado de Gráficos Interactivos con Chart.js
 */
function renderCharts(metrics, channelsData) {
  const ctxTimeline = document.getElementById("timelineChart");
  const ctxButtons = document.getElementById("buttonsChart");

  if (timelineChart) timelineChart.destroy();
  if (buttonsChart) buttonsChart.destroy();

  // Gráfico 1: Evolución Temporal
  const viewsMap = metrics.views_by_date || {};
  const clicksMap = metrics.clicks_by_date || {};
  const allDates = Array.from(new Set([...Object.keys(viewsMap), ...Object.keys(clicksMap)])).sort();
  const todayFallback = new Date().toISOString().split("T")[0];
  const labels = allDates.length ? allDates : [todayFallback];
  const dataViews = allDates.length ? allDates.map(d => Number(viewsMap[d]) || 0) : [Number(metrics.total_views) || 0];
  const dataClicks = allDates.length ? allDates.map(d => Number(clicksMap[d]) || 0) : [Number(metrics.total_clicks) || 0];

  if (ctxTimeline) {
    timelineChart = new Chart(ctxTimeline, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Vistas Totales",
            data: dataViews,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.15)",
            fill: true,
            tension: 0.35,
            borderWidth: 2
          },
          {
            label: "Clics a Enlaces",
            data: dataClicks,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            fill: true,
            tension: 0.35,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#9ca3af" } }
        },
        scales: {
          x: { ticks: { color: "#6b7280" }, grid: { color: "rgba(255,255,255,0.05)" } },
          y: { ticks: { color: "#6b7280" }, grid: { color: "rgba(255,255,255,0.05)" } }
        }
      }
    });
  }

  // Gráfico 2: Dona de Clics por Botón
  const filteredLabels = channelsData.map(c => c.label);
  const filteredValues = channelsData.map(c => c.clicks);
  const bgColors = channelsData.map(c => c.color);
  const hasAnyClick = filteredValues.some(v => v > 0);

  if (ctxButtons) {
    buttonsChart = new Chart(ctxButtons, {
      type: "doughnut",
      data: {
        labels: filteredLabels.length ? filteredLabels : ["Sin botones activos"],
        datasets: [
          {
            data: (filteredValues.length && hasAnyClick) ? filteredValues : (filteredLabels.length ? filteredLabels.map(() => 1) : [1]),
            backgroundColor: bgColors.length ? bgColors : ["#6366f1"],
            borderColor: "#111827",
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#9ca3af",
              boxWidth: 10,
              padding: 8,
              font: {
                size: 11,
                family: "'Plus Jakarta Sans', -apple-system, sans-serif"
              }
            }
          }
        },
        layout: {
          padding: { top: 4, bottom: 6 }
        }
      }
    });
  }
}

/**
 * Renderiza el desglose detallado con barras de progreso y CTR individual por cada botón
 */
function renderButtonsBreakdown(metrics, channelsData) {
  const listEl = document.getElementById("buttonsBreakdownList");
  const topBadge = document.getElementById("topButtonBadge");
  const countEl = document.getElementById("activeButtonsCount");
  const totalClicksEl = document.getElementById("breakdownTotalClicks");

  if (!listEl) return;

  const sorted = channelsData.slice().sort((a, b) => b.clicks - a.clicks);
  const sumClicks = sorted.reduce((acc, c) => acc + c.clicks, 0);

  if (countEl) countEl.textContent = sorted.length;
  if (totalClicksEl) totalClicksEl.textContent = sumClicks > 0 ? sumClicks : (metrics.total_clicks || 0);

  if (topBadge) {
    if (sorted.length > 0 && sorted[0].clicks > 0) {
      topBadge.textContent = `${sorted[0].label} (${sorted[0].clicks} clics)`;
    } else if (sorted.length > 0) {
      topBadge.textContent = "Sin clics aún";
    } else {
      topBadge.textContent = "Ninguno";
    }
  }

  if (sorted.length === 0) {
    listEl.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 32px 20px; background: #111827; border-radius: 14px; border: 1px dashed #374151;">
        <i class="fas fa-link" style="font-size: 2rem; color: #6b7280; margin-bottom: 10px; display: block;"></i>
        <p style="font-weight: 700; color: #f3f4f6; margin-bottom: 4px;">No hay botones activos configurados</p>
        <p style="font-size: 0.85rem; color: #9ca3af;">Activa WhatsApp, Instagram o botones personalizados desde el Panel Administrativo para medir sus clics.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = sorted.map((ch, idx) => {
    const isTop = idx === 0 && ch.clicks > 0;
    const widthPct = Math.min(100, Math.max(ch.clicks > 0 ? 6 : 0, parseFloat(ch.sharePercent) || 0));

    return `
      <div class="btn-stat-card ${isTop ? 'top-winner' : ''}">
        <div class="btn-stat-top">
          <div class="btn-stat-identity">
            <div class="btn-stat-icon" style="background: ${escapeHtml(ch.color)};">
              <i class="${escapeHtml(ch.icon)}"></i>
            </div>
            <div style="min-width: 0;">
              <div class="btn-stat-title">
                <span>${escapeHtml(ch.label)}</span>
                ${isTop ? '<span class="btn-rank-badge"><i class="fas fa-trophy"></i> #1 Más Clicado</span>' : ''}
              </div>
              <a href="${escapeHtml(ch.url)}" target="_blank" rel="noopener noreferrer" class="btn-stat-url" title="${escapeHtml(ch.url)}">
                ${escapeHtml(ch.url)}
              </a>
            </div>
          </div>
          <div class="btn-stat-clicks-box">
            <div class="btn-stat-clicks-num">${ch.clicks}</div>
            <div class="btn-stat-clicks-label">Clics</div>
          </div>
        </div>

        <div class="btn-stat-bar-bg">
          <div class="btn-stat-bar-fill" style="width: ${widthPct}%; background: ${escapeHtml(ch.color)};"></div>
        </div>

        <div class="btn-stat-footer">
          <span>Participación: <strong>${ch.sharePercent}%</strong> del total</span>
          <span>CTR vs visitas: <strong>${ch.ctrPercent}%</strong></span>
        </div>
      </div>
    `;
  }).join("");
}
