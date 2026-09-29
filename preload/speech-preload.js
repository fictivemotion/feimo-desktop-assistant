'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('speechApi', {
  onMessage: (cb) => ipcRenderer.on('speech:message', (_e, text) => cb(text)),
  onPlacement: (cb) => ipcRenderer.on('speech:placement', (_e, placement) => cb(placement)),
});
