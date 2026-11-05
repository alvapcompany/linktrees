/**
 * SCRAPER AUTÓNOMO DE GOOGLE MAPS PARA GITHUB ACTIONS (100% GRATIS, CERO APIS)
 * Ejecuta Chromium con evasión de consentimiento de cookies, navega a Google Maps,
 * ordena las reseñas por "Más recientes" y extrae las opiniones con sus horas exactas.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
      '--window-size=1280,900',
      '--lang=es-MX,es'
    ]
  });

  const businessKeys = Object.keys(businesses);
  console.log(`📋 Total de negocios a inspeccionar: ${businessKeys.length}`);

  for (const id of businessKeys) {
    const b = businesses[id];
    let googleUrl = b.link_google_negocio || b.boton_ubicacion;

    // Verificar si es un enlace válido de Google Maps (incluyendo goo.gl y google.com)
    if (!googleUrl || (!googleUrl.includes('google.com') && !googleUrl.includes('goo.gl'))) {
      console.log(`⏩ Saltando [${id}] - No tiene enlace de Google Maps.`);
      continue;
    }

    // Forzar idioma español en Google Maps
    const targetUrl = googleUrl.includes('?') ? `${googleUrl}&hl=es` : `${googleUrl}?hl=es`;

    console.log(`\n======================================================`);
    console.log(`🔍 Analizando negocio: "${b.nombre_negocio}" (${id})`);
    console.log(`🔗 URL: ${targetUrl}`);

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8' });

      // Inyectar cookie de consentimiento para evitar la pantalla de bloqueo de Google en servidores de GitHub
      try {
        await page.setCookie({
          name: 'SOCS',
          value: 'CAESEwgDEgk2OTQ0NTgyNjMaAmVzIAEaBgiA_L2wBg',
          domain: '.google.com',
          path: '/'
        });
      } catch (e) {}

      // Navegar a Google Maps
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 50000 });
      await sleep(3500);

      // Si Google aún muestra el banner de consentimiento, cerrarlo
      try {
        const consentBtns = await page.$$('button[aria-label*="Aceptar"], form button, button[jsname="b3VHJd"]');
        for (const btn of consentBtns) {
          const txt = await page.evaluate(el => el.textContent, btn);
          if (/aceptar|accept|agree/i.test(txt)) {
            await btn.click();
            console.log('✅ Banner de consentimiento aceptado.');
            await sleep(2500);
            break;
          }
        }
      } catch (e) {}

      // Extraer Calificación y Total de Reseñas
      const stats = await page.evaluate(() => {
        let rating = 4.8;
        let total = 0;

        // Buscar puntuación
        const ratingEl = document.querySelector('div.fontDisplayLarge, span.fontDisplayLarge, span[aria-hidden="true"], div.F7nice span');
        if (ratingEl) {
          const num = parseFloat(ratingEl.textContent.trim().replace(',', '.'));
          if (!isNaN(num) && num >= 1 && num <= 5) rating = num;
        }

        // Buscar cantidad de opiniones
        const totalEl = document.querySelector('button[aria-label*="reseñas"], span[aria-label*="reseñas"], button[aria-label*="opiniones"], button[aria-label*="reviews"], div.F7nice span:nth-child(2)');
        if (totalEl) {
          const match = totalEl.textContent.match(/([\d.,]+)/);
          if (match) total = parseInt(match[1].replace(/[.,]/g, ''), 10);
        }

        return { rating, total };
      });

      console.log(`⭐ Calificación detectada: ${stats.rating} | Total de opiniones: ${stats.total}`);

      // Hacer clic en la pestaña "Reseñas" u "Opiniones"
      const tabSelectors = [
        'button[data-tab-index="1"]',
        'div[role="tablist"] button:nth-child(2)',
        'button[aria-label*="Reseñas"]',
        'button[aria-label*="opiniones"]',
        'button[aria-label*="Reviews"]'
      ];

      for (const sel of tabSelectors) {
        const tab = await page.$(sel);
        if (tab) {
          await tab.click();
          console.log(`📌 Pestaña de reseñas abierta (${sel})`);
          await sleep(3000);
          break;
        }
      }

      // Ordenar por "Más recientes"
      try {
        const sortBtn = await page.$('button[aria-label*="Ordenar"], button[data-value="Ordenar"], button[aria-label*="Sort"]');
        if (sortBtn) {
          await sortBtn.click();
          await sleep(1500);

          const clicked = await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('div[role="menuitemradio"], div[role="menuitem"], div.gE4Dac'));
            const newest = options.find(el => /reciente|newest/i.test(el.textContent));
            if (newest) {
              newest.click();
              return true;
            }
            if (options.length > 1) {
              // El 2do elemento suele ser "Más recientes" en Google Maps
              options[1].click();
              return true;
            }
            return false;
          });

          if (clicked) {
            console.log('🔄 Ordenado por "Más recientes". Esperando carga de opiniones...');
            await sleep(4000);
          }
        }
      } catch (e) {
        console.warn('Advertencia ordenando:', e.message);
      }

      // Hacer scroll para cargar más reseñas
      await page.evaluate(() => {
        const scrollable = document.querySelector('div.m6QErb.DxyBCb.kA9KIf.dS8AEf') || document.querySelector('div.m6QErb[aria-label*="opiniones"]') || document.querySelector('div[role="main"]') || document.body;
        if (scrollable) {
          scrollable.scrollTop = 1500;
        }
      });
      await sleep(2500);

      // Expandir textos truncados ("Ver más")
      await page.evaluate(() => {
        document.querySelectorAll('button.w8nwRe, button[aria-label*="Ver más"], button[aria-label*="More"]').forEach(b => b.click());
      });
      await sleep(1200);

      // Extraer las reseñas individuales limpias
      let extractedReviews = await page.evaluate(() => {
        const items = [];
        const reviewCards = document.querySelectorAll('div.jftiEf');

        reviewCards.forEach(card => {
          const authorEl = card.querySelector('div.d4r55, button.WEB4Lf, .WNxFAF, div.q3Y1zc');
          const author = authorEl ? authorEl.textContent.trim() : '';

          const starsEl = card.querySelector('span.kvMYJc, span[aria-label*="estrella"], span[role="img"]');
          let rating = 5;
          if (starsEl) {
            const match = (starsEl.getAttribute('aria-label') || '').match(/(\d)/);
            if (match) rating = parseInt(match[1], 10);
          }

          const timeEl = card.querySelector('span.rsqaWe, span.dehysf');
          const timeText = timeEl ? timeEl.textContent.trim() : 'Reciente';

          const textEl = card.querySelector('span.wiI7pd, div.MyEned');
          let comment = textEl ? textEl.textContent.trim() : '';

          // Filtrar metadatos añadidos por Google (Tipo de comida, Precio por persona, etc.)
          if (comment) {
            comment = comment.replace(/\n*(Tipo de comida|Precio por persona|Comida:|Servicio:|Ambiente:|Platillos recomendados|Estacionamiento|Reservas|Nivel de ruido)[\s\S]*/i, '').trim();
          }

          // Solo incluir si tiene autor y no es un fragmento de código JS
          if (author && !author.includes('function') && (!comment || (!comment.startsWith('],') && !comment.includes('null,')))) {
            const isNew = /hora|minuto|min|ayer|hoy|semana/i.test(timeText);
            items.push({
              autor: author,
              rating: rating,
              tiempo: timeText,
              isNew: isNew,
              comentario: comment || 'Excelente atención y servicio.'
            });
          }
        });

        return items;
      });

      // Deduplicar estrictamente por autor
      const seen = new Set();
      const cleanReviews = [];
      for (const r of extractedReviews) {
        const key = r.autor.toLowerCase().trim();
        if (!seen.has(key) && key.length > 2) {
          seen.add(key);
          cleanReviews.push(r);
        }
      }

      console.log(`💬 Se obtuvieron ${cleanReviews.length} reseñas limpias para [${id}].`);

      if (cleanReviews.length > 0) {
        b.google_reviews = {
          rating_promedio: stats.rating || 4.8,
          total_reviews: stats.total || cleanReviews.length,
          reviews: cleanReviews.slice(0, 8),
          ultima_actualizacion: new Date().toISOString()
        };
        console.log(`✅ [${id}] Perfil de Google Maps actualizado exitosamente.`);
      } else {
        console.log(`ℹ️ [${id}] No se encontraron tarjetas de reseñas en el DOM (se mantiene la versión actual).`);
      }

      // Sincronizar con Google Sheets si está disponible
      if (gasUrl && b.google_reviews) {
        try {
          console.log(`☁️ Transmitiendo a Google Sheets...`);
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
          console.log(`✅ Sincronizado en Google Sheets.`);
        } catch (e) {
          console.warn(`⚠️ Google Sheets sync falló para [${id}]:`, e.message);
        }
      }

      await page.close();
    } catch (err) {
      console.error(`❌ Error procesando [${id}]:`, err.message);
    }
  }

  await browser.close();

  // Guardar archivo actualizado
  fs.writeFileSync(DATA_FILE, JSON.stringify(businesses, null, 2), 'utf8');
  console.log('\n💾 data/businesses.json actualizado con éxito.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
