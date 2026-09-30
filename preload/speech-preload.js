'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('speechApi', {
  onMessage: (cb) => ipcRenderer.on('speech:message', (_e, text) => cb(text)),
  onPlacement: (cb) => ipcRenderer.on('speech:placement', (_e, placement) => cb(placement)),
  onReply: (cb) => ipcRenderer.on('speech:reply', (_e, value) => cb(value)),
  onNotice: (cb) => ipcRenderer.on('speech:notice', (_e, value) => cb(value)),
  onCard: (cb) => ipcRenderer.on('speech:card', (_e, value) => cb(value)),
  cardClose: () => ipcRenderer.send('speech:cardClose'),
  cardOpen: (tab) => ipcRenderer.send('speech:cardOpen', tab),
  onDismiss: (cb) => ipcRenderer.on('speech:dismiss', () => cb()),
  layout: (value) => ipcRenderer.send('speech:layout', value),
  close: () => ipcRenderer.send('speech:close'),
  stop: () => ipcRenderer.send('speech:stop'),
  copy: () => ipcRenderer.invoke('speech:copy'),
});
