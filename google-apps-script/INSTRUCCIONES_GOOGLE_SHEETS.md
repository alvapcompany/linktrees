# 🚀 Configuración 100% Gratis del Backend (Google Sheets + Apps Script)

Esta base de datos es **100% gratuita para siempre**, no requiere tarjetas de crédito ni servidores.

---

### Paso 1: Crear la Hoja de Cálculo
1. Ve a [Google Sheets](https://sheets.new) y crea una nueva hoja en blanco.
2. Nómbrala por ejemplo: `Base de Datos Linktrees - Alvap Company`.

---

### Paso 2: Pegar el Código Backend
1. En el menú superior de la hoja, haz clic en **Extensiones** > **Apps Script**.
2. Borra cualquier código existente en el archivo `Código.gs`.
3. Copia todo el contenido del archivo `google-apps-script/Code.gs` y pégalo allí.
4. Presiona **Guardar** (ícono de disco o `Ctrl + S`).

---

### Paso 3: Publicar como Web App (API 100% Gratuita)
1. En la esquina superior derecha, haz clic en **Implementar** (Deploy) > **Nueva implementación**.
2. En el engranaje ⚙️ (Seleccionar tipo), elige **Aplicación web**.
3. Configura exactamente así:
   - **Descripción**: `API Linktree Alvap`
   - **Ejecutar como**: **Yo (tu cuenta de correo)**
   - **Quién tiene acceso**: **Cualquiera** (*Anyone* - fundamental para que las páginas guarden y registren métricas)
4. Haz clic en **Implementar**.
5. Google te pedirá "Autorizar acceso" la primera vez. Selecciona tu cuenta, haz clic en *Avanzado* y luego en *Ir a API Linktree Alvap (no seguro)* para conceder permisos.
6. **¡Listo!** Copia la **URL de la aplicación web** que termina en `/exec`.

---

### Paso 4: Conectar la URL en el Panel
Pega esa URL en el archivo de configuración `config.js` o directamente en la pestaña de **Ajustes** dentro del panel administrativo.
¡A partir de ahí, todo se guardará automáticamente en tiempo real!
