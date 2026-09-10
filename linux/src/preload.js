'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fastDesktop', Object.freeze({
  platform: process.platform,
  versions: Object.freeze({ electron: process.versions.electron, chrome: process.versions.chrome }),
  getConfig: () => ipcRenderer.invoke('fast:config:get'),
  getVault: () => ipcRenderer.invoke('fast:vault:get'),
  setVault: value => ipcRenderer.invoke('fast:vault:set', value),
  openExternal: url => ipcRenderer.invoke('fast:open-external', url),
  checkForUpdates: () => ipcRenderer.invoke('fast:update:check'),
  // r145: atualização com notificação + área ATUALIZAÇÕES + terminal ao vivo
  getAppInfo: () => ipcRenderer.invoke('fast:app:info'),
  onUpdateAvailable: callback => ipcRenderer.on('fast:update:available', (_e, version) => callback(version)),
  onGoToUpdateArea: callback => ipcRenderer.on('fast:update:go-to-area', () => callback()),
  openUpdateTerminal: () => ipcRenderer.invoke('fast:update:terminal'),
  onUpdateDownloaded: callback => ipcRenderer.on('fast:update:downloaded', () => callback())
}));
