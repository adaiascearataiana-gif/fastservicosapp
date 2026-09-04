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
  onUpdateDownloaded: callback => ipcRenderer.on('fast:update:downloaded', () => callback())
}));

