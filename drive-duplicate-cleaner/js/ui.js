/* ============ Controlador da interface ============ */
(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    connected: false,
    scanning: false,
    abortController: null,
    groups: [],
    totalScanned: 0,
    thumbnailCache: new Map(), // fileId -> object URL
    doneIds: new Set(),
  };

  /* ---------- Log / toast / modal ---------- */

  function log(msg, level = "info") {
    const area = $("logArea");
    const time = new Date().toLocaleTimeString("pt-BR");
    const icon = level === "error" ? "✖" : level === "ok" ? "✔" : "•";
    area.textContent += `[${time}] ${icon} ${msg}\n`;
    area.scrollTop = area.scrollHeight;
  }

  function toast(msg, type = "") {
    const t = $("toast");
    t.textContent = msg;
    t.className = `toast ${type ? `toast-${type}` : ""}`;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.hidden = true; }, 3800);
  }

  function showModal(title, bodyHtml) {
    return new Promise((resolve) => {
      $("modalTitle").textContent = title;
      $("modalBody").innerHTML = bodyHtml;
      $("modal").hidden = false;
      const cleanup = (result) => {
        $("modal").hidden = true;
        $("modalConfirm").onclick = null;
        $("modalCancel").onclick = null;
        resolve(result);
      };
      $("modalConfirm").onclick = () => cleanup(true);
      $("modalCancel").onclick = () => cleanup(false);
    });
  }

  function setMsg(id, text, cls = "") {
    const el = $(id);
    el.textContent = text || "";
    el.className = `msg ${cls}`;
  }

  /* ---------- Estado visual ---------- */

  function refreshSections() {
    $("cardVarredura").toggleAttribute("disabled-section", !state.connected);
    $("cardResultados").toggleAttribute("disabled-section", !state.connected);
    const badge = $("connectionBadge");
    badge.className = `badge ${state.connected ? "badge-on" : "badge-off"}`;
    $("connectionText").textContent = state.connected ? "Conectado ao Google Drive" : "Desconectado";
    $("btnConnect").hidden = state.connected;
    $("btnDisconnect").hidden = !state.connected;
  }

  function setProgress(pct, text) {
    $("progressWrap").hidden = false;
    $("progressFill").style.width = `${Math.min(100, Math.round(pct))}%`;
    $("progressPct").textContent = `${Math.round(pct)}%`;
    if (text) $("progressText").textContent = text;
  }

  function updateStats() {
    const filesToRemove = state.groups.reduce((n, g) => n + g.files.filter((f) => !f.keep).length, 0);
    const waste = state.groups.reduce((s, g) => {
      const removing = g.files.filter((f) => !f.keep).length;
      return s + (Number(g.files[0].size) || 0) * removing;
    }, 0);
    $("statScanned").textContent = state.totalScanned.toLocaleString("pt-BR");
    $("statGroups").textContent = state.groups.length.toLocaleString("pt-BR");
    $("statWaste").textContent = Dedup.formatBytes(waste);

    $("summaryBox").innerHTML = state.groups.length
      ? `Encontrados <strong>${state.groups.length} grupo(s)</strong> de duplicatas em ` +
        `<strong>${state.totalScanned.toLocaleString("pt-BR")}</strong> imagens. ` +
        `Serão removidas <strong>${filesToRemove}</strong> cópia(s), mantendo exatamente 1 por grupo. ` +
        `Espaço que volta a ficar disponível: <strong>${Dedup.formatBytes(waste)}</strong>. ` +
        `Você pode mudar qual arquivo manter em cada grupo antes de confirmar.`
      : "";

    $("btnTrash").innerHTML = `🗑️ Mover ${filesToRemove} arquivo(s) para a lixeira <span class="btn-hint">(recuperável)</span>`;
    $("btnDelete").textContent = `⚠️ Excluir ${filesToRemove} arquivo(s) permanentemente`;
    return { filesToRemove, waste };
  }

  /* ---------- Conexão ---------- */

  $("btnSaveClient").addEventListener("click", () => {
    const id = $("clientIdInput").value.trim();
    if (!id.endsWith(".apps.googleusercontent.com")) {
      setMsg("authMsg", "O Client ID não parece válido (deve terminar em .apps.googleusercontent.com).", "error");
      return;
    }
    Auth.saveClientId(id);
    setMsg("authMsg", "Client ID salvo neste navegador. Agora clique em “Conectar com o Google”.", "ok");
    log("Client ID OAuth salvo localmente.");
  });

  $("btnConnect").addEventListener("click", async () => {
    setMsg("authMsg", "");
    try {
      await Auth.requestToken(true);
      state.connected = true;
      refreshSections();
      setMsg("authMsg", "Conectado! Você já pode iniciar a varredura.", "ok");
      toast("Conectado ao Google Drive ✅", "ok");
      log("Sessão OAuth estabelecida com sucesso.");
    } catch (e) {
      setMsg("authMsg", `Falha na conexão: ${e.message}`, "error");
      log(`Falha na conexão: ${e.message}`, "error");
    }
  });

  $("btnDisconnect").addEventListener("click", async () => {
    await Auth.disconnect();
    state.connected = false;
    refreshSections();
    setMsg("authMsg", "Sessão encerrada.", "info");
    log("Sessão encerrada (token revogado).");
  });

  /* ---------- Opções da UI ---------- */

  document.querySelectorAll('input[name="escopo"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      $("folderInput").hidden = document.querySelector('input[name="escopo"]:checked').value !== "folder";
    });
  });

  document.querySelectorAll('input[name="modo"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      $("thresholdRow").hidden = document.querySelector('input[name="modo"]:checked').value !== "visual";
    });
  });

  function extractFolderId(raw) {
    const v = (raw || "").trim();
    if (!v) return null;
    const m = v.match(/[\/?]folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{10,}$/.test(v)) return v; // ID colado direto
    return null;
  }

  /* ---------- Varredura ---------- */

  $("btnScan").addEventListener("click", startScan);
  $("btnStop").addEventListener("click", () => {
    if (state.abortController) state.abortController.abort();
    log("Parada solicitada pelo usuário…", "error");
  });

  async function startScan() {
    if (!state.connected) return;

    const mode = document.querySelector('input[name="modo"]:checked').value;
    const scope = document.querySelector('input[name="escopo"]:checked').value;
    const folderId = scope === "folder" ? extractFolderId($("folderInput").value) : null;

    if (scope === "folder" && !folderId) {
      setMsg("scanMsg", "Cole o link ou ID válido da pasta.", "error");
      return;
    }

    state.scanning = true;
    state.abortController = new AbortController();
    state.groups = [];
    state.doneIds = new Set();
    $("btnScan").disabled = true;
    $("btnStop").hidden = false;
    $("cardResultados").hidden = true;
    $("groupsContainer").innerHTML = "";
    setMsg("scanMsg", "");
    log(`Varredura iniciada (modo: ${mode}, escopo: ${folderId || "todo o Drive"}).`);

    try {
      setProgress(2, "Listando pastas do Drive…");
      const folders = await DriveAPI.listFolders({
        signal: state.abortController.signal,
        onPage: (n) => setProgress(4, `Listando pastas… ${n.toLocaleString("pt-BR")}`),
      });
      log(`${folders.length.toLocaleString("pt-BR")} pastas indexadas.`);

      setProgress(8, "Listando imagens…");
      const images = await DriveAPI.listImages({
        signal: state.abortController.signal,
        onPage: (n) => setProgress(10 + Math.min(55, n / 50), `Listando imagens… ${n.toLocaleString("pt-BR")} arquivos`),
      });
      log(`${images.length.toLocaleString("pt-BR")} imagens encontradas no Drive.`);

      setProgress(60, "Analisando duplicatas…");
      const { groups, totalScanned } = await Dedup.run(images, folders, {
        mode,
        folderId,
        keepRule: $("keepRule").value,
        visualThreshold: $("thresholdSelect").value,
        signal: state.abortController.signal,
        thumbnailCache: state.thumbnailCache,
        onProgress: (p) => {
          if (p.phase === "visual") {
            const pct = 60 + (p.done / Math.max(1, p.total)) * 38;
            setProgress(pct, `Comparando visualmente ${p.done}/${p.total} imagens…`);
          }
        },
      });

      state.groups = groups;
      state.totalScanned = totalScanned;
      setProgress(100, "Concluído");
      log(`Varredura concluída: ${groups.length} grupo(s) duplicado(s) em ${totalScanned} imagem(ns).`, "ok");
      renderResults();
    } catch (e) {
      if (e.name === "AbortError") {
        setMsg("scanMsg", "Varredura interrompida.", "info");
        log("Varredura interrompida.", "error");
      } else {
        setMsg("scanMsg", `Erro na varredura: ${e.message}`, "error");
        log(`Erro na varredura: ${e.message}`, "error");
        toast(e.message, "error");
      }
    } finally {
      state.scanning = false;
      state.abortController = null;
      $("btnScan").disabled = false;
      $("btnStop").hidden = true;
    }
  }

  /* ---------- Renderização dos resultados ---------- */

  function reasonBadge(reason) {
    if (reason === "md5") return '<span class="tag tag-green">idêntica</span>';
    if (reason === "name-size") return '<span class="tag tag-amber">provável</span>';
    return '<span class="tag tag-blue">visual</span>';
  }

  function renderResults() {
    $("cardResultados").hidden = false;
    const container = $("groupsContainer");
    container.innerHTML = "";
    $("emptyState").hidden = state.groups.length > 0;
    updateStats();

    for (const group of state.groups) {
      const card = document.createElement("div");
      card.className = "group-card";

      const head = document.createElement("div");
      head.className = "group-head";
      head.innerHTML =
        `${reasonBadge(group.reason)}
         <span class="reason">${group.reasonLabel}</span>
         <span class="spacer"></span>
         <span>${group.files.length} cópias • recupera <strong>${Dedup.formatBytes(group.reclaimBytes)}</strong></span>`;
      card.appendChild(head);

      for (const f of group.files) {
        const row = document.createElement("div");
        row.className = `file-row ${f.keep ? "is-keep" : "to-remove"}`;
        row.dataset.fileId = f.id;
        row.innerHTML = `
          <div class="thumb-placeholder">🖼️</div>
          <div class="file-info">
            <div class="file-name"></div>
            <div class="file-path"></div>
            <div class="file-meta">
              ${Dedup.formatBytes(Number(f.size))} • criado em ${Dedup.formatDate(f.createdTime)}
              • modificado em ${Dedup.formatDate(f.modifiedTime)}
              ${f.md5Checksum ? `• md5: <code>${f.md5Checksum.slice(0, 12)}…</code>` : ""}
            </div>
          </div>
          <div class="keep-ctrl">
            <label><input type="radio" name="keep-${group.id}" ${f.keep ? "checked" : ""} /> manter</label>
          </div>
          <div class="row-status" hidden></div>`;
        row.querySelector(".file-name").textContent = f.name;
        row.querySelector(".file-path").textContent = f._path || "/";
        row.querySelector("input").addEventListener("change", () => {
          for (const x of group.files) x.keep = x.id === f.id;
          renderResults();
        });
        card.appendChild(row);
      }
      container.appendChild(card);
    }

    lazyLoadThumbnails();
  }

  /** Carrega miniaturas só dos cartões visíveis, respeitando o cache. */
  function lazyLoadThumbnails() {
    const rows = document.querySelectorAll(".file-row");
    if (!("IntersectionObserver" in window)) {
      rows.forEach((r) => loadThumb(r));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadThumb(entry.target);
          io.unobserve(entry.target);
        }
      }
    }, { rootMargin: "200px" });
    rows.forEach((r) => io.observe(r));
  }

  async function loadThumb(row) {
    const fileId = row.dataset.fileId;
    const file = state.groups.flatMap((g) => g.files).find((f) => f.id === fileId);
    if (!file) return;
    try {
      let url = state.thumbnailCache.get(fileId);
      if (!url) {
        url = await DriveAPI.fetchThumbnailObjectUrl(file);
        if (url) state.thumbnailCache.set(fileId, url);
      }
      if (url) {
        const img = document.createElement("img");
        img.className = "thumb";
        img.alt = file.name;
        img.src = url;
        row.replaceChild(img, row.querySelector(".thumb-placeholder"));
      }
    } catch (_) { /* mantém o placeholder */ }
  }

  /* ---------- Ações: lixeira / exclusão permanente ---------- */

  function collectTargets() {
    const targets = [];
    for (const g of state.groups) {
      for (const f of g.files) {
        if (!f.keep && !state.doneIds.has(f.id)) targets.push({ group: g, file: f });
      }
    }
    return targets;
  }

  $("btnTrash").addEventListener("click", () => runAction("trash"));
  $("btnDelete").addEventListener("click", () => runAction("delete"));

  async function runAction(action) {
    const targets = collectTargets();
    if (!targets.length) {
      toast("Nada a remover — todos os grupos já estão tratados.");
      return;
    }

    if (action === "delete") {
      const ok = await showModal(
        "Exclusão PERMANENTE",
        `Isso vai apagar <strong>${targets.length}</strong> arquivo(s) de forma <strong>irreversível</strong> ` +
        `(não vão para a lixeira e não poderão ser restaurados).<br><br>` +
        `Recomendado: use a lixeira, que permite restauração. Confirma a exclusão permanente mesmo assim?`
      );
      if (!ok) return;
    }

    const actionFn = action === "trash" ? DriveAPI.trashFile : DriveAPI.deleteFile;
    const label = action === "trash" ? "lixeira" : "exclusão permanente";
    let okCount = 0, failCount = 0;
    const failures = [];

    $("btnTrash").disabled = true;
    $("btnDelete").disabled = true;
    setProgress(0, `Enviando para ${label}…`);
    log(`Iniciando ação: ${label} de ${targets.length} arquivo(s).`);

    // Erros são capturados por item para que o pool tente todos os arquivos.
    await DriveAPI.pool(
      targets,
      window.APP_CONFIG.DELETE_CONCURRENCY,
      async ({ file }) => {
        try {
          await actionFn(file.id);
          state.doneIds.add(file.id);
          okCount++;
          markRow(file.id, action === "trash" ? "Na lixeira" : "Excluído", action === "trash" ? "done-trash" : "done-delete");
        } catch (e) {
          failCount++;
          failures.push({ file, error: e });
          markRow(file.id, "falhou", "failed");
          log(`Falha em "${file.name}": ${e.message}`, "error");
        }
      },
      (i) => {
        const done = i + 1;
        setProgress((done / targets.length) * 100, `Processando ${done}/${targets.length}…`);
      }
    );

    $("btnTrash").disabled = false;
    $("btnDelete").disabled = false;
    updateStats();
    log(`Ação concluída: ${okCount} sucesso, ${failCount} falha(s).`, failCount ? "error" : "ok");

    if (action === "trash") {
      toast(`${okCount} arquivo(s) movido(s) para a lixeira. Restaure no Drive se precisar.`, "ok");
    } else {
      toast(`${okCount} arquivo(s) excluído(s) permanentemente.`, failCount ? "error" : "ok");
    }
  }

  /** Marca visualmente a linha do arquivo após uma ação. */
  function markRow(fileId, text, cls) {
    const row = document.querySelector(`.file-row[data-file-id="${fileId}"]`);
    if (!row) return;
    row.classList.add("row-done");
    const status = row.querySelector(".row-status");
    status.hidden = false;
    status.textContent = text;
    status.className = `row-status ${cls}`;
  }

  /* ---------- Exportar CSV ---------- */

  $("btnExport").addEventListener("click", () => {
    if (!state.groups.length) { toast("Nenhum resultado para exportar."); return; }
    const header = "grupo;motivo;acao;arquivo;caminho;tamanho_bytes;criado_em;modificado_em;file_id;link";
    const lines = [header];
    state.groups.forEach((g, gi) => {
      for (const f of g.files) {
        const acao = f.keep ? "manter" : (state.doneIds.has(f.id) ? "removido" : "remover");
        lines.push([
          gi + 1,
          g.reasonLabel,
          acao,
          `"${(f.name || "").replaceAll('"', '""')}"`,
          `"${(f._path || "").replaceAll('"', '""')}"`,
          f.size || 0,
          f.createdTime || "",
          f.modifiedTime || "",
          f.id,
          f.webViewLink || "",
        ].join(";"));
      }
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-duplicatas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    log("Relatório CSV exportado.");
  });

  /* ---------- Init ---------- */

  const savedId = Auth.getClientId();
  if (savedId) $("clientIdInput").value = savedId;
  refreshSections();
  log("App pronto. Conecte sua conta Google para começar.");
})();
