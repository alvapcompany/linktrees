/**
 * GitHub API Sync Engine (100% Client-Side & Gratis)
 * Realiza commits automáticos a GitHub Pages para alvapcompany
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
          description: "Sistema de Linktrees Inteligentes para Negocios NFC - Alvap Company",
          private: false,
          auto_init: true
        })
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error("No se pudo crear el repositorio: " + (err.message || createRes.statusText));
      }

      const created = await createRes.json();

      // Breve espera para que GitHub inicialice la rama principal tras auto_init
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Habilitar GitHub Pages automáticamente
      try {
        await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
          method: "POST",
          headers: this.getHeaders(token),
          body: JSON.stringify({
            source: { branch: "main", path: "/" }
          })
        });
      } catch (e) {
        console.warn("Advertencia activando Pages:", e);
      }

      return created;
    }

    throw new Error(`Error consultando repositorio: HTTP ${checkRes.status}`);
  },

  /**
   * Normaliza un nombre de repositorio o formato "owner/repo"
   */
  parseRepoRef(repoInput, defaultOwner) {
    const clean = (repoInput || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
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
    const cleanB64 = (fileData.content || "").replace(/\s/g, "");
    const binStr = atob(cleanB64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    const decoded = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(decoded);
  },

  /**
   * Despliega un Linktree autónomo en su propio repositorio individual de GitHub
   */
  async deployToLinkedRepo(owner, clientRepoInput, businessData, mainRepo, token) {
    const { owner: targetOwner, repo: targetRepo } = this.parseRepoRef(clientRepoInput, owner);
    if (!targetRepo) throw new Error("Nombre de repositorio individual requerido.");

    await this.ensureRepository(targetOwner, targetRepo, token);

    const repoUrl = `https://github.com/${targetOwner}/${targetRepo}`;
    const pagesUrl = `https://${targetOwner.toLowerCase()}.github.io/${targetRepo}/`;

    const payloadBusiness = {
      ...businessData,
      github_repo: targetOwner.toLowerCase() === owner.toLowerCase() ? targetRepo : `${targetOwner}/${targetRepo}`,
      repo_url: repoUrl,
      pages_url: pagesUrl,
      fecha_actualizacion: businessData.fecha_actualizacion || new Date().toISOString()
    };

    await this.commitFile(
      targetOwner,
      targetRepo,
      "business.json",
      JSON.stringify(payloadBusiness, null, 2),
      `chore(sync): actualizar configuración de [${businessData.id}]`,
      token
    );

    const standaloneHtml = this.generateStandaloneRepoHtml(payloadBusiness, owner, mainRepo);
    const htmlCommit = await this.commitFile(
      targetOwner,
      targetRepo,
      "index.html",
      standaloneHtml,
      `build(site): desplegar Linktree autónomo [${businessData.id}]`,
      token
    );

    return {
      owner: targetOwner,
      repo: targetRepo,
      repoUrl,
      pagesUrl,
      commitSha: htmlCommit.commit ? htmlCommit.commit.sha : "OK"
    };
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
   * Hace un commit de un archivo al repositorio
   */
  async commitFile(owner, repo, path, contentString, message, token) {
    const sha = await this.getFileSha(owner, repo, path, token);
    
    // Codificación Base64 compatible con UTF-8
    const bytes = new TextEncoder().encode(contentString);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Content = btoa(binary);

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

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Error en commit de ${path}: ` + (err.message || res.statusText));
    }

    return await res.json();
  },

  /**
   * Publica un negocio: despliega en su repositorio individual (si aplica),
   * actualiza data/businesses.json en el repositorio principal y genera la página /negocios/{id}/index.html
   */
  async autoCommitBusiness(owner, repo, businessData, allBusinesses, token) {
    // 1. Asegurar repositorio principal
    await this.ensureRepository(owner, repo, token);

    let individualResult = null;
    const requestedRepo = (businessData.github_repo || businessData.id || "").trim();
    const shouldDeployIndividual = requestedRepo && businessData.deploy_individual_repo !== false && requestedRepo.toLowerCase() !== repo.toLowerCase();

    if (shouldDeployIndividual) {
      individualResult = await this.deployToLinkedRepo(owner, requestedRepo, businessData, repo, token);
      businessData.github_repo = requestedRepo;
      businessData.repo_url = individualResult.repoUrl;
      businessData.pages_url = individualResult.pagesUrl;
      businessData.deploy_individual_repo = true;
    }

    // 2. Commit a data/businesses.json en el repositorio principal (índice enlazado)
    allBusinesses[businessData.id] = businessData;
    const jsonStr = JSON.stringify(allBusinesses, null, 2);
    await this.commitFile(
      owner,
      repo,
      "data/businesses.json",
      jsonStr,
      `feat(linktree): actualizar y enlazar negocio ID [${businessData.id}]`,
      token
    );

    // 3. Commit a una página estática para acceso directo /negocios/{id}/index.html
    const staticHtml = this.generateStaticHtml(businessData);
    const pageCommit = await this.commitFile(
      owner,
      repo,
      `negocios/${businessData.id}/index.html`,
      staticHtml,
      `build(page): generar landing linktree para [${businessData.id}]`,
      token
    );

    // URL final en GitHub Pages
    const liveUrl = `https://${owner.toLowerCase()}.github.io/${repo}/p/?id=${businessData.id}`;
    const directUrl = `https://${owner.toLowerCase()}.github.io/${repo}/negocios/${businessData.id}/`;

    return {
      success: true,
      commitSha: pageCommit.commit ? pageCommit.commit.sha : "OK",
      liveUrl: liveUrl,
      directUrl: directUrl,
      individualRepoUrl: individualResult ? individualResult.repoUrl : (businessData.repo_url || null),
      individualPagesUrl: individualResult ? individualResult.pagesUrl : (businessData.pages_url || null)
    };
  },

  /**
   * Genera el index.html autónomo para la raíz del repositorio individual del cliente
   */
  generateStandaloneRepoHtml(b, mainOwner, mainRepo) {
    const coreBase = `https://${mainOwner.toLowerCase()}.github.io/${mainRepo}`;
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
    window.INITIAL_BUSINESS = ${JSON.stringify(b)};
  </script>
  <script src="${coreBase}/p/viewer.js"></script>
</body>
</html>`;
  },

  /**
   * Genera el HTML estático autónomo para cada negocio en su carpeta del repo principal
   */
  generateStaticHtml(b) {
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
    window.INITIAL_BUSINESS = ${JSON.stringify(b)};
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
