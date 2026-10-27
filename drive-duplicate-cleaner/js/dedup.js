/* ============ Lógica de detecção de duplicatas ============ */
const Dedup = (() => {

  /* ---------- Utilitários ---------- */

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (_) { return iso; }
  }

  /** Constrói mapa id -> pasta e resolve o caminho completo de um arquivo. */
  function buildFolderIndex(folders) {
    const map = new Map();
    for (const f of folders) map.set(f.id, { name: f.name, parents: f.parents || [], driveId: f.driveId });
    return map;
  }

  function resolvePath(file, folderMap) {
    const parts = [];
    const seen = new Set();
    let currentId = file.parents && file.parents[0];
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const folder = folderMap.get(currentId);
      if (!folder) { parts.unshift("…(drive compartilhado)"); break; }
      parts.unshift(folder.name);
      currentId = folder.parents && folder.parents[0];
    }
    return parts.length ? `/${parts.join("/")}` : "/ (raiz)";
  }

  /** IDs de todas as pastas descendentes (inclui a raiz informada). */
  function descendantFolderIds(rootId, folders) {
    const children = new Map();
    for (const f of folders) {
      for (const p of f.parents || []) {
        if (!children.has(p)) children.set(p, []);
        children.get(p).push(f.id);
      }
    }
    const result = new Set([rootId]);
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop();
      for (const child of children.get(id) || []) {
        if (!result.has(child)) { result.add(child); stack.push(child); }
      }
    }
    return result;
  }

  function isInsideScope(file, allowedFolderIds, folderMap) {
    if (!allowedFolderIds) return true;
    let currentId = file.parents && file.parents[0];
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      if (allowedFolderIds.has(currentId)) return true;
      seen.add(currentId);
      const folder = folderMap.get(currentId);
      currentId = folder && folder.parents ? folder.parents[0] : null;
    }
    return false;
  }

  /* ---------- 1) Exatas por MD5 ---------- */

  function groupByMd5(files) {
    const buckets = new Map();
    for (const f of files) {
      if (!f.md5Checksum) continue;
      if (!buckets.has(f.md5Checksum)) buckets.set(f.md5Checksum, []);
      buckets.get(f.md5Checksum).push(f);
    }
    const groups = [];
    for (const [hash, items] of buckets) {
      if (items.length > 1) {
        groups.push({ reason: "md5", reasonLabel: "Conteúdo idêntico (MD5)", hash, files: items });
      }
    }
    return groups;
  }

  /* ---------- 2) Nome + tamanho iguais ---------- */

  function groupByNameSize(files, excludeIds) {
    const buckets = new Map();
    for (const f of files) {
      if (excludeIds.has(f.id)) continue;
      const key = `${f.name}__${f.size || 0}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(f);
    }
    const groups = [];
    for (const [, items] of buckets) {
      if (items.length > 1) {
        groups.push({ reason: "name-size", reasonLabel: "Mesmo nome e tamanho (provável)", files: items });
      }
    }
    return groups;
  }

  /* ---------- 3) Hash perceptivo (dHash 64 bits) ---------- */

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Falha ao decodificar imagem"));
      img.src = url;
    });
  }

  /** Difference hash: grade 9x8 em escala de cinza, 64 bits. */
  async function computeDHash(objectUrl) {
    const img = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 9, 8);
    const data = ctx.getImageData(0, 0, 9, 8).data;

    const gray = new Uint8Array(72);
    for (let i = 0; i < 72; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      gray[i] = (r * 299 + g * 587 + b * 114) / 1000;
    }

    let bits = 0n;
    let bitIndex = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (gray[row * 9 + col] > gray[row * 9 + col + 1]) {
          bits |= 1n << BigInt(bitIndex);
        }
        bitIndex++;
      }
    }
    return bits;
  }

  function hamming(a, b) {
    let x = a ^ b;
    let count = 0;
    while (x) { count += Number(x & 1n); x >>= 1n; }
    return count;
  }

  class UnionFind {
    constructor(n) { this.parent = Array.from({ length: n }, (_, i) => i); }
    find(x) {
      while (this.parent[x] !== x) {
        this.parent[x] = this.parent[this.parent[x]];
        x = this.parent[x];
      }
      return x;
    }
    union(a, b) {
      const ra = this.find(a), rb = this.find(b);
      if (ra !== rb) this.parent[rb] = ra;
    }
  }

  /**
   * Calcula dHash das imagens (usa miniaturas do Drive) e agrupa as
   * visualmente parecidas via União-Busca + distância de Hamming.
   */
  async function groupByVisual(files, threshold, { onProgress, signal, thumbnailCache }) {
    const hashes = new Array(files.length).fill(null);

    await DriveAPI.pool(
      files,
      6,
      async (file, i) => {
        if (signal && signal.aborted) return;
        try {
          let url = thumbnailCache.get(file.id);
          if (!url) {
            url = await DriveAPI.fetchThumbnailObjectUrl(file);
            if (url) thumbnailCache.set(file.id, url);
          }
          if (url) hashes[i] = await computeDHash(url);
        } catch (_) {
          hashes[i] = null; // sem miniatura: fica sem agrupar visualmente
        }
      },
      () => onProgress && onProgress()
    );

    if (signal && signal.aborted) throw new DOMException("Abortado", "AbortError");

    const uf = new UnionFind(files.length);
    const indexed = [];
    for (let i = 0; i < files.length; i++) if (hashes[i] !== null) indexed.push(i);

    let comparisons = 0;
    for (let a = 0; a < indexed.length; a++) {
      for (let b = a + 1; b < indexed.length; b++) {
        const i = indexed[a], j = indexed[b];
        if (hamming(hashes[i], hashes[j]) <= threshold) uf.union(i, j);
        if (++comparisons % 25000 === 0) await DriveAPI.sleep(0); // libera a UI
      }
    }

    const clusters = new Map();
    for (const i of indexed) {
      const root = uf.find(i);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(files[i]);
    }

    const groups = [];
    for (const items of clusters.values()) {
      if (items.length > 1) {
        groups.push({ reason: "visual", reasonLabel: "Imagens visualmente parecidas", files: items });
      }
    }
    return groups;
  }

  /* ---------- Escolha da cópia mantida ---------- */

  function chooseKeeper(files, rule) {
    let keeper = files[0];
    for (const f of files.slice(1)) {
      if (rule === "newest") {
        if (new Date(f.createdTime) > new Date(keeper.createdTime)) keeper = f;
      } else if (rule === "shortpath") {
        const fp = (f._path || "").length, kp = (keeper._path || "").length;
        if (fp < kp || (fp === kp && new Date(f.createdTime) < new Date(keeper.createdTime))) keeper = f;
      } else {
        // oldest (padrão)
        if (new Date(f.createdTime) < new Date(keeper.createdTime)) keeper = f;
      }
    }
    return keeper;
  }

  /** Enriquece os grupos: marca keeper, calcula espaço recuperável. */
  function finalizeGroups(groups, rule) {
    for (const g of groups) {
      const keeper = chooseKeeper(g.files, rule);
      for (const f of g.files) f.keep = (f.id === keeper.id);
      const size = Number(g.files[0].size) || 0;
      g.reclaimBytes = size * (g.files.length - 1);
      g.id = `${g.reason}-${g.files[0].id}`;
    }
    // Grupos maiores primeiro.
    groups.sort((a, b) => b.reclaimBytes - a.reclaimBytes);
    return groups;
  }

  /* ---------- Pipeline completo ---------- */

  /**
   * @param {Array} images      arquivos de imagem do Drive
   * @param {Array} folders     pastas do Drive
   * @param {Object} opts       {mode, folderId, keepRule, visualThreshold,
   *                             onProgress, signal, thumbnailCache}
   */
  async function run(images, folders, opts) {
    const {
      mode = "exact",
      folderId = null,
      keepRule = "oldest",
      visualThreshold = 8,
      onProgress = () => {},
      signal = null,
      thumbnailCache = new Map(),
    } = opts;

    const folderMap = buildFolderIndex(folders);
    const allowed = folderId ? descendantFolderIds(folderId, folders) : null;

    const scoped = images.filter((f) => isInsideScope(f, allowed, folderMap));
    for (const f of scoped) f._path = resolvePath(f, folderMap);

    const groups = groupByMd5(scoped);
    const groupedIds = new Set(groups.flatMap((g) => g.files.map((f) => f.id)));

    if (mode === "exact-plus") {
      groups.push(...groupByNameSize(scoped, groupedIds));
    } else if (mode === "visual") {
      const remaining = scoped.filter((f) => !groupedIds.has(f.id));
      onProgress({ phase: "visual", total: remaining.length, done: 0 });
      let done = 0;
      const visualGroups = await groupByVisual(remaining, Number(visualThreshold), {
        signal,
        thumbnailCache,
        onProgress: () => onProgress({ phase: "visual", total: remaining.length, done: ++done }),
      });
      groups.push(...visualGroups);
    }

    return {
      groups: finalizeGroups(groups, keepRule),
      totalScanned: scoped.length,
    };
  }

  return {
    run,
    formatBytes,
    formatDate,
    computeDHash,
    hamming,
  };
})();
