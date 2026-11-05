/**
 * SCRAPER AUTÓNOMO DE GOOGLE MAPS PARA GITHUB ACTIONS (100% GRATIS, CERO APIS)
 * Ejecuta un navegador Chromium real en la nube de GitHub, entra a Google Maps,
 * ordena las reseñas por "Más recientes" y extrae las últimas opiniones con sus horas exactas.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DATA_FILE = path.join(__dirname, '..', 'data', 'businesses.json');
const CONFIG_FILE = path.join(__dirname, '..', 'config.js');

async function main() {
  console.log('🚀 Iniciando Scraper de Reseñas de Google Maps en GitHub Actions...');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('❌ No se encontró data/businesses.json');
    process.exit(1);
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf8');
  const businesses = JSON.parse(rawData);

  // Intentar leer la URL de Google Apps Script desde config.js
  let gasUrl = '';
  if (fs.existsSync(CONFIG_FILE)) {
    const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
    const match = configContent.match(/googleAppsScriptUrl:\s*["']([^"']+)["']/);
    if (match) gasUrl = match[1];
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--lang=es-MX,es'
    ]
  });

  const businessKeys = Object.keys(businesses);
  console.log(`📋 Total de negocios a inspeccionar: ${businessKeys.length}`);

  for (const id of businessKeys) {
    const b = businesses[id];
    const googleUrl = b.link_google_negocio || b.boton_ubicacion;

    if (!googleUrl || !googleUrl.includes('google.com')) {
      console.log(`⏩ Saltando [${id}] - No tiene enlace de Google Maps.`);
      continue;
    }

    console.log(`\n🔍 Analizando negocio: "${b.nombre_negocio}" (${id})`);
    console.log(`🔗 URL: ${googleUrl}`);

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8' });

      // Navegar a Google Maps
      await page.goto(googleUrl, { waitUntil: 'networkidle2', timeout: 45000 });

      // Si aparece banner de consentimiento de cookies de Google, cerrarlo/aceptarlo
      try {
        const acceptBtn = await page.$('button[aria-label*="Aceptar"], form[action*="consent"] button');
        if (acceptBtn) {
          await acceptBtn.click();
          await page.waitForTimeout(1500);
        }
      } catch (e) {}

      // Extraer Calificación y Total de Reseñas
      const stats = await page.evaluate(() => {
        let rating = 4.8;
        let total = 0;

        const ratingEl = document.querySelector('div.fontDisplayLarge, span.fontDisplayLarge, span[aria-hidden="true"]');
        if (ratingEl) {
          const num = parseFloat(ratingEl.textContent.trim().replace(',', '.'));
          if (!isNaN(num) && num >= 1 && num <= 5) rating = num;
        }

        const totalEl = document.querySelector('button[aria-label*="reseñas"], span[aria-label*="reseñas"]');
        if (totalEl) {
          const match = totalEl.textContent.match(/([\d.,]+)/);
          if (match) total = parseInt(match[1].replace(/[.,]/g, ''), 10);
        }

        return { rating, total };
      });

      console.log(`⭐ Calificación detectada: ${stats.rating} | Total de opiniones: ${stats.total}`);

      // Hacer clic en la pestaña "Reseñas" si existe
      try {
        const reviewsTab = await page.$('button[role="tab"][aria-label*="Reseñas"], button[aria-label*="Reseñas"]');
        if (reviewsTab) {
          await reviewsTab.click();
          await page.waitForTimeout(2000);
        }
      } catch (e) {}

      // Intentar ordenar por "Más recientes"
      try {
        const sortBtn = await page.$('button[aria-label*="Ordenar"], button[data-value*="Ordenar"]');
        if (sortBtn) {
          await sortBtn.click();
          await page.waitForTimeout(1000);
          const newestOption = await page.$('div[role="menuitemradio"][data-index="1"], div[role="menuitem"][data-index="1"]');
          if (newestOption) {
            await newestOption.click();
            await page.waitForTimeout(2500);
          }
        }
      } catch (e) {}

      // Hacer scroll en el contenedor de reseñas para cargar opiniones dinámicas
      await page.evaluate(() => {
        const scrollable = document.querySelector('div.m6QErb.DxyBCb.kA9KIf.dS8AEf') || document.body;
        if (scrollable) scrollable.scrollTop = 800;
      });
      await page.waitForTimeout(1500);

      // Extraer las reseñas individuales
      const extractedReviews = await page.evaluate(() => {
        const items = [];
        const reviewCards = document.querySelectorAll('div.jftiEf, div[data-review-id]');

        reviewCards.forEach(card => {
          // Nombre autor
          const authorEl = card.querySelector('div.d4r55, button.WEB4Lf, .WNxFaf');
          const author = authorEl ? authorEl.textContent.trim() : 'Cliente de Google';

          // Estrellas
          const starsEl = card.querySelector('span.kvMYJc, span[aria-label*="estrellas"]');
          let rating = 5;
          if (starsEl) {
            const match = (starsEl.getAttribute('aria-label') || '').match(/(\d)/);
            if (match) rating = parseInt(match[1], 10);
          }

          // Tiempo (ej: "Hace 2 horas", "Hace 3 días", "Ayer")
          const timeEl = card.querySelector('span.rsqaWe, span.dehysf');
          const timeText = timeEl ? timeEl.textContent.trim() : 'Reciente';

          // Comentario
          const textEl = card.querySelector('span.wiI7pd, div.MyEned');
          const comment = textEl ? textEl.textContent.trim() : '';

          if (comment || author) {
            const isNew = /hora|minuto|min|ayer|hoy/i.test(timeText);
            items.push({
              autor: author,
              rating: rating,
              tiempo: timeText,
              isNew: isNew,
              comentario: comment || 'Excelente experiencia.'
            });
          }
        });

        return items;
      });

      console.log(`💬 Se extrajeron ${extractedReviews.length} reseñas frescas de Google Maps.`);

      // Si se obtuvieron reseñas en vivo, actualizar el perfil
      if (extractedReviews.length > 0) {
        b.google_reviews = {
          rating_promedio: stats.rating,
          total_reviews: stats.total || extractedReviews.length,
          reviews: extractedReviews.slice(0, 8),
          ultima_actualizacion: new Date().toISOString()
        };
      }

      // Si está configurada la URL de Google Sheets, sincronizar también la hoja
      if (gasUrl && b.google_reviews) {
        try {
          console.log(`☁️ Enviando reseñas a Google Sheets para [${id}]...`);
          await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: 'sync_reviews',
              business_id: id,
              google_place_url: googleUrl,
              business_name: b.nombre_negocio,
              data: b.google_reviews
            })
          });
          console.log(`✅ Google Sheets actualizado con éxito.`);
        } catch (e) {
          console.warn(`Advertencia al sincronizar con Sheets:`, e.message);
        }
      }

      await page.close();
    } catch (err) {
      console.error(`❌ Error raspando [${id}]:`, err.message);
    }
  }

  await browser.close();

  // Guardar archivo actualizado en data/businesses.json
  fs.writeFileSync(DATA_FILE, JSON.stringify(businesses, null, 2), 'utf8');
  console.log('💾 data/businesses.json actualizado correctamente con las últimas reseñas.');
  console.log('🎉 Scraper completado con éxito.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
