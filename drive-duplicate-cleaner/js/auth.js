/* ============ Autenticação OAuth 2.0 (Google Identity Services) ============
 * Fluxo de token no navegador: o access token nunca sai do dispositivo
 * do usuário — todas as chamadas vão direto do navegador para a Google.
 */
const Auth = (() => {
  let tokenClient = null;
  let accessToken = null;
  let tokenPromise = null;
  let pendingReject = null;
  let currentClientId = null;
  let expireTimer = null;

  const STORAGE_KEY = "ld_client_id";

  function getClientId() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved || window.APP_CONFIG.GOOGLE_CLIENT_ID || "").trim();
  }

  function saveClientId(id) {
    localStorage.setItem(STORAGE_KEY, id.trim());
  }

  function loadGIS() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Não foi possível carregar o Google Identity Services. Verifique sua internet."));
      document.head.appendChild(s);
    });
  }

  async function ensureClient() {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error("Informe o Client ID OAuth antes de conectar.");
    }
    await loadGIS();
    if (!tokenClient || currentClientId !== clientId) {
      currentClientId = clientId;
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: window.APP_CONFIG.SCOPES,
        callback: () => {}, // substituído a cada requisição
        error_callback: (err) => {
          if (pendingReject) {
            tokenPromise = null;
            const reject = pendingReject;
            pendingReject = null;
            reject(new Error(err.message || err.type || "Erro no consentimento OAuth"));
          }
        },
      });
    }
  }

  /** Solicita um access token. interactive=true abre o consentimento. */
  async function requestToken(interactive = true) {
    if (accessToken) return accessToken;
    if (tokenPromise) return tokenPromise;

    await ensureClient();

    tokenPromise = new Promise((resolve, reject) => {
      pendingReject = reject;
      tokenClient.callback = (resp) => {
        tokenPromise = null;
        pendingReject = null;
        if (resp.error) {
          reject(new Error(resp.error_description || `Erro OAuth: ${resp.error}`));
          return;
        }
        accessToken = resp.access_token;
        // Renova 1 minuto antes de expirar.
        if (expireTimer) clearTimeout(expireTimer);
        const ms = Math.max(5000, (resp.expires_in - 60) * 1000);
        expireTimer = setTimeout(() => { accessToken = null; }, ms);
        resolve(accessToken);
      };

      try {
        tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "" });
      } catch (e) {
        tokenPromise = null;
        reject(e);
      }
    });

    return tokenPromise;
  }

  async function getToken() {
    if (accessToken) return accessToken;
    // Tenta renovação silenciosa; se falhar, pede consentimento.
    try {
      return await requestToken(false);
    } catch (e) {
      return requestToken(true);
    }
  }

  function invalidate() {
    accessToken = null;
  }

  function isConnected() {
    return !!accessToken;
  }

  /** Revoga o token e encerra a sessão local. */
  async function disconnect() {
    if (accessToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } catch (_) { /* ignora */ }
    }
    accessToken = null;
    if (expireTimer) clearTimeout(expireTimer);
  }

  return { getClientId, saveClientId, requestToken, getToken, invalidate, isConnected, disconnect };
})();
