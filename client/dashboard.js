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
let currentPeriod = "all";
let customSelectedDate = "";
let cachedRawDataset = null;

function purgeBrowserCaches(refreshCss = false) {
  try {
    localStorage.removeItem("alvap_biz_" + businessId);
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
        if (href.includes("dashboard.css")) {
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

purgeBrowserCaches(true);

document.addEventListener("DOMContentLoaded", refreshDashboardState);

window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    purgeBrowserCaches(true);
    window.location.reload();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    purgeBrowserCaches(true);
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

  // Aplicar paleta real del tema/Linktree del negocio al dashboard (evitando colores genéricos)
  const activeTheme = (typeof CONFIG !== "undefined" && Array.isArray(CONFIG.themes))
    ? CONFIG.themes.find(t => t.id === businessData.tema)
    : null;
  const hasGenericDefaults = (!businessData.color_primario || businessData.color_primario.toLowerCase() === "#6366f1")
    && (!businessData.color_acento || businessData.color_acento.toLowerCase() === "#a855f7")
    && !businessData.custom_colors_active;

  const primaryColor = (hasGenericDefaults && activeTheme && activeTheme.accentColor)
    ? activeTheme.accentColor
    : (businessData.color_primario || (activeTheme && activeTheme.accentColor) || businessData.color_btn_extra);
  const accentColor = (hasGenericDefaults && activeTheme && activeTheme.accentColor)
    ? activeTheme.accentColor
    : (businessData.color_secundario || businessData.color_acento || primaryColor);

  if (primaryColor) {
    document.documentElement.style.setProperty("--primary", primaryColor);
    if (/^#[0-9a-f]{6}$/i.test(primaryColor)) {
      document.documentElement.style.setProperty("--border-color", `${primaryColor}4d`);
    }
  }
  if (accentColor) {
    document.documentElement.style.setProperty("--accent", accentColor);
  }

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

function getTodayDateStr() {
  return new Date().toISOString().split("T")[0];
}

function getIsoWeekStr(dateStr) {
  const parts = String(dateStr || "").split("-");
  if (parts.length !== 3) return "";
  const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  if (isNaN(d.getTime())) return "";
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + "-W" + (weekNo < 10 ? "0" + weekNo : String(weekNo));
}

function getMonthStr(dateStr) {
  return String(dateStr || "").substring(0, 7);
}

function stripButtonDateSuffix(rawKey) {
  const clean = String(rawKey || "").trim().toLowerCase();
  const match = clean.match(/^(.+?)__(\d{4}-\d{2}-\d{2})$/);
  if (match) {
    return { cleanKey: match[1], dateKey: match[2] };
  }
  return { cleanKey: clean, dateKey: null };
}

function sumBtnAliases(clicksMap, aliases) {
  if (!clicksMap) return 0;
  let total = 0;
  Object.keys(clicksMap).forEach(k => {
    const base = k.toLowerCase().replace(/__\d{4}-\d{2}-\d{2}$/, "");
    const norm = base.replace(/^btn_/, "");
    if (aliases.includes(base) || aliases.includes(norm) || (aliases.includes("google_reviews") && base.includes("google_review"))) {
      total += (Number(clicksMap[k]) || 0);
    }
  });
  return total;
}

function buildDailyLedger(cloudMetrics, localStats) {
  const byDate = {};

  function ensureDateRow(rawDate) {
    const m = String(rawDate || "").match(/^(\d{4}-\d{2}-\d{2})/);
    const dateKey = m ? m[1] : getTodayDateStr();
    if (!byDate[dateKey]) {
      byDate[dateKey] = {
        fecha: dateKey,
        semana: getIsoWeekStr(dateKey),
        mes: getMonthStr(dateKey),
        views: 0,
        unique_visitors: 0,
        total_clicks: 0,
        clicks_by_button: {}
      };
    }
    return byDate[dateKey];
  }

  // A. Filas estructuradas desde Google Apps Script (Metricas_Por_Dia)
  const hasCloudDailyRows = Boolean(cloudMetrics && Array.isArray(cloudMetrics.daily_rows) && cloudMetrics.daily_rows.length > 0);
  if (hasCloudDailyRows) {
    cloudMetrics.daily_rows.forEach(r => {
      const row = ensureDateRow(r.fecha);
      row.views = Math.max(row.views, Number(r.views) || 0);
      row.unique_visitors = Math.max(row.unique_visitors, Number(r.unique_visitors) || 0);
      row.total_clicks = Math.max(row.total_clicks, Number(r.total_clicks) || 0);
      const btns = r.clicks_by_button || {};
      Object.keys(btns).forEach(bk => {
        const cleanBk = String(bk).trim().toLowerCase();
        if (cleanBk) {
          row.clicks_by_button[cleanBk] = Math.max(Number(row.clicks_by_button[cleanBk]) || 0, Number(btns[bk]) || 0);
        }
      });
    });
  }

  // B. Mapas por fecha de Google Apps Script
  if (cloudMetrics && cloudMetrics.views_by_date) {
    Object.keys(cloudMetrics.views_by_date).forEach(d => {
      const row = ensureDateRow(d);
      row.views = Math.max(row.views, Number(cloudMetrics.views_by_date[d]) || 0);
    });
  }
  if (cloudMetrics && cloudMetrics.clicks_by_date) {
    Object.keys(cloudMetrics.clicks_by_date).forEach(d => {
      const row = ensureDateRow(d);
      row.total_clicks = Math.max(row.total_clicks, Number(cloudMetrics.clicks_by_date[d]) || 0);
    });
  }

  // C. Clics por botón desde GAS (incluye formato con fecha whatsapp__YYYY-MM-DD y respaldo legado)
  if (cloudMetrics && cloudMetrics.clicks_by_button) {
    const undatedCloud = {};
    const datedPlaced = {};

    Object.keys(cloudMetrics.clicks_by_button).forEach(rawK => {
      const val = Number(cloudMetrics.clicks_by_button[rawK]) || 0;
      if (val <= 0) return;
      const parsed = stripButtonDateSuffix(rawK);
      if (parsed.dateKey) {
        const row = ensureDateRow(parsed.dateKey);
        row.clicks_by_button[parsed.cleanKey] = Math.max(Number(row.clicks_by_button[parsed.cleanKey]) || 0, val);
        datedPlaced[parsed.cleanKey] = (datedPlaced[parsed.cleanKey] || 0) + val;
      } else if (!hasCloudDailyRows) {
        undatedCloud[parsed.cleanKey] = (undatedCloud[parsed.cleanKey] || 0) + val;
      }
    });

    if (!hasCloudDailyRows) {
      const sortedDates = Object.keys(byDate).sort();
      const targetFallbackDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : getTodayDateStr();
      Object.keys(undatedCloud).forEach(btnK => {
        const rem = Math.max(0, undatedCloud[btnK] - (datedPlaced[btnK] || 0));
        if (rem > 0) {
          const row = ensureDateRow(targetFallbackDate);
          row.clicks_by_button[btnK] = Math.max(Number(row.clicks_by_button[btnK]) || 0, rem);
        }
      });
    }
  }

  // D. Datos locales del dispositivo (views_by_date, clicks_by_date, clicks_by_date_button)
  if (localStats) {
    if (localStats.views_by_date) {
      Object.keys(localStats.views_by_date).forEach(d => {
        const row = ensureDateRow(d);
        row.views = Math.max(row.views, Number(localStats.views_by_date[d]) || 0);
      });
    }
    if (localStats.clicks_by_date) {
      Object.keys(localStats.clicks_by_date).forEach(d => {
        const row = ensureDateRow(d);
        row.total_clicks = Math.max(row.total_clicks, Number(localStats.clicks_by_date[d]) || 0);
      });
    }
    if (localStats.clicks_by_date_button) {
      Object.keys(localStats.clicks_by_date_button).forEach(d => {
        const row = ensureDateRow(d);
        const dayBtns = localStats.clicks_by_date_button[d] || {};
        Object.keys(dayBtns).forEach(bk => {
          const cleanBk = stripButtonDateSuffix(bk).cleanKey;
          if (cleanBk) {
            row.clicks_by_button[cleanBk] = Math.max(Number(row.clicks_by_button[cleanBk]) || 0, Number(dayBtns[bk]) || 0);
          }
        });
      });
    } else if (localStats.clicks) {
      const sortedDates = Object.keys(byDate).sort();
      const targetFallbackDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : getTodayDateStr();
      Object.keys(localStats.clicks).forEach(bk => {
        const cleanBk = stripButtonDateSuffix(bk).cleanKey;
        const val = Number(localStats.clicks[bk]) || 0;
        if (cleanBk && val > 0) {
          const alreadySummed = Object.values(byDate).reduce((acc, r) => acc + (Number(r.clicks_by_button[cleanBk]) || 0), 0);
          if (val > alreadySummed) {
            const row = ensureDateRow(targetFallbackDate);
            row.clicks_by_button[cleanBk] = (Number(row.clicks_by_button[cleanBk]) || 0) + (val - alreadySummed);
          }
        }
      });
    }
  }

  return Object.values(byDate).map(row => {
    const sumBtns = Object.values(row.clicks_by_button).reduce((a, b) => a + (Number(b) || 0), 0);
    row.total_clicks = Math.max(row.total_clicks, sumBtns);
    row.unique_visitors = row.unique_visitors > 0 ? row.unique_visitors : row.views;
    return row;
  }).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function filterLedgerByPeriod(ledger, period, exactDate) {
  if (!Array.isArray(ledger)) return [];
  const today = getTodayDateStr();
  const todayTime = new Date(today + "T00:00:00Z").getTime();

  return ledger.filter(row => {
    if (period === "all" || !period) return true;
    if (period === "day") return row.fecha === today;
    if (period === "custom") return exactDate ? row.fecha === exactDate : true;

    const rowTime = new Date(row.fecha + "T00:00:00Z").getTime();
    if (!isFinite(rowTime) || !isFinite(todayTime)) return true;
    const diffDays = (todayTime - rowTime) / 86400000;

    if (period === "week") return diffDays >= 0 && diffDays < 7;
    if (period === "month") return diffDays >= 0 && diffDays < 30;
    return true;
  });
}

function aggregateFilteredMetrics(filteredRows, cloudMetrics, localStats, period) {
  let views = 0;
  let clicks = 0;
  const clicksByButton = {};
  const viewsByDate = {};
  const clicksByDate = {};

  filteredRows.forEach(r => {
    views += Number(r.views) || 0;
    clicks += Number(r.total_clicks) || 0;
    viewsByDate[r.fecha] = Number(r.views) || 0;
    clicksByDate[r.fecha] = Number(r.total_clicks) || 0;
    Object.keys(r.clicks_by_button || {}).forEach(bk => {
      clicksByButton[bk] = (clicksByButton[bk] || 0) + (Number(r.clicks_by_button[bk]) || 0);
    });
  });

  let uniqueVisitors = 0;
  if (period === "all") {
    const localVisitorsCount = (localStats && Array.isArray(localStats.visitors)) ? localStats.visitors.length : 0;
    views = Math.max(views, Number(cloudMetrics && cloudMetrics.total_views) || 0, Number(localStats && localStats.views) || 0);
    clicks = Math.max(clicks, Number(cloudMetrics && cloudMetrics.total_clicks) || 0);
    uniqueVisitors = Math.max(Number(cloudMetrics && cloudMetrics.unique_visitors) || 0, localVisitorsCount, views > 0 ? 1 : 0);
  } else {
    const summedVisitors = filteredRows.reduce((acc, r) => acc + (Number(r.unique_visitors) || Number(r.views) || 0), 0);
    uniqueVisitors = views > 0 ? Math.max(1, Math.min(views, summedVisitors || views)) : 0;
  }

  const ctrPercent = views > 0 ? Number(((clicks / views) * 100).toFixed(1)) : 0;

  return {
    total_views: views,
    unique_visitors: uniqueVisitors,
    total_clicks: clicks,
    ctr_percent: ctrPercent,
    clicks_by_button: clicksByButton,
    views_by_date: viewsByDate,
    clicks_by_date: clicksByDate
  };
}

function updateFilterUiState(period, exactDate) {
  const mapBtn = {
    day: "filterBtnDay",
    week: "filterBtnWeek",
    month: "filterBtnMonth",
    all: "filterBtnAll"
  };
  Object.keys(mapBtn).forEach(k => {
    const el = document.getElementById(mapBtn[k]);
    if (el) el.classList.toggle("active", k === period);
  });

  if (period !== "custom") {
    const dateInput = document.getElementById("customDateFilter");
    if (dateInput) dateInput.value = "";
  }

  const badge = document.getElementById("activePeriodBadge");
  const subtitle = document.getElementById("timelinePeriodSubtitle");
  let labelText = "Histórico completo";
  let subText = "Historial por fecha";

  if (period === "day") {
    labelText = `Hoy (${getTodayDateStr()})`;
    subText = "Actividad de hoy";
  } else if (period === "week") {
    labelText = "Últimos 7 días";
    subText = "Últimos 7 días";
  } else if (period === "month") {
    labelText = "Últimos 30 días";
    subText = "Últimos 30 días";
  } else if (period === "custom" && exactDate) {
    labelText = `Día ${exactDate}`;
    subText = `Día ${exactDate}`;
  }

  if (badge) badge.textContent = "Mostrando: " + labelText;
  if (subtitle) subtitle.textContent = subText;
}

function renderDailyMetricsTable(rows) {
  const tbody = document.getElementById("dailyMetricsTableBody");
  window.__lastDailyRows = rows || [];
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 24px; color: #9ca3af;">No hay vistas o clics registrados en el periodo seleccionado.</td></tr>`;
    return;
  }

  const descRows = rows.slice().reverse();
  tbody.innerHTML = descRows.map(r => {
    const ctr = r.views > 0 ? ((r.total_clicks / r.views) * 100).toFixed(1) + "%" : "0%";
    const cWa = sumBtnAliases(r.clicks_by_button, ["whatsapp", "btn_whatsapp"]);
    const cIg = sumBtnAliases(r.clicks_by_button, ["instagram", "btn_instagram"]);
    const cFb = sumBtnAliases(r.clicks_by_button, ["facebook", "btn_facebook"]);
    const cMaps = sumBtnAliases(r.clicks_by_button, ["ubicacion", "btn_ubicacion", "maps"]);
    const cExtra = sumBtnAliases(r.clicks_by_button, ["extra", "btn_extra"]);
    const cReviews = sumBtnAliases(r.clicks_by_button, ["google_reviews", "google_reviews_badge", "btn_google_review"]);

    return `
      <tr>
        <td><strong>${escapeHtml(r.fecha)}</strong></td>
        <td><span class="daily-pill-code">${escapeHtml(r.semana)}</span></td>
        <td><span class="daily-pill-code">${escapeHtml(r.mes)}</span></td>
        <td>${Number(r.views) || 0}</td>
        <td><strong style="color: #34d399;">${Number(r.total_clicks) || 0}</strong></td>
        <td>${ctr}</td>
        <td>${cWa}</td>
        <td>${cIg}</td>
        <td>${cFb}</td>
        <td>${cMaps}</td>
        <td>${cExtra}</td>
        <td>${cReviews}</td>
      </tr>
    `;
  }).join("");
}

function applyDashboardView() {
  if (!cachedRawDataset) return;
  const { ledger, cloudMetrics, localStats } = cachedRawDataset;
  const filteredRows = filterLedgerByPeriod(ledger, currentPeriod, customSelectedDate);
  const metrics = aggregateFilteredMetrics(filteredRows, cloudMetrics, localStats, currentPeriod);

  updateFilterUiState(currentPeriod, customSelectedDate);

  const channelsData = buildChannelsAnalytics(metrics);
  document.getElementById("kpiTotalViews").textContent = metrics.total_views;
  document.getElementById("kpiUniqueVisitors").textContent = metrics.unique_visitors;
  document.getElementById("kpiTotalClicks").textContent = metrics.total_clicks;
  document.getElementById("kpiCtr").textContent = metrics.ctr_percent + "%";

  renderCharts(metrics, channelsData);
  renderButtonsBreakdown(metrics, channelsData);
  renderDailyMetricsTable(filteredRows);
}

window.setDashboardPeriod = function (period) {
  currentPeriod = period || "all";
  customSelectedDate = "";
  applyDashboardView();
};

window.setCustomDashboardDate = function (dateStr) {
  if (!dateStr) {
    currentPeriod = "all";
    customSelectedDate = "";
  } else {
    currentPeriod = "custom";
    customSelectedDate = dateStr;
  }
  applyDashboardView();
};

window.exportDailyTableCsv = function () {
  const rows = (window.__lastDailyRows || []).slice().reverse();
  const headers = ["Fecha", "Semana", "Mes", "Negocio", "Vistas", "Clics Totales", "CTR", "WhatsApp", "Instagram", "Facebook", "Google Maps", "Enlace Extra", "Insignia Google"];
  const lines = [headers.join(",")];

  rows.forEach(r => {
    const ctr = r.views > 0 ? ((r.total_clicks / r.views) * 100).toFixed(1) + "%" : "0%";
    const vals = [
      r.fecha,
      r.semana,
      r.mes,
      businessId,
      Number(r.views) || 0,
      Number(r.total_clicks) || 0,
      ctr,
      sumBtnAliases(r.clicks_by_button, ["whatsapp", "btn_whatsapp"]),
      sumBtnAliases(r.clicks_by_button, ["instagram", "btn_instagram"]),
      sumBtnAliases(r.clicks_by_button, ["facebook", "btn_facebook"]),
      sumBtnAliases(r.clicks_by_button, ["ubicacion", "btn_ubicacion", "maps"]),
      sumBtnAliases(r.clicks_by_button, ["extra", "btn_extra"]),
      sumBtnAliases(r.clicks_by_button, ["google_reviews", "google_reviews_badge", "btn_google_review"])
    ];
    lines.push(vals.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  });

  const csvContent = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `metricas_${businessId}_${currentPeriod || "all"}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Carga y computa métricas de vistas y clics consolidando nube (GAS) + dispositivo local
 */
async function loadMetrics() {
  let cloudMetrics = null;

  // 1. Consultar desde Google Apps Script si está disponible
  const gasUrl = (businessData && businessData.gas_url)
    ? businessData.gas_url
    : ((typeof CONFIG !== "undefined" && CONFIG.googleAppsScriptUrl)
      ? CONFIG.googleAppsScriptUrl
      : localStorage.getItem("alvap_gas_url"));

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

  // 3. Construir registro estructurado por día/semana/mes y aplicar el filtro activo
  const ledger = buildDailyLedger(cloudMetrics, localStats);
  cachedRawDataset = { ledger, cloudMetrics, localStats };
  applyDashboardView();
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
      const kLower = k.toLowerCase().replace(/__\d{4}-\d{2}-\d{2}$/, "");
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
          <span>Clics vs visitas: <strong>${ch.ctrPercent}%</strong></span>
        </div>
      </div>
    `;
  }).join("");

  initClientDesignEditor(channelsData);
}

let clientButtonOrder = [];
let clientSelectedTheme = "";
let clientSelectedButtonStyle = "icon_only";
let clientThemeCategoryFilter = "all";
let clientCustomColorsTouched = false;

function normalizeHexColor(c, fallback = "#6366f1") {
  if (!c) return fallback;
  const trimmed = String(c).trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  return fallback;
}

function encodeGitHubBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function putGitHubJsonFile(repoOwner, repoName, filePath, mutateFn, commitMsg, token) {
  const headers = {
    "Authorization": `Bearer ${token.trim()}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json"
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const getRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${filePath}?_t=${Date.now()}`, {
      headers,
      cache: "no-store"
    });
    if (!getRes.ok) {
      throw new Error(`No se pudo leer ${repoOwner}/${repoName}/${filePath} (HTTP ${getRes.status})`);
    }
    const fileData = await getRes.json();
    const parsed = JSON.parse(decodeGitHubBase64Utf8(fileData.content || ""));
    const updated = mutateFn(parsed);
    const putRes = await fetch(`https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${filePath}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: commitMsg,
        content: encodeGitHubBase64Utf8(JSON.stringify(updated, null, 2)),
        sha: fileData.sha,
        branch: "main"
      })
    });
    if (putRes.ok) return await putRes.json();
    if (putRes.status === 409 && attempt < 2) continue;
    throw new Error(`Error guardando ${filePath} (HTTP ${putRes.status})`);
  }
}

function initClientDesignEditor(channelsData) {
  const listEl = document.getElementById("clientButtonOrderList");
  const primaryInput = document.getElementById("clientColorPrimary");
  const accentInput = document.getElementById("clientColorAccent");
  if (!listEl || !primaryInput || !accentInput) return;

  clientSelectedTheme = (businessData && businessData.tema) || "modern-dark";
  clientSelectedButtonStyle = (businessData && businessData.estilo_botones) || "icon_only";

  const activeTheme = (typeof CONFIG !== "undefined" && Array.isArray(CONFIG.themes))
    ? CONFIG.themes.find(t => t.id === clientSelectedTheme)
    : null;
  const hasGenericDefaults = (!businessData || !businessData.color_primario || businessData.color_primario.toLowerCase() === "#6366f1")
    && (!businessData || !businessData.color_acento || businessData.color_acento.toLowerCase() === "#a855f7")
    && !(businessData && businessData.custom_colors_active);

  if (hasGenericDefaults && activeTheme && activeTheme.accentColor && /^#[0-9a-f]{6}$/i.test(activeTheme.accentColor)) {
    primaryInput.value = activeTheme.accentColor;
    accentInput.value = activeTheme.accentColor;
  } else {
    if (businessData && businessData.color_primario && /^#[0-9a-f]{6}$/i.test(businessData.color_primario)) {
      primaryInput.value = businessData.color_primario;
    }
    const savedAccent = businessData && (businessData.color_secundario || businessData.color_acento);
    if (savedAccent && /^#[0-9a-f]{6}$/i.test(savedAccent)) {
      accentInput.value = savedAccent;
    }
  }

  primaryInput.oninput = () => {
    clientCustomColorsTouched = true;
    document.documentElement.style.setProperty("--primary", primaryInput.value);
  };
  accentInput.oninput = () => {
    clientCustomColorsTouched = true;
    document.documentElement.style.setProperty("--accent", accentInput.value);
  };

  if (!clientButtonOrder.length && Array.isArray(channelsData)) {
    const reorderable = channelsData
      .filter(ch => ch.id !== "google_reviews")
      .map(ch => ({ id: ch.id, label: ch.label, color: normalizeHexColor(ch.color) }));

    const savedOrder = businessData && Array.isArray(businessData.orden_botones) ? businessData.orden_botones : [];
    if (savedOrder.length > 0) {
      reorderable.sort((a, b) => {
        const ia = savedOrder.indexOf(a.id);
        const ib = savedOrder.indexOf(b.id);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }
    clientButtonOrder = reorderable;
  }

  updateActiveThemeBadge();
  renderClientThemesGrid();
  renderClientButtonStylesGrid();
  renderClientButtonOrderList();
}

function updateActiveThemeBadge() {
  const badgeEl = document.getElementById("clientActiveThemeBadge");
  if (!badgeEl) return;
  const themes = (typeof CONFIG !== "undefined" && Array.isArray(CONFIG.themes)) ? CONFIG.themes : [];
  const found = themes.find(t => t.id === clientSelectedTheme);
  if (businessData && businessData.custom_colors_active && clientCustomColorsTouched) {
    badgeEl.textContent = "Diseño: Colores personalizados";
  } else if (found) {
    badgeEl.textContent = `Diseño: ${found.name}`;
  } else {
    badgeEl.textContent = `Diseño: ${clientSelectedTheme || "Personalizado"}`;
  }
}

function renderClientThemesGrid() {
  const grid = document.getElementById("clientThemesGrid");
  if (!grid) return;

  const themes = (typeof CONFIG !== "undefined" && Array.isArray(CONFIG.themes)) ? CONFIG.themes : [];
  const filtered = clientThemeCategoryFilter === "all"
    ? themes
    : themes.filter(t => t.category === clientThemeCategoryFilter);

  if (!filtered.length) {
    grid.innerHTML = `<p style="font-size: 0.84rem; color: #9ca3af;">No hay diseños disponibles en esta categoría.</p>`;
    return;
  }

  const isCustomOnly = Boolean(businessData && businessData.custom_colors_active && clientCustomColorsTouched);

  grid.innerHTML = filtered.map(t => {
    const isActive = (t.id === clientSelectedTheme) && !isCustomOnly;
    const borderStyle = isActive
      ? "2px solid var(--primary)"
      : "1px solid var(--border-color)";

    return `
      <div style="background: #0b1120; border: ${borderStyle}; border-radius: 14px; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
        <div style="background: ${t.bg}; border: 1px solid ${t.cardBorder || 'rgba(255,255,255,0.18)'}; border-radius: 10px; height: 74px; padding: 8px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="width: 14px; height: 14px; border-radius: 50%; background: ${t.accentColor || '#6366f1'}; border: 1.5px solid rgba(255,255,255,0.5);"></span>
            <span style="height: 6px; width: 48%; border-radius: 4px; background: ${t.textColor || '#fff'}; opacity: 0.75;"></span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="height: 11px; border-radius: 5px; background: ${t.cardBg || 'rgba(255,255,255,0.14)'}; border: 1px solid ${t.cardBorder || 'rgba(255,255,255,0.2)'};"></div>
            <div style="height: 11px; border-radius: 5px; background: ${t.cardBg || 'rgba(255,255,255,0.14)'}; border: 1px solid ${t.cardBorder || 'rgba(255,255,255,0.2)'};"></div>
          </div>
        </div>
        <div style="font-size: 0.78rem; font-weight: 700; color: #f3f4f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
        ${isActive
          ? `<button type="button" class="btn btn-secondary" disabled style="width: 100%; justify-content: center; padding: 6px 10px; font-size: 0.76rem; opacity: 0.85; cursor: default;">✓ Activo</button>`
          : `<button type="button" class="btn btn-primary" onclick="changeClientTheme('${escapeHtml(t.id)}')" style="width: 100%; justify-content: center; padding: 6px 10px; font-size: 0.76rem;">Cambiar</button>`
        }
      </div>
    `;
  }).join("");
}

window.filterClientThemes = function (category) {
  clientThemeCategoryFilter = category || "all";
  document.querySelectorAll("#clientThemeFilters [data-client-filter]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-client-filter") === clientThemeCategoryFilter);
  });
  renderClientThemesGrid();
};

window.changeClientTheme = async function (themeId) {
  clientSelectedTheme = themeId;
  clientCustomColorsTouched = false;

  const themes = (typeof CONFIG !== "undefined" && Array.isArray(CONFIG.themes)) ? CONFIG.themes : [];
  const themeObj = themes.find(t => t.id === themeId);
  const primaryInput = document.getElementById("clientColorPrimary");

  const accentInput = document.getElementById("clientColorAccent");

  if (themeObj && themeObj.accentColor && /^#[0-9a-f]{6}$/i.test(themeObj.accentColor)) {
    if (primaryInput) primaryInput.value = themeObj.accentColor;
    if (accentInput) accentInput.value = themeObj.accentColor;
    document.documentElement.style.setProperty("--primary", themeObj.accentColor);
    document.documentElement.style.setProperty("--accent", themeObj.accentColor);
    document.documentElement.style.setProperty("--border-color", `${themeObj.accentColor}4d`);
  }

  if (businessData) {
    businessData.tema = themeId;
    businessData.custom_colors_active = false;
  }

  updateActiveThemeBadge();
  renderClientThemesGrid();
  await window.saveClientDesign({ preserveCustomColorsFlag: true });
};

function renderClientButtonStylesGrid() {
  const grid = document.getElementById("clientButtonStylesGrid");
  if (!grid) return;

  const primaryColor = (document.getElementById("clientColorPrimary") && document.getElementById("clientColorPrimary").value) || "#6366f1";
  const styles = [
    {
      id: "icon_only",
      name: "Minimalista con Ícono",
      desc: "Tarjeta limpia con ícono a color",
      previewStyle: "background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); color: #fff;",
      iconBg: primaryColor
    },
    {
      id: "full_card",
      name: "Botón Lleno de Color",
      desc: "Botones sólidos llamativos",
      previewStyle: `background: ${primaryColor}; border: 1px solid rgba(255,255,255,0.25); color: #fff;`,
      iconBg: "rgba(0,0,0,0.25)"
    },
    {
      id: "border_glow",
      name: "Borde Brillante Neón",
      desc: "Borde luminoso en cada botón",
      previewStyle: `background: rgba(255,255,255,0.06); border: 1.5px solid ${primaryColor}; box-shadow: 0 0 12px ${primaryColor}55; color: #fff;`,
      iconBg: primaryColor
    }
  ];

  grid.innerHTML = styles.map(st => {
    const isActive = st.id === clientSelectedButtonStyle;
    const cardBorder = isActive ? "2px solid var(--primary)" : "1px solid var(--border-color)";
    return `
      <div style="background: #0b1120; border: ${cardBorder}; border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
        <div style="${st.previewStyle} border-radius: 10px; padding: 8px 10px; display: flex; align-items: center; gap: 8px;">
          <span style="width: 24px; height: 24px; border-radius: 7px; background: ${st.iconBg}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.72rem;"><i class="fas fa-link"></i></span>
          <span style="font-size: 0.78rem; font-weight: 700;">Ejemplo de botón</span>
        </div>
        <div>
          <div style="font-size: 0.85rem; font-weight: 700; color: #f3f4f6;">${escapeHtml(st.name)}</div>
          <div style="font-size: 0.75rem; color: #9ca3af;">${escapeHtml(st.desc)}</div>
        </div>
        ${isActive
          ? `<button type="button" class="btn btn-secondary" disabled style="width: 100%; justify-content: center; padding: 6px 10px; font-size: 0.76rem; opacity: 0.85; cursor: default;">✓ Activo</button>`
          : `<button type="button" class="btn btn-primary" onclick="changeClientButtonStyle('${escapeHtml(st.id)}')" style="width: 100%; justify-content: center; padding: 6px 10px; font-size: 0.76rem;">Cambiar</button>`
        }
      </div>
    `;
  }).join("");
}

window.changeClientButtonStyle = async function (styleId) {
  clientSelectedButtonStyle = styleId;
  if (businessData) {
    businessData.estilo_botones = styleId;
  }
  renderClientButtonStylesGrid();
  await window.saveClientDesign({ preserveCustomColorsFlag: true });
};

function renderClientButtonOrderList() {
  const listEl = document.getElementById("clientButtonOrderList");
  if (!listEl) return;

  if (!clientButtonOrder.length) {
    listEl.innerHTML = `<p style="font-size: 0.84rem; color: #9ca3af;">No hay botones activos para reordenar.</p>`;
    return;
  }

  listEl.innerHTML = clientButtonOrder.map((btn, idx) => `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #0b1120; border: 1px solid var(--border-color); border-radius: 12px; padding: 10px 14px;">
      <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
        <input type="color" value="${escapeHtml(normalizeHexColor(btn.color))}" title="Color del botón" onchange="updateClientButtonColor(${idx}, this.value)" style="width: 32px; height: 28px; border: none; border-radius: 6px; background: transparent; cursor: pointer; flex-shrink: 0;">
        <span style="font-size: 0.9rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(btn.label)}</span>
      </div>
      <div style="display: flex; gap: 6px; flex-shrink: 0;">
        <button type="button" class="btn btn-secondary" style="padding: 6px 10px; font-size: 0.8rem;" onclick="moveClientButton(${idx}, -1)" ${idx === 0 ? "disabled" : ""} title="Subir">↑</button>
        <button type="button" class="btn btn-secondary" style="padding: 6px 10px; font-size: 0.8rem;" onclick="moveClientButton(${idx}, 1)" ${idx === clientButtonOrder.length - 1 ? "disabled" : ""} title="Bajar">↓</button>
      </div>
    </div>
  `).join("");
}

window.updateClientButtonColor = function (index, newColor) {
  if (!clientButtonOrder[index]) return;
  clientButtonOrder[index].color = newColor;
};

window.moveClientButton = function (index, direction) {
  const target = index + direction;
  if (target < 0 || target >= clientButtonOrder.length) return;
  const temp = clientButtonOrder[index];
  clientButtonOrder[index] = clientButtonOrder[target];
  clientButtonOrder[target] = temp;
  renderClientButtonOrderList();
};

window.saveClientDesign = async function (opts = {}) {
  const primaryInput = document.getElementById("clientColorPrimary");
  const accentInput = document.getElementById("clientColorAccent");
  const statusEl = document.getElementById("clientDesignStatus");
  const btn = document.getElementById("btnSaveClientDesign");

  const primaryColor = primaryInput ? primaryInput.value : (businessData && businessData.color_primario) || "#6366f1";
  const accentColor = accentInput ? accentInput.value : (businessData && businessData.color_acento) || "#a855f7";
  const selectedTheme = clientSelectedTheme || (businessData && businessData.tema) || "modern-dark";
  const selectedButtonStyle = clientSelectedButtonStyle || (businessData && businessData.estilo_botones) || "icon_only";
  const customColorsActive = opts && opts.preserveCustomColorsFlag
    ? Boolean(businessData && businessData.custom_colors_active)
    : (clientCustomColorsTouched ? true : Boolean(businessData && businessData.custom_colors_active));

  const buttonOrder = clientButtonOrder.map(b => b.id);
  const buttonColors = {};
  clientButtonOrder.forEach(b => {
    buttonColors[b.id] = b.color;
  });

  if (businessData) {
    businessData.id = businessData.id || businessId;
    businessData.tema = selectedTheme;
    businessData.estilo_botones = selectedButtonStyle;
    businessData.color_primario = primaryColor;
    businessData.color_acento = accentColor;
    businessData.custom_colors_active = customColorsActive;
    businessData.orden_botones = buttonOrder;
    if (buttonColors.whatsapp) businessData.color_btn_whatsapp = buttonColors.whatsapp;
    if (buttonColors.instagram) businessData.color_btn_instagram = buttonColors.instagram;
    if (buttonColors.facebook) businessData.color_btn_facebook = buttonColors.facebook;
    if (buttonColors.ubicacion) businessData.color_btn_ubicacion = buttonColors.ubicacion;
    if (buttonColors.extra) businessData.color_btn_extra = buttonColors.extra;
    if (Array.isArray(businessData.botones_adicionales)) {
      businessData.botones_adicionales = businessData.botones_adicionales.map((extraBtn, idx) => {
        const key = extraBtn.id || ("extra_" + idx);
        return buttonColors[key] ? { ...extraBtn, color: buttonColors[key] } : extraBtn;
      });
    }
    businessData.fecha_actualizacion = new Date().toISOString();
    localStorage.setItem("alvap_biz_" + businessId, JSON.stringify(businessData));
  }

  const design = {
    tema: selectedTheme,
    estilo_botones: selectedButtonStyle,
    custom_colors_active: customColorsActive,
    color_primario: primaryColor,
    color_acento: accentColor,
    button_order: buttonOrder,
    button_colors: buttonColors
  };
  localStorage.setItem(`alvap_design_${businessId}`, JSON.stringify(design));

  if (btn) btn.disabled = true;
  if (statusEl) {
    statusEl.style.display = "block";
    statusEl.style.color = "#9ca3af";
    statusEl.textContent = "⏳ Guardando cambios en tu tarjeta...";
  }

  const gasUrl = (businessData && businessData.gas_url)
    ? businessData.gas_url
    : ((typeof CONFIG !== "undefined" && CONFIG.googleAppsScriptUrl)
      ? CONFIG.googleAppsScriptUrl
      : localStorage.getItem("alvap_gas_url"));

  const ghOwner = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.owner) ? CONFIG.github.owner : "alvapcompany";
  const ghMainRepo = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.repo) ? CONFIG.github.repo : "linktrees";
  const ghToken = (typeof CONFIG !== "undefined" && CONFIG.github && CONFIG.github.token)
    ? CONFIG.github.token.trim()
    : (localStorage.getItem("alvap_github_token") || "").trim();

  let syncedGithub = false;
  let syncedSheets = false;

  try {
    if (ghToken && businessData) {
      if (typeof GitHubSync !== "undefined" && typeof GitHubSync.autoCommitBusiness === "function") {
        await GitHubSync.autoCommitBusiness(
          ghOwner,
          ghMainRepo,
          businessData,
          { [businessId]: businessData },
          ghToken
        );
        syncedGithub = true;
      } else {
        const applyDesignMutation = (target) => {
          const next = {
            ...(target || {}),
            tema: selectedTheme,
            estilo_botones: selectedButtonStyle,
            color_primario: primaryColor,
            color_acento: accentColor,
            custom_colors_active: customColorsActive,
            orden_botones: buttonOrder,
            fecha_actualizacion: businessData.fecha_actualizacion
          };
          if (buttonColors.whatsapp) next.color_btn_whatsapp = buttonColors.whatsapp;
          if (buttonColors.instagram) next.color_btn_instagram = buttonColors.instagram;
          if (buttonColors.facebook) next.color_btn_facebook = buttonColors.facebook;
          if (buttonColors.ubicacion) next.color_btn_ubicacion = buttonColors.ubicacion;
          if (buttonColors.extra) next.color_btn_extra = buttonColors.extra;
          if (Array.isArray(next.botones_adicionales)) {
            next.botones_adicionales = next.botones_adicionales.map((extraBtn, idx) => {
              const key = extraBtn.id || ("extra_" + idx);
              return buttonColors[key] ? { ...extraBtn, color: buttonColors[key] } : extraBtn;
            });
          }
          return next;
        };

        const promises = [];
        if (businessData.deploy_individual_repo !== false) {
          const rawRepo = String(businessData.github_repo || businessId).trim();
          const parts = rawRepo.includes("/") ? rawRepo.split("/") : [ghOwner, rawRepo];
          promises.push(
            putGitHubJsonFile(parts[0], parts[1], "business.json", applyDesignMutation, `feat(design): actualizar colores y orden [${businessId}]`, ghToken)
          );
        }
        promises.push(
          putGitHubJsonFile(
            ghOwner,
            ghMainRepo,
            "data/businesses.json",
            (dict) => ({
              ...(dict || {}),
              [businessId]: applyDesignMutation((dict && dict[businessId]) || businessData)
            }),
            `feat(design): actualizar colores y orden [${businessId}]`,
            ghToken
          )
        );
        await Promise.all(promises);
        syncedGithub = true;
      }
    }
  } catch (ghErr) {
    console.warn("No se pudo sincronizar diseño con GitHub:", ghErr);
  }

  try {
    if (gasUrl) {
      await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "save_design",
          business_id: businessId,
          design
        })
      });
      syncedSheets = true;
    }
  } catch (gasErr) {
    console.warn("No se pudo enviar diseño a Google Sheets:", gasErr);
  }

  applyDashboardView();
  updateActiveThemeBadge();
  renderClientThemesGrid();
  renderClientButtonStylesGrid();

  if (statusEl) {
    statusEl.style.display = "block";
    if (syncedGithub) {
      statusEl.style.color = "#34d399";
      statusEl.textContent = "✅ ¡Diseño guardado! Los cambios ya se aplicaron en tu tarjeta.";
    } else if (syncedSheets) {
      statusEl.style.color = "#34d399";
      statusEl.textContent = "✅ Diseño guardado en el registro.";
    } else {
      statusEl.style.color = "#f59e0b";
      statusEl.textContent = "⚠️ Guardado localmente (sin conexión).";
    }
  }
  if (btn) btn.disabled = false;
};
