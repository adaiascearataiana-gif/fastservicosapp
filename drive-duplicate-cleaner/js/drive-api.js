/* ============ Google Drive API v3 (REST via fetch) ============ */
const DriveAPI = (() => {
  const BASE = "https://www.googleapis.com/drive/v3";
  const FILE_FIELDS =
    "id,name,mimeType,size,md5Checksum,parents,createdTime,modifiedTime," +
    "thumbnailLink,trashed,driveId,webViewLink";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Requisição autenticada com retry/backoff para 429 e 5xx. */
  async function request(path, opts = {}, retry = 0) {
    const { method = "GET", query = {}, body = null, signal } = opts;
    const token = await Auth.getToken();

    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    }

    let res;
    try {
      res = await fetch(url, {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      if (retry < 3) {
        await sleep(800 * 2 ** retry);
        return request(path, opts, retry + 1);
      }
      throw e;
    }

    // Token expirado: renova uma vez e tenta de novo.
    if (res.status === 401 && retry === 0) {
      Auth.invalidate();
      return request(path, opts, retry + 1);
    }

    if (res.status === 429 || res.status >= 500) {
      if (retry < 4) {
        const wait = Math.min(8000, 700 * 2 ** retry) + Math.random() * 400;
        await sleep(wait);
        return request(path, opts, retry + 1);
      }
    }

    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).error?.message || ""; } catch (_) {}
      throw new Error(`Drive API ${res.status}${detail ? ` — ${detail}` : ""} em ${path}`);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  /** Lista TODAS as páginas de uma consulta. */
  async function listAll(query, { signal, onPage, fields = FILE_FIELDS } = {}) {
    const items = [];
    let pageToken;
    do {
      const data = await request("/files", {
        signal,
        query: {
          q: query,
          fields: `nextPageToken, files(${fields})`,
          pageSize: 1000,
          pageToken,
          orderBy: "name",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        },
      });
      items.push(...(data.files || []));
      pageToken = data.nextPageToken;
      if (onPage) onPage(items.length);
    } while (pageToken);
    return items;
  }

  /** Todas as pastas (para resolver caminhos e escopo por pasta). */
  async function listFolders({ signal, onPage } = {}) {
    return listAll(
      "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      { signal, onPage, fields: "id,name,parents,driveId" }
    );
  }

  /** Todas as imagens (não lixeira), incluindo drives compartilhados. */
  async function listImages({ signal, onPage } = {}) {
    return listAll(
      "mimeType contains 'image/' and trashed = false",
      { signal, onPage }
    );
  }

  /** Move para a lixeira (recuperável pelo Google Drive). */
  function trashFile(id, signal) {
    return request(`/files/${encodeURIComponent(id)}`, {
      method: "PATCH",
      signal,
      query: { supportsAllDrives: true },
      body: { trashed: true },
    });
  }

  /** Exclusão PERMANENTE (irreversível). */
  function deleteFile(id, signal) {
    return request(`/files/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal,
      query: { supportsAllDrives: true },
    });
  }

  /** Baixa a miniatura (com auth) e devolve uma object URL. */
  async function fetchThumbnailObjectUrl(file) {
    if (!file.thumbnailLink) return null;
    // Aumenta um pouco a qualidade da miniatura (padrão é s220).
    const link = file.thumbnailLink.replace(/=s\d+/, "=s400");
    const token = await Auth.getToken();
    const res = await fetch(link, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Miniatura ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  /** Pool de concorrência genérico. */
  async function pool(items, limit, worker, onItemDone) {
    let index = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const i = index++;
        try {
          await worker(items[i], i);
        } finally {
          if (onItemDone) onItemDone(i);
        }
      }
    });
    await Promise.all(runners);
  }

  return {
    listFolders,
    listImages,
    trashFile,
    deleteFile,
    fetchThumbnailObjectUrl,
    pool,
    sleep,
  };
})();
