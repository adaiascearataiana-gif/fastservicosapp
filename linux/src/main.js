'use strict';

const { app, BrowserWindow, ipcMain, shell, session, protocol, net, safeStorage, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { execFileSync } = require('child_process');

protocol.registerSchemesAsPrivileged([{ scheme: 'fast', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let mainWindow;
const allowedPermissions = new Set(['media', 'geolocation', 'notifications', 'clipboard-sanitized-write']);

// ------------------------------------------------------------------
// r145: ATUALIZAÇÃO DO LINUX COM NOTIFICAÇÃO + ÁREA ATUALIZAÇÕES +
//      TERMINAL AO VIVO.
//  - 7s após abrir, o app consulta a versão mais recente publicada
//    nas Releases do GitHub (latest-linux.yml) — funciona tanto para
//    instalação AppImage quanto .deb.
//  - Se houver versão nova: sobe uma NOTIFICAÇÃO NATIVA do sistema.
//    Clicar na notificação traz a janela para a frente e abre a área
//    de ATUALIZAÇÕES (Configurações → Deploy & Auto-Atualização).
//  - O botão "ATUALIZAR PELO TERMINAL" abre um terminal de verdade
//    executando a atualização passo a passo, tudo visível ao vivo.
//  - Nada é baixado em silêncio: autoDownload desligado; quem baixa
//    e instala é o terminal, sob os olhos do usuário.
// ------------------------------------------------------------------
const REPO_OWNER = 'adaiascearataiana-gif';
const REPO_NAME = 'fastservicosapp';
const LATEST_YML_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/latest-linux.yml`;
const UPDATE_SCRIPT_NAME = 'fast-update-terminal.sh';

function configPath() { return path.join(app.getPath('userData'), 'config.json'); }
function vaultPath() { return path.join(app.getPath('userData'), 'vault.bin'); }
function readJson(file, fallback = {}) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function publicConfig() {
  const cfg = readJson(configPath());
  return {
    supabaseUrl: cfg.supabaseUrl || process.env.FAST_SUPABASE_URL || '',
    supabaseAnonKey: cfg.supabaseAnonKey || process.env.FAST_SUPABASE_ANON_KEY || '',
    googleClientId: cfg.googleClientId || process.env.FAST_GOOGLE_CLIENT_ID || '',
    updateChannel: cfg.updateChannel || 'latest'
  };
}

function writeVault(value) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Cofre seguro indisponível neste sistema.');
  fs.mkdirSync(path.dirname(vaultPath()), { recursive: true, mode: 0o700 });
  fs.writeFileSync(vaultPath(), safeStorage.encryptString(JSON.stringify(value || {})), { mode: 0o600 });
}
function readVault() {
  try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(vaultPath()))); } catch { return {}; }
}

// ---------- r145: helpers de atualização ----------

// Compara versões numéricas (2.3.27 > 2.3.19 etc.).
function isNewerVersion(remote, local) {
  try {
    const a = String(remote).split('.').map(Number);
    const b = String(local).split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
  } catch { return false; }
  return false;
}

// Ícone da notificação: copiado de dentro do asar para userData
// (terminal/notificador precisam de um arquivo real em disco).
function notificationIconPath() {
  try {
    const dest = path.join(app.getPath('userData'), 'fast-icon-512.png');
    if (!fs.existsSync(dest)) {
      const src = path.join(__dirname, 'renderer', 'assets', 'fast-servicos-icon-512.png');
      fs.writeFileSync(dest, fs.readFileSync(src));
    }
    return dest;
  } catch { return undefined; }
}

// Leva a janela para a frente e pede ao renderer que abra a área de
// ATUALIZAÇÕES (desktop-bridge.js replica o padrão do balão r118:
// proIr('configuracoes') + scrollIntoView em #fastDeployInfo).
function goToUpdatesArea() {
  if (!mainWindow) return;
  try {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('fast:update:go-to-area');
  } catch { /* janela indisponível */ }
}

// Notificação nativa de nova versão (r145).
let notifiedVersion = null;
function showUpdateNotification(version) {
  mainWindow?.webContents.send('fast:update:available', version);
  if (!Notification.isSupported()) return;
  try {
    const n = new Notification({
      title: 'FAST Serviços — nova versão disponível',
      body: `A versão ${version} chegou! Clique aqui para abrir a área de ATUALIZAÇÕES e atualizar pelo terminal.`,
      icon: notificationIconPath(),
      urgency: 'normal'
    });
    n.on('click', () => goToUpdatesArea());
    n.show();
  } catch { /* notificações indisponíveis: o toast do app cobre */ }
}

function maybeNotifyUpdate(version) {
  if (!version) return;
  if (notifiedVersion === version) return; // não repete a mesma versão na sessão
  if (!isNewerVersion(version, app.getVersion())) return;
  notifiedVersion = version;
  showUpdateNotification(version);
}

// Consulta universal: lê a versão do latest-linux.yml da release mais
// recente. Funciona para AppImage e .deb (o electron-updater só
// suporta AppImage; esta consulta cobre os dois).
async function checkLatestRelease() {
  try {
    const res = await net.fetch(LATEST_YML_URL);
    if (!res.ok) return null;
    const text = await res.text();
    const m = text.match(/^version:\s*([^\s'"]+)/m);
    return m ? m[1] : null;
  } catch { return null; }
}

// Abre um terminal visível executando o script de atualização.
// O script vive dentro do asar (não executável por fora), então é
// copiado para userData antes de chamar o emulador.
function openUpdateTerminal() {
  const scriptPath = path.join(app.getPath('userData'), UPDATE_SCRIPT_NAME);
  try {
    const src = path.join(__dirname, 'update-terminal.sh');
    fs.writeFileSync(scriptPath, fs.readFileSync(src));
    fs.chmodSync(scriptPath, 0o755);
  } catch (e) {
    return Promise.resolve({ ok: false, error: 'Não consegui preparar o script de atualização: ' + (e && e.message || e) });
  }
  const env = Object.assign({}, process.env, { FAST_CURRENT_VERSION: app.getVersion() });
  const terminals = [
    ['x-terminal-emulator', ['-e', 'bash', scriptPath]],
    ['gnome-terminal', ['--', 'bash', scriptPath]],
    ['konsole', ['-e', 'bash', scriptPath]],
    ['xfce4-terminal', ['-x', 'bash', scriptPath]],
    ['mate-terminal', ['-x', 'bash', scriptPath]],
    ['lxterminal', ['-e', 'bash', scriptPath]],
    ['tilix', ['-e', 'bash', scriptPath]],
    ['alacritty', ['-e', 'bash', scriptPath]],
    ['kitty', ['bash', scriptPath]],
    ['wezterm', ['start', '--', 'bash', scriptPath]],
    ['xterm', ['-T', 'FAST Serviços — Atualização', '-e', 'bash', scriptPath]]
  ];
  return new Promise(resolve => {
    let settled = false;
    const finish = result => { if (!settled) { settled = true; resolve(result); } };
    const tryNext = i => {
      if (settled) return;
      if (i >= terminals.length) {
        finish({ ok: false, error: 'Nenhum emulador de terminal encontrado. Instale o gnome-terminal, konsole, xfce4-terminal ou xterm e tente de novo.' });
        return;
      }
      const [cmd, args] = terminals[i];
      let onPath = false;
      try { onPath = !!execFileSync('which', [cmd], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { onPath = false; }
      if (!onPath) { tryNext(i + 1); return; }
      let child;
      try { child = spawn(cmd, args, { env, detached: true, stdio: 'ignore' }); }
      catch { tryNext(i + 1); return; }
      try { child.unref(); } catch { }
      child.once('error', () => tryNext(i + 1));
      // abriu sem erro: considera sucesso (gnome-terminal & cia. se
      // desanexam do processo pai imediatamente)
      setTimeout(() => finish({ ok: true, terminal: cmd }), 1200);
    };
    tryNext(0);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1024, minHeight: 680,
    backgroundColor: '#07111f', show: false, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: true, devTools: !app.isPackaged
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('fast://')) return;
    event.preventDefault();
    // r145: navegar para a URL oficial de deploy é o gesto de ATUALIZAR
    // pela web (fastExecutarAtualizacao → location.href). No desktop
    // Linux, isso abre o TERMINAL de atualização ao vivo em vez de
    // empurrar o usuário para o navegador externo.
    if (isDeployUpdateGesture(url)) { openUpdateTerminal(); return; }
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
  });
  mainWindow.loadURL('fast://app/index.html');
}

// Navegação para a raiz do site oficial (com ou sem query de cache-bust)
// = pedido de atualização vindo do renderer.
function isDeployUpdateGesture(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return u.origin === 'https://adaiascearataiana-gif.github.io' && u.pathname === '/fastservicosapp/';
  } catch { return false; }
}

app.whenReady().then(() => {
  protocol.handle('fast', request => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const root = path.join(__dirname, 'renderer');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep) && target !== root) return new Response('Bloqueado', { status: 403 });
    return net.fetch(`file://${target}`);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowedPermissions.has(permission));
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(allowedPermissions.has(permission)));
  createWindow();
  if (app.isPackaged) {
    setTimeout(async () => {
      // (r145) consulta universal: cobre AppImage e .deb.
      maybeNotifyUpdate(await checkLatestRelease());
      // (r145) electron-updater: mantém o caminho nativo do AppImage.
      try { await autoUpdater.checkForUpdates(); } catch { }
    }, 7000);
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('fast:config:get', () => publicConfig());
ipcMain.handle('fast:vault:get', () => readVault());
ipcMain.handle('fast:vault:set', (_e, value) => { writeVault(value || {}); return true; });
ipcMain.handle('fast:open-external', (_e, url) => { if (!/^https:\/\//i.test(url)) throw new Error('URL não permitida.'); return shell.openExternal(url); });
ipcMain.handle('fast:update:check', async () => app.isPackaged ? autoUpdater.checkForUpdates() : { development: true });
ipcMain.handle('fast:app:info', () => ({ version: app.getVersion(), packaged: app.isPackaged, platform: process.platform }));
ipcMain.handle('fast:update:terminal', () => openUpdateTerminal());

// (r145) nada baixa em silêncio — quem atualiza é o terminal, ao vivo.
autoUpdater.autoDownload = false;
autoUpdater.on('update-available', info => maybeNotifyUpdate(info && info.version));
autoUpdater.on('update-downloaded', () => mainWindow?.webContents.send('fast:update:downloaded'));
