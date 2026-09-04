'use strict';

const { app, BrowserWindow, ipcMain, shell, session, protocol, net, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

protocol.registerSchemesAsPrivileged([{ scheme: 'fast', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let mainWindow;
const allowedPermissions = new Set(['media', 'geolocation', 'notifications', 'clipboard-sanitized-write']);

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
  fs.writeFileSync(vaultPath(), safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600 });
}
function readVault() {
  try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(vaultPath()))); } catch { return {}; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1024, minHeight: 680,
    backgroundColor: '#07111f', show: false, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, webSecurity: true,
      spellcheck: true, devTools: !app.isPackaged
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('fast://')) { event.preventDefault(); if (/^https:\/\//i.test(url)) shell.openExternal(url); }
  });
  mainWindow.loadURL('fast://app/index.html');
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
  if (app.isPackaged) setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 7000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('fast:config:get', () => publicConfig());
ipcMain.handle('fast:vault:get', () => readVault());
ipcMain.handle('fast:vault:set', (_e, value) => { writeVault(value || {}); return true; });
ipcMain.handle('fast:open-external', (_e, url) => { if (!/^https:\/\//i.test(url)) throw new Error('URL não permitida.'); return shell.openExternal(url); });
ipcMain.handle('fast:update:check', async () => app.isPackaged ? autoUpdater.checkForUpdates() : { development: true });
autoUpdater.on('update-downloaded', () => mainWindow?.webContents.send('fast:update:downloaded'));

