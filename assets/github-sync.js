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
   * Obtiene el SHA de un archivo existente si está en el repositorio
   */
  async getFileSha(owner, repo, path, token) {
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        headers: this.getHeaders(token)
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
   * Publica un negocio: actualiza data/businesses.json y genera la página HTML del ID
   */
  async autoCommitBusiness(owner, repo, businessData, allBusinesses, token) {
    // 1. Asegurar repositorio
    await this.ensureRepository(owner, repo, token);

    // 2. Commit a data/businesses.json
    allBusinesses[businessData.id] = businessData;
    const jsonStr = JSON.stringify(allBusinesses, null, 2);
    const jsonCommit = await this.commitFile(
      owner,
      repo,
      "data/businesses.json",
      jsonStr,
      `feat(linktree): actualizar negocio ID [${businessData.id}]`,
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
      directUrl: directUrl
    };
  },

  /**
   * Genera el HTML estático autónomo para cada negocio en su carpeta
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
