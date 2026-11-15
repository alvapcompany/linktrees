/**
 * GitHub API Sync Engine (100% Client-Side & Gratis)
 * Gestiona la creación/actualización de repositorios individuales por Linktree
 * (con su propio Visor NFC y Dashboard de Clics) y los enlaza en el repositorio principal.
 */
const GitHubSync = {
  getHeaders(token) {
    return {
      "Authorization": `Bearer ${token.trim()}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };
  },

  /**
   * Codifica texto UTF-8 a Base64 de forma segura en navegador y Node.js
   */
  encodeBase64Utf8(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  /**
   * Decodifica contenido Base64 UTF-8 desde la API de GitHub
   */
  decodeBase64Utf8(b64) {
    const cleanB64 = (b64 || "").replace(/\s/g, "");
    const binStr = atob(cleanB64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  },

  /**
   * Limpia campos obsoletos (como google_reviews) y normaliza metadata de repositorio
   */
  normalizeBusinessEntry(biz, idFallback, defaultOwner) {
    const id = (biz && biz.id) || idFallback;
    const rawCopy = { ...(biz || {}) };
    delete rawCopy.google_reviews;

    const repoInput = (rawCopy.github_repo || id || "").trim();
    const { owner: targetOwner, repo: targetRepo } = this.parseRepoRef(repoInput, defaultOwner);
    const slugRepo = targetRepo || id;
    const repoField = targetOwner.toLowerCase() === defaultOwner.toLowerCase() ? slugRepo : `${targetOwner}/${slugRepo}`;
    const repoUrl = `https://github.com/${targetOwner}/${slugRepo}`;
    const pagesUrl = `https://${targetOwner.toLowerCase()}.github.io/${slugRepo}/`;
    const dashboardUrl = `${pagesUrl}dashboard.html`;
    const deployIndividual = rawCopy.deploy_individual_repo !== false;

    return {
      ...rawCopy,
      id,
      github_repo: repoField,
      deploy_individual_repo: deployIndividual,
      repo_url: rawCopy.repo_url || (deployIndividual ? repoUrl : ""),
      pages_url: rawCopy.pages_url || (deployIndividual ? pagesUrl : ""),
      dashboard_url: rawCopy.dashboard_url || (deployIndividual ? dashboardUrl : "")
    };
  },

  /**
   * Verifica la validez del token y obtiene datos del usuario / organización
   */
  async verifyAuth(token) {
    if (!token) throw new Error("No se ha configurado un Token de GitHub.");
    const res = await fetch("https://api.github.com/user", {
      headers: this.getHeaders(token)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Error de autenticación GitHub (HTTP ${res.status})`);
    }
    return await res.json();
  },

  /**
   * Comprueba si GitHub Pages está activo en el repositorio y lo habilita en branch 'main' si falta
   */
  async ensurePagesEnabled(owner, repo, token) {
    const headers = this.getHeaders(token);
    try {
      const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages?_t=${Date.now()}`, {
        headers,
        cache: "no-store"
      });
      if (checkRes.ok) {
        const pageInfo = await checkRes.json();
        if (pageInfo.status === "errored") {
          await fetch(`https://api.github.com/repos/${owner}/${repo}/pages/builds`, {
            method: "POST",
            headers
          }).catch(() => {});
        }
        return pageInfo;
      }
      if (checkRes.status === 404) {
        const enableRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            source: { branch: "main", path: "/" }
          })
        });
        if (enableRes.ok || enableRes.status === 201 || enableRes.status === 409) {
          return await enableRes.json().catch(() => ({ status: "enabled" }));
        }
        const err = await enableRes.json().catch(() => ({}));
        console.warn(`No se pudo habilitar Pages en ${owner}/${repo}:`, err.message || enableRes.status);
      }
    } catch (e) {
      console.warn(`Advertencia verificando/activando Pages en ${owner}/${repo}:`, e);
    }
    return null;
  },

  /**
   * Comprueba si el repositorio existe; si no, lo crea automáticamente
   */
  async ensureRepository(owner, repo, token) {
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: this.getHeaders(token)
    });

    if (checkRes.ok) {
      return await checkRes.json();
    }

    // Si es 404, intentar crearlo
    if (checkRes.status === 404) {
      console.log(`Repositorio ${owner}/${repo} no existe. Creándolo automáticamente...`);

      // Determinar si el owner es una organización o el usuario logueado
      const user = await this.verifyAuth(token);
      const isOrg = user.login.toLowerCase() !== owner.toLowerCase();
      const endpoint = isOrg
        ? `https://api.github.com/orgs/${owner}/repos`
        : `https://api.github.com/user/repos`;

      const createRes = await fetch(endpoint, {
        method: "POST",
        headers: this.getHeaders(token),
        body: JSON.stringify({
          name: repo,
          description: "Linktree Inteligente NFC & Dashboard de Clics - Alvap Company",
          private: false,
          auto_init: true
        })
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error("No se pudo crear el repositorio: " + (err.message || createRes.statusText));
      }

      const created = await createRes.json();

      // Breve espera para que GitHub inicialice la rama main tras auto_init
      // (Pages se activa tras subir index.html y dashboard.html para evitar builds fallidos en vacío)
      await new Promise(resolve => setTimeout(resolve, 1500));

      return created;
    }

    throw new Error(`Error consultando repositorio ${owner}/${repo}: HTTP ${checkRes.status}`);
  },

  /**
   * Normaliza un nombre de repositorio o formato "owner/repo"
   */
  parseRepoRef(repoInput, defaultOwner) {
    const clean = (repoInput || "")
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/^\/+|\/+$/g, "");
    if (!clean) return { owner: defaultOwner, repo: "" };
    if (clean.includes("/")) {
      const parts = clean.split("/").filter(Boolean);
      return { owner: parts[0], repo: parts[1].replace(/[^a-zA-Z0-9._-]/g, "-") };
    }
    return { owner: defaultOwner, repo: clean.replace(/[^a-zA-Z0-9._-]/g, "-") };
  },

  /**
   * Lee y decodifica business.json desde un repositorio individual enlazado
   */
  async fetchBusinessFromRepo(owner, clientRepoInput, token) {
    const { owner: targetOwner, repo: targetRepo } = this.parseRepoRef(clientRepoInput, owner);
    if (!targetRepo) throw new Error("Nombre de repositorio individual inválido.");

    const res = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepo}/contents/business.json?_t=${Date.now()}`, {
      headers: this.getHeaders(token),
      cache: "no-store"
    });

    if (res.status === 404) {
      throw new Error(`No se encontró 'business.json' en ${targetOwner}/${targetRepo}. Verifica que el repositorio exista o haya sido publicado.`);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Error leyendo ${targetOwner}/${targetRepo} (HTTP ${res.status})`);
    }

    const fileData = await res.json();
    const decoded = this.decodeBase64Utf8(fileData.content || "");
    const parsed = JSON.parse(decoded);
    delete parsed.google_reviews;
    return parsed;
  },

  /**
   * Lee data/businesses.json del repositorio principal en GitHub (para fusionar sin perder otros negocios)
   */
  async fetchRemoteMainBusinesses(owner, repo, token) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/data/businesses.json?_t=${Date.now()}`, {
        headers: this.getHeaders(token),
        cache: "no-store"
      });
      if (!res.ok) return {};
      const fileData = await res.json();
      const decoded = this.decodeBase64Utf8(fileData.content || "");
      const parsed = JSON.parse(decoded);
      return (parsed && typeof parsed === "object") ? parsed : {};
    } catch (e) {
      console.warn("No se pudo leer data/businesses.json remoto:", e);
      return {};
    }
  },

  /**
   * Obtiene el SHA de un archivo existente si está en el repositorio
   */
  async getFileSha(owner, repo, path, token) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?_t=${Date.now()}`, {
        headers: this.getHeaders(token),
        cache: "no-store"
      });
      if (res.ok) {
        const data = await res.json();
        return data.sha;
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Hace un commit de un archivo al repositorio con reintentos ante conflictos/inicialización
   */
  async commitFile(owner, repo, path, contentString, message, token) {
    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const sha = await this.getFileSha(owner, repo, path, token);
      const base64Content = this.encodeBase64Utf8(contentString);

      const bodyPayload = {
        message: message,
        content: base64Content,
        branch: "main"
      };
      if (sha) {
        bodyPayload.sha = sha;
      }

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: "PUT",
        headers: this.getHeaders(token),
        body: JSON.stringify(bodyPayload)
      });

      if (res.ok) {
        return await res.json();
      }

      const err = await res.json().catch(() => ({}));
      lastError = new Error(`Error en commit de ${path}: ` + (err.message || res.statusText));

      if ((res.status === 404 || res.status === 409 || res.status === 422) && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 800));
        continue;
      }

      throw lastError;
    }

    throw lastError || new Error(`Error en commit de ${path}`);
  },

  /**
   * Despliega un Linktree autónomo + su propio Dashboard de Clics en un repositorio individual de GitHub
   */
  async deployToLinkedRepo(owner, clientRepoInput, businessData, mainRepo, token) {
    const { owner: targetOwner, repo: targetRepo } = this.parseRepoRef(clientRepoInput, owner);
    if (!targetRepo) throw new Error("Nombre de repositorio individual requerido.");

    await this.ensureRepository(targetOwner, targetRepo, token);

    const repoUrl = `https://github.com/${targetOwner}/${targetRepo}`;
    const pagesUrl = `https://${targetOwner.toLowerCase()}.github.io/${targetRepo}/`;
    const dashboardUrl = `${pagesUrl}dashboard.html`;

    const cleanBusiness = { ...(businessData || {}) };
    delete cleanBusiness.google_reviews;

    const payloadBusiness = {
      ...cleanBusiness,
      github_repo: targetOwner.toLowerCase() === owner.toLowerCase() ? targetRepo : `${targetOwner}/${targetRepo}`,
      deploy_individual_repo: true,
      repo_url: repoUrl,
      pages_url: pagesUrl,
      dashboard_url: dashboardUrl,
      fecha_actualizacion: cleanBusiness.fecha_actualizacion || new Date().toISOString()
    };

    // 1. business.json
    await this.commitFile(
      targetOwner,
      targetRepo,
      "business.json",
      JSON.stringify(payloadBusiness, null, 2),
      `chore(sync): actualizar configuración de [${payloadBusiness.id}]`,
      token
    );

    // 2. index.html (Visor público NFC del cliente)
    const standaloneHtml = this.generateStandaloneRepoHtml(payloadBusiness, owner, mainRepo);
    await this.commitFile(
      targetOwner,
      targetRepo,
      "index.html",
      standaloneHtml,
      `build(site): desplegar Linktree autónomo [${payloadBusiness.id}]`,
      token
    );

    // 3. dashboard.html (Panel de Clics del cliente en ruta raíz del repo)
    const standaloneDashHtml = this.generateStandaloneDashboardHtml(payloadBusiness, owner, mainRepo);
    await this.commitFile(
      targetOwner,
      targetRepo,
      "dashboard.html",
      standaloneDashHtml,
      `feat(dashboard): desplegar Panel de Clics del Cliente [${payloadBusiness.id}]`,
      token
    );

    // 4. dashboard/index.html (Ruta limpia /dashboard/ para compartir con clientes)
    const dashDirCommit = await this.commitFile(
      targetOwner,
      targetRepo,
      "dashboard/index.html",
      standaloneDashHtml,
      `feat(dashboard): desplegar ruta limpia /dashboard/ [${payloadBusiness.id}]`,
      token
    );

    // 5. Verificar / activar GitHub Pages
    await this.ensurePagesEnabled(targetOwner, targetRepo, token);

    return {
      owner: targetOwner,
      repo: targetRepo,
      repoUrl,
      pagesUrl,
      dashboardUrl,
      commitSha: dashDirCommit.commit ? dashDirCommit.commit.sha : "OK"
    };
  },

  /**
   * Fusiona datos remotos y locales de todos los negocios preservando enlaces de repos individuales
   */
  mergeBusinessesMaps(remoteMap, localMap, priorityId, priorityBusiness, defaultOwner) {
    const merged = {};
    const allIds = new Set([...Object.keys(remoteMap || {}), ...Object.keys(localMap || {})]);

    allIds.forEach(id => {
      const rem = remoteMap && remoteMap[id];
      const loc = localMap && localMap[id];
      let chosen = null;

      if (rem && loc) {
        const remDate = rem.fecha_actualizacion ? new Date(rem.fecha_actualizacion).getTime() : 0;
        const locDate = loc.fecha_actualizacion ? new Date(loc.fecha_actualizacion).getTime() : 0;
        const newer = locDate >= remDate ? loc : rem;
        const older = locDate >= remDate ? rem : loc;
        chosen = {
          ...older,
          ...newer,
          github_repo: newer.github_repo || older.github_repo || id,
          repo_url: newer.repo_url || older.repo_url || "",
          pages_url: newer.pages_url || older.pages_url || "",
          dashboard_url: newer.dashboard_url || older.dashboard_url || "",
          deploy_individual_repo: newer.deploy_individual_repo !== undefined ? newer.deploy_individual_repo : older.deploy_individual_repo
        };
      } else {
        chosen = rem || loc;
      }

      if (chosen) {
        merged[id] = this.normalizeBusinessEntry(chosen, id, defaultOwner);
      }
    });

    if (priorityId && priorityBusiness) {
      merged[priorityId] = this.normalizeBusinessEntry(priorityBusiness, priorityId, defaultOwner);
    }

    return merged;
  },

  /**
   * Genera la tabla Markdown para README.md del repositorio principal enlazando a todos los repos individuales
   */
  generateMainReadmeMarkdown(allBusinesses, owner, repo) {
    const mainBase = `https://${owner.toLowerCase()}.github.io/${repo}`;
    const rows = Object.keys(allBusinesses).map(id => {
      const b = this.normalizeBusinessEntry(allBusinesses[id], id, owner);
      const name = (b.nombre_negocio || id).replace(/\|/g, "\\|");
      const repoCell = b.repo_url ? `[${b.github_repo}](${b.repo_url})` : `\`${owner}/${repo}\``;
      const webLink = b.pages_url || `${mainBase}/p/?id=${encodeURIComponent(id)}`;
      const dashLink = b.dashboard_url || `${mainBase}/client/dashboard.html?id=${encodeURIComponent(id)}`;
      const editLink = `${mainBase}/admin/?id=${encodeURIComponent(id)}`;
      return `| **${name}** | \`${id}\` | ${repoCell} | [Abrir Linktree](${webLink}) | [Ver Dashboard](${dashLink}) | [Editar](${editLink}) |`;
    }).join("\n");

    return `# 🚀 Sistema de Linktrees Inteligentes NFC & Panel de Analíticas
### Desarrollado para **Alvap Company** • Arquitectura Multi-Repositorio

Plataforma central para crear, previsualizar, modificar y desplegar **Linktrees con repositorio individual propio** en GitHub Pages, incluyendo su **Dashboard de Clics por Botón** dentro de cada repositorio.

---

## 🌐 Portales Centrales

- **Portal Principal (Hub de Repos):** ${mainBase}/
- **Panel Administrativo (Editor y Preview):** ${mainBase}/admin/
- **Código del Repositorio Principal:** https://github.com/${owner}/${repo}

---

## 🗂️ Repositorios de Linktrees Enlazados

| Negocio | ID | Repositorio Propio | Linktree en Vivo | Dashboard de Clics | Admin |
| :--- | :--- | :--- | :--- | :--- | :--- |
${rows}

---

## ⚙️ ¿Qué incluye cada repositorio individual?

Cada repositorio creado o sincronizado desde el Panel Admin contiene:
- \`business.json\`: Configuración actualizada del negocio (tema, botones, enlaces y contraseña).
- \`index.html\`: Linktree público optimizado para tarjetas NFC y QR.
- \`dashboard.html\` y \`dashboard/index.html\`: Panel privado de métricas con desglose exacto de clics por botón.
`;
  },

  /**
   * Publica un negocio: despliega Linktree + Dashboard en su repositorio individual (si aplica),
   * actualiza data/businesses.json, negocios/{id}/index.html y README.md en el repositorio principal
   */
  async autoCommitBusiness(owner, repo, businessData, allBusinesses, token) {
    // 1. Asegurar repositorio principal
    await this.ensureRepository(owner, repo, token);

    const cleanTarget = { ...(businessData || {}) };
    delete cleanTarget.google_reviews;

    let individualResult = null;
    const requestedRepo = (cleanTarget.github_repo || cleanTarget.id || "").trim();
    const shouldDeployIndividual = requestedRepo && cleanTarget.deploy_individual_repo !== false && requestedRepo.toLowerCase() !== repo.toLowerCase();

    if (shouldDeployIndividual) {
      individualResult = await this.deployToLinkedRepo(owner, requestedRepo, cleanTarget, repo, token);
      cleanTarget.github_repo = individualResult.owner.toLowerCase() === owner.toLowerCase()
        ? individualResult.repo
        : `${individualResult.owner}/${individualResult.repo}`;
      cleanTarget.repo_url = individualResult.repoUrl;
      cleanTarget.pages_url = individualResult.pagesUrl;
      cleanTarget.dashboard_url = individualResult.dashboardUrl;
      cleanTarget.deploy_individual_repo = true;
    }

    // 2. Fusionar con data/businesses.json remoto para no perder enlaces de otros negocios
    const remoteMap = await this.fetchRemoteMainBusinesses(owner, repo, token);
    const mergedBusinesses = this.mergeBusinessesMaps(remoteMap, allBusinesses, cleanTarget.id, cleanTarget, owner);

    const jsonStr = JSON.stringify(mergedBusinesses, null, 2);
    await this.commitFile(
      owner,
      repo,
      "data/businesses.json",
      jsonStr,
      `feat(linktree): actualizar y enlazar negocio ID [${cleanTarget.id}]`,
      token
    );

    // 3. Commit a una página estática para acceso directo /negocios/{id}/index.html
    const staticHtml = this.generateStaticHtml(mergedBusinesses[cleanTarget.id]);
    const pageCommit = await this.commitFile(
      owner,
      repo,
      `negocios/${cleanTarget.id}/index.html`,
      staticHtml,
      `build(page): generar landing linktree para [${cleanTarget.id}]`,
      token
    );

    // 4. Actualizar README.md del repositorio principal con la tabla de repos enlazados
    const readmeContent = this.generateMainReadmeMarkdown(mergedBusinesses, owner, repo);
    await this.commitFile(
      owner,
      repo,
      "README.md",
      readmeContent,
      `docs(links): actualizar directorio de repositorios enlazados [${cleanTarget.id}]`,
      token
    );

    await this.ensurePagesEnabled(owner, repo, token);

    const liveUrl = `https://${owner.toLowerCase()}.github.io/${repo}/p/?id=${cleanTarget.id}`;
    const directUrl = `https://${owner.toLowerCase()}.github.io/${repo}/negocios/${cleanTarget.id}/`;

    return {
      success: true,
      commitSha: pageCommit.commit ? pageCommit.commit.sha : "OK",
      liveUrl: liveUrl,
      directUrl: directUrl,
      individualRepoUrl: individualResult ? individualResult.repoUrl : (cleanTarget.repo_url || null),
      individualPagesUrl: individualResult ? individualResult.pagesUrl : (cleanTarget.pages_url || null),
      individualDashboardUrl: individualResult ? individualResult.dashboardUrl : (cleanTarget.dashboard_url || null),
      businesses: mergedBusinesses
    };
  },

  /**
   * Crea o sincroniza todos los repositorios individuales + dashboards y el índice central
   */
  async deployAllBusinesses(owner, repo, allBusinesses, token, logCallback) {
    const log = (msg) => {
      if (typeof logCallback === "function") logCallback(msg);
    };

    await this.ensureRepository(owner, repo, token);
    const remoteMap = await this.fetchRemoteMainBusinesses(owner, repo, token);
    const merged = this.mergeBusinessesMaps(remoteMap, allBusinesses, null, null, owner);

    const results = {};
    const ids = Object.keys(merged);

    for (const id of ids) {
      const biz = merged[id];
      const requestedRepo = (biz.github_repo || id).trim();
      if (biz.deploy_individual_repo !== false && requestedRepo.toLowerCase() !== repo.toLowerCase()) {
        log(`🌐 Desplegando repo y dashboard de '${id}' -> ${owner}/${requestedRepo}...`);
        const dep = await this.deployToLinkedRepo(owner, requestedRepo, biz, repo, token);
        merged[id] = {
          ...biz,
          github_repo: dep.owner.toLowerCase() === owner.toLowerCase() ? dep.repo : `${dep.owner}/${dep.repo}`,
          deploy_individual_repo: true,
          repo_url: dep.repoUrl,
          pages_url: dep.pagesUrl,
          dashboard_url: dep.dashboardUrl
        };
        results[id] = dep;
        log(`✅ ${dep.pagesUrl} | 📊 ${dep.dashboardUrl}`);
      }

      const staticHtml = this.generateStaticHtml(merged[id]);
      await this.commitFile(
        owner,
        repo,
        `negocios/${id}/index.html`,
        staticHtml,
        `build(page): sincronizar landing linktree [${id}]`,
        token
      );
    }

    log(`📦 Actualizando directorio central data/businesses.json y README.md en ${owner}/${repo}...`);
    await this.commitFile(
      owner,
      repo,
      "data/businesses.json",
      JSON.stringify(merged, null, 2),
      "chore(sync): enlazar todos los repositorios individuales y dashboards",
      token
    );

    const readmeContent = this.generateMainReadmeMarkdown(merged, owner, repo);
    await this.commitFile(
      owner,
      repo,
      "README.md",
      readmeContent,
      "docs(links): actualizar tabla de repositorios individuales y dashboards",
      token
    );

    await this.ensurePagesEnabled(owner, repo, token);

    return {
      success: true,
      deployedCount: Object.keys(results).length,
      businesses: merged,
      results
    };
  },

  /**
   * Genera el index.html autónomo para la raíz del repositorio individual del cliente
   */
  generateStandaloneRepoHtml(b, mainOwner, mainRepo) {
    const coreBase = `https://${mainOwner.toLowerCase()}.github.io/${mainRepo}`;
    const safeJson = JSON.stringify(b).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(b.nombre_negocio)} | Enlaces Oficiales</title>
  <meta name="description" content="${escapeHtml(b.descripcion || b.nombre_negocio)}">
  <link rel="stylesheet" href="${coreBase}/p/viewer.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="${coreBase}/config.js"></script>
</head>
<body data-theme="${escapeHtml(b.tema || 'modern-dark')}">
  <div id="app" class="linktree-container">
    <div style="text-align: center; padding: 50px 20px;">
      <i class="fas fa-circle-notch fa-spin" style="font-size: 2rem; color: #6366f1;"></i>
      <p style="margin-top: 15px; opacity: 0.8; font-size: 0.95rem;">Cargando perfil inteligente...</p>
    </div>
  </div>
  <script>
    window.STANDALONE_REPO = true;
    window.INITIAL_BUSINESS = ${safeJson};
  </script>
  <script src="${coreBase}/p/viewer.js"></script>
</body>
</html>`;
  },

  /**
   * Genera el Dashboard de Clics autónomo para el repositorio individual del cliente (dashboard.html y dashboard/index.html)
   */
  generateStandaloneDashboardHtml(b, mainOwner, mainRepo) {
    const coreBase = `https://${mainOwner.toLowerCase()}.github.io/${mainRepo}`;
    const safeJson = JSON.stringify(b).replace(/</g, "\\u003c");
    const safeIdJson = JSON.stringify(b.id).replace(/</g, "\\u003c");
    const linktreeHref = escapeHtml(b.pages_url || "./");

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(b.nombre_negocio || b.id)} | Panel de Clics y Métricas</title>
  <link rel="stylesheet" href="${coreBase}/client/dashboard.css?v=8.0">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>

  <!-- Pantalla de Bloqueo por Contraseña para el Cliente -->
  <div id="clientLockScreen" style="display: none; position: fixed; inset: 0; background: rgba(7, 10, 18, 0.94); z-index: 99999; backdrop-filter: blur(14px); align-items: center; justify-content: center;">
    <div style="background: #111827; border: 1px solid #374151; padding: 36px 28px; border-radius: 20px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 25px 60px rgba(0,0,0,0.8);">
      <div style="width: 60px; height: 60px; border-radius: 16px; background: linear-gradient(135deg, #4f46e5, #6366f1); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 1.6rem; color: #fff;">
        <i class="fas fa-lock"></i>
      </div>
      <h2 id="lockBizName" style="font-size: 1.3rem; font-weight: 700; color: #fff; margin-bottom: 6px;">Panel Privado</h2>
      <p style="font-size: 0.85rem; color: #9ca3af; margin-bottom: 22px;">Ingresa la contraseña asignada a tu negocio para consultar métricas y clics por botón.</p>
      
      <form id="clientLoginForm" onsubmit="handleClientLogin(event)">
        <div style="margin-bottom: 14px;">
          <input type="password" id="clientSecretInput" placeholder="Contraseña de acceso" required style="width: 100%; box-sizing: border-box; padding: 12px 16px; font-size: 1rem; border-radius: 12px; background: #1f293d; color: #fff; border: 1px solid #4b5563; outline: none;" autofocus>
        </div>
        <div id="clientErrorMsg" style="display: none; color: #ef4444; font-size: 0.82rem; margin-bottom: 14px; font-weight: 600;">
          <i class="fas fa-exclamation-circle"></i> Contraseña incorrecta.
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 12px; font-size: 0.95rem; border-radius: 12px; background: #6366f1; color: #fff; border: none; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-unlock"></i> Acceder a mis Métricas
        </button>
      </form>
    </div>
  </div>

  <div class="dashboard-container">
    
    <!-- Header del Negocio -->
    <header class="dash-header">
      <div class="biz-profile">
        <img id="bizAvatar" class="biz-avatar" src="https://via.placeholder.com/150" alt="Logo">
        <div class="biz-info">
          <h1 id="bizTitle">${escapeHtml(b.nombre_negocio || "Cargando Negocio...")}</h1>
          <p id="bizCategory">${escapeHtml(b.categoria || "Portal de Métricas y Clics por Botón")}</p>
        </div>
      </div>

      <div class="dash-actions">
        <a id="btnViewProfile" href="${linktreeHref}" target="_blank" class="btn btn-secondary">
          <i class="fas fa-external-link-alt"></i> Ver Mi Linktree
        </a>
        <button id="btnLockDashboard" onclick="lockClientDashboard()" class="btn btn-secondary" style="display: none; color: #ef4444; border-color: #374151; padding: 10px 14px;" title="Cerrar sesión del panel">
          <i class="fas fa-lock"></i> Salir
        </button>
      </div>
    </header>

    <!-- KPI Grid de Métricas Clave -->
    <section class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-header">
          <span>Visitas Totales</span>
          <div class="kpi-icon" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">
            <i class="fas fa-eye"></i>
          </div>
        </div>
        <div id="kpiTotalViews" class="kpi-value">0</div>
        <div class="kpi-trend">
          <i class="fas fa-arrow-up"></i> +14.2% vs semana anterior
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span>Visitantes Únicos</span>
          <div class="kpi-icon" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">
            <i class="fas fa-users"></i>
          </div>
        </div>
        <div id="kpiUniqueVisitors" class="kpi-value">0</div>
        <div class="kpi-trend">
          <i class="fas fa-mobile-alt"></i> Personas distintas interesadas
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span>Clics en Botones</span>
          <div class="kpi-icon" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">
            <i class="fas fa-mouse-pointer"></i>
          </div>
        </div>
        <div id="kpiTotalClicks" class="kpi-value">0</div>
        <div class="kpi-trend" style="color: #34d399;">
          <i class="fas fa-check"></i> Clientes derivados a tus redes
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-header">
          <span>Tasa de Interacción (CTR)</span>
          <div class="kpi-icon" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">
            <i class="fas fa-bolt"></i>
          </div>
        </div>
        <div id="kpiCtr" class="kpi-value">0%</div>
        <div class="kpi-trend" style="color: #fbbf24;">
          <i class="fas fa-fire"></i> Alto interés por cliente
        </div>
      </div>
    </section>

    <!-- Gráficos de Analíticas -->
    <section class="charts-grid">
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title"><i class="fas fa-chart-area" style="color: #6366f1;"></i> Visitas vs Clics en el Tiempo</div>
          <span style="font-size: 0.78rem; color: #9ca3af;">Últimos 7 días</span>
        </div>
        <div class="chart-container">
          <canvas id="timelineChart"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title"><i class="fas fa-pie-chart" style="color: #10b981;"></i> Clics por Canal</div>
          <span style="font-size: 0.78rem; color: #9ca3af;">WhatsApp, Redes, GPS</span>
        </div>
        <div class="chart-container">
          <canvas id="buttonsChart"></canvas>
        </div>
      </div>
    </section>

    <!-- Sección 1: Desglose Detallado de Clics por Botón -->
    <section class="buttons-breakdown-section">
      <div class="breakdown-header">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-mouse-pointer" style="color: #10b981;"></i> 🎯 Desglose Detallado de Clics por Botón
          </h2>
          <p style="font-size: 0.85rem; color: #9ca3af; margin-top: 4px;">
            Conteo exacto de cuántos clics recibe cada enlace configurado en tu Linktree NFC.
          </p>
        </div>
        <div class="breakdown-summary-pills">
          <div class="summary-pill">
            <span class="pill-label">🏆 Más Clicado:</span>
            <strong id="topButtonBadge">--</strong>
          </div>
          <div class="summary-pill">
            <span class="pill-label">🔗 Botones Activos:</span>
            <strong id="activeButtonsCount">0</strong>
          </div>
          <div class="summary-pill">
            <span class="pill-label">📊 Total Clics:</span>
            <strong id="breakdownTotalClicks">0</strong>
          </div>
        </div>
      </div>

      <div id="buttonsBreakdownList" class="buttons-breakdown-grid"></div>
    </section>

  </div>

  <script>
    window.STANDALONE_REPO = true;
    window.STANDALONE_BUSINESS_ID = ${safeIdJson};
    window.INITIAL_BUSINESS = ${safeJson};
  </script>
  <script src="${coreBase}/config.js"></script>
  <script src="${coreBase}/client/dashboard.js?v=8.0"></script>
</body>
</html>`;
  },

  /**
   * Genera el HTML estático autónomo para cada negocio en su carpeta del repo principal
   */
  generateStaticHtml(b) {
    const safeJson = JSON.stringify(b).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(b.nombre_negocio)} | Enlaces Oficiales</title>
  <meta name="description" content="${escapeHtml(b.descripcion || b.nombre_negocio)}">
  <link rel="stylesheet" href="../../p/viewer.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="../../config.js"></script>
</head>
<body data-theme="${escapeHtml(b.tema || 'modern-dark')}">
  <div id="app" class="linktree-container"></div>
  <script>
    window.INITIAL_BUSINESS = ${safeJson};
  </script>
  <script src="../../p/viewer.js"></script>
</body>
</html>`;
  }
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = GitHubSync;
}
