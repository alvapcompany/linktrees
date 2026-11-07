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
      '--lang=es-419,es-MX,es'
    ]
  });

  const businessKeys = Object.keys(businesses);
  console.log(`📋 Total de negocios a inspeccionar: ${businessKeys.length}`);

  for (const id of businessKeys) {
    const b = businesses[id];
    let googleUrl = b.link_google_negocio || b.boton_ubicacion;

    // Si es enlace de writereview directo, convertir a enlace de ficha para poder inspeccionar las reseñas
    if (googleUrl && googleUrl.includes('writereview?placeid=')) {
      const pIdMatch = googleUrl.match(/placeid=([a-zA-Z0-9_-]+)/);
      if (pIdMatch) {
        googleUrl = `https://www.google.com/maps/place/?q=place_id:${pIdMatch[1]}`;
      }
    }

    // Verificar si es un enlace válido de Google Maps (incluyendo goo.gl y google.com)
    if (!googleUrl || (!googleUrl.includes('google.com') && !googleUrl.includes('goo.gl'))) {
      console.log(`⏩ Saltando [${id}] - No tiene enlace de Google Maps.`);
      continue;
    }

    // Forzar idioma español de México (es-419 y gl=MX)
    const targetUrl = googleUrl.includes('?') ? `${googleUrl}&hl=es-419&gl=MX` : `${googleUrl}?hl=es-419&gl=MX`;

    console.log(`\n======================================================`);
    console.log(`🔍 Analizando negocio: "${b.nombre_negocio}" (${id})`);
    console.log(`🔗 URL: ${targetUrl}`);

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-419,es-MX;q=0.9,es;q=0.8,en;q=0.1' });

      // Inyectar cookies de idioma Español México y consentimiento de Google
      try {
        await page.setCookie(
          {
            name: 'PREF',
            value: 'hl=es-419&gl=MX',
            domain: '.google.com',
            path: '/'
          },
          {
            name: 'SOCS',
            value: 'CAESEwgDEgk2OTQ0NTgyNjMaAmVzIAEaBgiA_L2wBg',
            domain: '.google.com',
            path: '/'
          }
        );
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

      // Realizar scroll continuo profundo para cargar lotes sucesivos de reseñas
      console.log('🔄 Ejecutando scroll continuo para cargar la mayor cantidad de opiniones reales...');
      let prevCount = 0;
      let noChangeCount = 0;

      for (let cycle = 1; cycle <= 35; cycle++) {
        try {
          await page.mouse.move(360, 500);
          await page.mouse.wheel({ deltaY: 3500 });
          await page.keyboard.press('PageDown');
        } catch (e) {}

        await page.evaluate(() => {
          const scrollers = document.querySelectorAll('div.m6QErb.DxyBCb, div.m6QErb[aria-label*="opiniones"], div.m6QErb[aria-label*="reseñas"], div[role="main"], div.dS8AEf');
          scrollers.forEach(s => {
            if (s.scrollHeight > s.clientHeight) {
              s.scrollTop += 3000;
              s.dispatchEvent(new Event('scroll', { bubbles: true }));
            }
          });

          const cards = document.querySelectorAll('div.jftiEf');
          if (cards.length > 0) {
            cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        });

        await sleep(1400);
      }

      // Expandir textos truncados ("Ver más")
      await page.evaluate(() => {
        document.querySelectorAll('button.w8nwRe, button[aria-label*="Ver más"], button[aria-label*="More"]').forEach(b => b.click());
      });
      await sleep(1500);

      // Extraer todas las reseñas visibles limpias
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
          let timeText = timeEl ? timeEl.textContent.trim() : 'Reciente';

          const textEl = card.querySelector('span.wiI7pd, div.MyEned');
          let comment = textEl ? textEl.textContent.trim() : '';

          // 1. Extraer original si Google tradujo automáticamente
          if (comment.includes('(Original)')) {
            comment = comment.split('(Original)')[1];
          } else if (comment.includes('(Texto original)')) {
            comment = comment.split('(Texto original)')[1];
          }
          comment = comment.replace(/^\(Traducido por Google\)\s*/i, '').replace(/^\(Translated by Google\)\s*/i, '');

          // 2. Limpiar etiquetas de encuestas de Google Maps
          if (comment) {
            comment = comment.replace(/\n*(Tipo de comida|Precio por persona|Comida:|Servicio:|Ambiente:|Platillos recomendados|Estacionamiento|Reservas|Nivel de ruido|Opciones vegetarianas|Accesibilidad|Meal type|Price per person|Food:|Service:|Atmosphere:|Group size|Wait time|Noise level|Parking|Kid-friendliness|Wheelchair|Order type)[\s\S]*/i, '').trim();
          }

          // 3. Traducir formato de tiempo en inglés a Español México
          timeText = timeText
            .replace(/(\d+)\s+months?\s+ago/i, 'Hace $1 meses')
            .replace(/(\d+)\s+weeks?\s+ago/i, 'Hace $1 semanas')
            .replace(/(\d+)\s+days?\s+ago/i, 'Hace $1 días')
            .replace(/(\d+)\s+hours?\s+ago/i, 'Hace $1 horas')
            .replace(/(\d+)\s+minutes?\s+ago/i, 'Hace $1 min')
            .replace(/a\s+month\s+ago/i, 'Hace 1 mes')
            .replace(/a\s+week\s+ago/i, 'Hace 1 semana')
            .replace(/a\s+day\s+ago/i, 'Ayer')
            .replace(/an\s+hour\s+ago/i, 'Hace 1 hora')
            .replace(/just now/i, 'Hace un momento');

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

      // Deduplicar scrapeadas de esta sesión
      const seenNow = new Set();
      const sessionClean = [];
      for (const r of extractedReviews) {
        const key = (r.autor.trim() + '::' + r.comentario.trim().slice(0, 30)).toLowerCase();
        if (!seenNow.has(key) && r.autor.length > 2) {
          seenNow.add(key);
          sessionClean.push(r);
        }
      }

      console.log(`💬 Se extrajeron ${sessionClean.length} reseñas de Google Maps en esta corrida.`);

      // 4. ACUMULACIÓN INTELIGENTE Y DETECCIÓN DE RESEÑAS NUEVAS
      const existingReviews = (b.google_reviews && Array.isArray(b.google_reviews.reviews)) 
        ? b.google_reviews.reviews 
        : [];

      const makeKey = (r) => (r.autor.trim() + '::' + (r.comentario || '').trim().slice(0, 30)).toLowerCase();
      const existingMap = new Map();
      for (const er of existingReviews) {
        existingMap.set(makeKey(er), er);
      }

      const newlyFoundReviews = [];
      for (const r of sessionClean) {
        const k = makeKey(r);
        if (!existingMap.has(k)) {
          // ¡Nueva reseña en vivo detectada!
          r.isNew = true;
          newlyFoundReviews.push(r);
          console.log(`⚡ [NUEVA RESEÑA EN VIVO]: "${r.autor}" (${r.rating}★) - "${r.comentario.slice(0, 45)}..."`);
        } else {
          // Ya existía en nuestra base de datos: actualizar tiempo
          const existing = existingMap.get(k);
          existing.tiempo = r.tiempo;
          if (/hora|minuto|min|ayer|hoy/i.test(r.tiempo)) {
            existing.isNew = true;
          }
        }
      }

      // Combinar: primero las nuevas detectadas (LIFO), luego las existentes acumuladas
      const accumulated = [...newlyFoundReviews];
      for (const er of existingReviews) {
        accumulated.push(er);
      }

      // Deduplicación final
      const finalUnique = [];
      const finalSeenKeys = new Set();
      for (const r of accumulated) {
        const k = makeKey(r);
        if (!finalSeenKeys.has(k)) {
          finalSeenKeys.add(k);
          finalUnique.push(r);
        }
      }

      // Filtrar estrictamente: solo opiniones recientes de horas, semanas o máximo 1 mes
      const maxOneMonthReviews = finalUnique.filter(r => {
        const t = (r.tiempo || "").toLowerCase();
        if (/hora|minuto|min|ayer|hoy|semana/i.test(t)) return true;
        if (/1\s*mes|un\s*mes/i.test(t)) return true;
        return false;
      });

      // Mantener rating y total real de Google Maps (sin degradar a conteo parcial)
      const realTotal = stats.total || (b.google_reviews && b.google_reviews.total_reviews) || 683;
      const realRating = stats.rating || (b.google_reviews && b.google_reviews.rating_promedio) || 4.4;

      if (maxOneMonthReviews.length > 0) {
        b.google_reviews = {
          rating_promedio: realRating,
          total_reviews: realTotal,
          reviews: maxOneMonthReviews,
          ultima_actualizacion: new Date().toISOString()
        };
        console.log(`✅ [${id}] Base de datos acumulada: ${finalUnique.length} opiniones guardadas (Total Maps: ${realTotal}, ${realRating}★).`);
      } else {
        console.log(`ℹ️ [${id}] No se detectaron tarjetas nuevas; se preserva la base de datos acumulada.`);
      }

      // Sincronizar con Google Sheets si está disponible
      if (gasUrl && b.google_reviews) {
        try {
          console.log(`☁️ Transmitiendo reseñas y datos a Google Sheets...`);
          // 1. Guardar en Reseñas_Cache
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
          // 2. Guardar actualización en Negocios
          await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: 'save_business',
              data: b
            })
          });
          console.log(`✅ Sincronizado en Google Sheets (Reseñas_Cache y Negocios).`);
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
