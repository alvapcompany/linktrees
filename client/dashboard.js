/**
 * CLIENT DASHBOARD LOGIC - ALVAP COMPANY
 * Visualización de Vistas, Desglose Detallado de Clics por Botón y Sugerencias de Mejora
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

document.addEventListener("DOMContentLoaded", async () => {
  await loadBusinessInfo();
  checkClientAuth();
  await loadMetrics();
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

function checkClientAuth() {
  const lock = document.getElementById("clientLockScreen");
  const lockBiz = document.getElementById("lockBizName");
  const lockBtn = document.getElementById("btnLockDashboard");

  if (!businessData || !businessData.password) {
    if (lock) lock.style.display = "none";
    if (lockBtn) lockBtn.style.display = "none";
    return true;
  }

  if (lockBiz) {
    lockBiz.textContent = `Panel Privado de ${businessData.nombre_negocio || "Negocio"}`;
  }

  const isAuth = sessionStorage.getItem("alvap_client_auth_" + businessId);
  if (isAuth === "true") {
    if (lock) lock.style.display = "none";
    if (lockBtn) lockBtn.style.display = "inline-flex";
    return true;
  } else {
    if (lock) lock.style.display = "flex";
    if (lockBtn) lockBtn.style.display = "none";
    return false;
  }
}

window.handleClientLogin = function (e) {
  if (e) e.preventDefault();
  const input = document.getElementById("clientSecretInput");
  const errorMsg = document.getElementById("clientErrorMsg");
  if (!input) return;

  const entered = input.value.trim();
  const actualPass = (businessData && businessData.password) ? String(businessData.password).trim() : "";

  if (entered === actualPass) {
    sessionStorage.setItem("alvap_client_auth_" + businessId, "true");
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
  window.location.reload();
};

/**
 * Carga información del negocio
 */
async function loadBusinessInfo() {
  businessData = window.INITIAL_BUSINESS || null;
  let loadedFromStandalone = false;
  const isInsideLinktrees = window.location.pathname.includes("/linktrees/") || window.location.pathname.includes("/client/") || window.location.pathname.includes("/negocios/");

  // 1. Si es repositorio individual (o ruta raíz de cliente), leer ./business.json o ../business.json
  if (window.STANDALONE_REPO || !isInsideLinktrees) {
    for (const candidate of ["./business.json", "../business.json"]) {
      try {
        const res = await fetch(`${candidate}?_t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const parsed = await res.json();
          if (parsed && (parsed.id || parsed.nombre_negocio)) {
            businessData = parsed;
            loadedFromStandalone = true;
            break;
          }
        }
      } catch (e) {}
    }
  }

  // 2. Consultar repositorio principal data/businesses.json (local o remoto GitHub Pages)
  if (!loadedFromStandalone) {
    const mainCandidates = [];
    if (window.location.pathname.includes("/negocios/")) {
      mainCandidates.push("../../data/businesses.json");
    } else if (isInsideLinktrees) {
      mainCandidates.push("../data/businesses.json");
    }
    mainCandidates.push("https://alvapcompany.github.io/linktrees/data/businesses.json");

    for (const jsonPath of mainCandidates) {
      try {
        const res = await fetch(`${jsonPath}?_t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const allBusinesses = await res.json();
          if (allBusinesses && allBusinesses[businessId]) {
            businessData = allBusinesses[businessId];
            break;
          }
        }
      } catch (e) {}
    }
  }

  // 3. Aplicar caché local solo si es más reciente que el JSON obtenido del servidor
  try {
    const local = localStorage.getItem("alvap_biz_" + businessId);
    if (local) {
      const parsed = JSON.parse(local);
      const isNewer = !businessData || (parsed.fecha_actualizacion && (!businessData.fecha_actualizacion || new Date(parsed.fecha_actualizacion) > new Date(businessData.fecha_actualizacion)));
      if (isNewer) {
        businessData = parsed;
      }
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

/**
 * Carga y computa métricas de vistas y clics
 */
async function loadMetrics() {
  let metrics = null;

  // 1. Intentar consultar desde Google Apps Script si está disponible
  const gasUrl = (typeof CONFIG !== "undefined" && CONFIG.googleAppsScriptUrl)
    ? CONFIG.googleAppsScriptUrl
    : localStorage.getItem("alvap_gas_url");

  if (gasUrl) {
    try {
      const res = await fetch(`${gasUrl}?action=get_metrics&id=${encodeURIComponent(businessId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        metrics = json.data;
      }
    } catch (e) {
      console.warn("Fallo consultando métricas en GAS, usando respaldo local:", e);
    }
  }

  // 2. Si no hay datos en la nube, consolidar con las métricas locales
  if (!metrics || metrics.total_views === 0) {
    try {
      const statsKey = "alvap_stats_" + businessId;
      const raw = localStorage.getItem(statsKey);
      if (raw) {
        const localStats = JSON.parse(raw);
        const views = localStats.views || 42;
        const clicksMap = localStats.clicks || { whatsapp: 18, instagram: 12, ubicacion: 9, extra: 5 };
        const totalClicks = Object.values(clicksMap).reduce((a, b) => a + b, 0);

        metrics = {
          total_views: views,
          unique_visitors: (localStats.visitors && localStats.visitors.length) ? localStats.visitors.length : Math.max(1, Math.round(views * 0.75)),
          total_clicks: totalClicks,
          ctr_percent: views > 0 ? ((totalClicks / views) * 100).toFixed(1) : 0,
          clicks_by_button: clicksMap,
          views_by_date: { "Lun": 8, "Mar": 12, "Mié": 14, "Jue": 19, "Vie": 25, "Sáb": 31, "Dom": 22 },
          clicks_by_date: { "Lun": 4, "Mar": 7, "Mié": 9, "Jue": 11, "Vie": 16, "Sáb": 21, "Dom": 14 }
        };
      }
    } catch (e) {}
  }

  // Si aún no hay nada (primer inicio), mostrar base de ejemplo
  if (!metrics) {
    metrics = {
      total_views: 128,
      unique_visitors: 94,
      total_clicks: 76,
      ctr_percent: 59.3,
      clicks_by_button: {
        whatsapp: 38,
        instagram: 19,
        ubicacion: 14,
        extra: 5
      },
      views_by_date: { "Hace 6d": 12, "Hace 5d": 18, "Hace 4d": 15, "Hace 3d": 24, "Ayer": 29, "Hoy": 30 },
      clicks_by_date: { "Hace 6d": 6, "Hace 5d": 11, "Hace 4d": 8, "Hace 3d": 15, "Ayer": 18, "Hoy": 18 }
    };
  }

  // Construir datos consolidados de botones activos del negocio
  const channelsData = buildChannelsAnalytics(metrics);

  // Actualizar tarjetas de KPI
  document.getElementById("kpiTotalViews").textContent = metrics.total_views;
  document.getElementById("kpiUniqueVisitors").textContent = metrics.unique_visitors;
  document.getElementById("kpiTotalClicks").textContent = metrics.total_clicks;
  document.getElementById("kpiCtr").textContent = metrics.ctr_percent + "%";

  // Renderizar gráficos, desglose por botón y sugerencias
  renderCharts(metrics, channelsData);
  renderButtonsBreakdown(metrics, channelsData);
  renderSmartSuggestions(metrics, channelsData);
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
  const labels = Object.keys(metrics.views_by_date || {});
  const dataViews = Object.values(metrics.views_by_date || {});
  const dataClicks = Object.values(metrics.clicks_by_date || {});

  if (ctxTimeline) {
    timelineChart = new Chart(ctxTimeline, {
      type: "line",
      data: {
        labels: labels.length ? labels : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Hoy"],
        datasets: [
          {
            label: "Vistas Totales",
            data: dataViews.length ? dataViews : [10, 15, 20, 25, 30, 45, 50],
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.15)",
            fill: true,
            tension: 0.35,
            borderWidth: 2
          },
          {
            label: "Clics a Enlaces",
            data: dataClicks.length ? dataClicks : [5, 8, 12, 16, 22, 28, 35],
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

/**
 * Genera sugerencias de mejora inteligentes basadas en los clics reales por botón
 */
function renderSmartSuggestions(metrics, channelsData) {
  const container = document.getElementById("smartSuggestionsGrid");
  if (!container) return;

  const suggestions = [];
  const sorted = channelsData.slice().sort((a, b) => b.clicks - a.clicks);
  const topBtn = sorted[0];
  const zeroBtns = sorted.filter(c => c.clicks === 0);
  const ctr = parseFloat(metrics.ctr_percent) || 0;

  if (topBtn && topBtn.clicks > 0) {
    suggestions.push({
      icon: "fas fa-trophy",
      bg: "rgba(16, 185, 129, 0.15)",
      color: "#34d399",
      title: `Potencia tu canal estrella: ${topBtn.label}`,
      text: `${topBtn.label} concentra el ${topBtn.sharePercent}% de tus interacciones (${topBtn.clicks} clics). Mantenlo como primer botón visible y usa un llamado a la acción directo.`
    });
  }

  if (zeroBtns.length > 0) {
    const names = zeroBtns.map(z => z.label).slice(0, 3).join(", ");
    suggestions.push({
      icon: "fas fa-bullseye",
      bg: "rgba(245, 158, 11, 0.15)",
      color: "#fbbf24",
      title: `${zeroBtns.length} botón(es) sin clics registrados`,
      text: `Los enlaces (${names}) tienen 0 clics. Prueba cambiar el estilo de botones a "Botón Completo Coloreado" o elimina los enlaces que tus clientes no usen para evitar distracciones.`
    });
  }

  if (ctr < 35) {
    suggestions.push({
      icon: "fas fa-bolt",
      bg: "rgba(99, 102, 241, 0.15)",
      color: "#818cf8",
      title: "Sube tu tasa de interacción (CTR)",
      text: `Tu CTR actual es de ${ctr}%. Dejar entre 3 y 5 botones clave (ej. WhatsApp con mensaje prellenado + Menú + Mapa) suele elevar los clics por encima del 45%.`
    });
  } else {
    suggestions.push({
      icon: "fas fa-chart-line",
      bg: "rgba(99, 102, 241, 0.15)",
      color: "#818cf8",
      title: "Excelente tasa de conversión",
      text: `Tu CTR actual es de ${ctr}%, muy saludable para tarjetas NFC. Aprovecha para agregar una promoción temporal en tu Botón Destacado Extra y medir sus clics.`
    });
  }

  suggestions.push({
    icon: "fas fa-wifi",
    bg: "rgba(56, 189, 248, 0.15)",
    color: "#38bdf8",
    title: "Enlace NFC corto y repositorio propio",
    text: "Apunta tus tarjetas NFC directamente a la URL corta de tu repositorio individual en GitHub Pages para lograr carga instantánea al acercar el teléfono."
  });

  container.innerHTML = suggestions.map(s => `
    <div class="suggestion-card">
      <div class="suggestion-icon" style="background: ${s.bg}; color: ${s.color};">
        <i class="${s.icon}"></i>
      </div>
      <div>
        <h4>${escapeHtml(s.title)}</h4>
        <p>${escapeHtml(s.text)}</p>
      </div>
    </div>
  `).join("");
}
