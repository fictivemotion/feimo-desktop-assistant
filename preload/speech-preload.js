'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('speechApi', {
  fileLibrary:()=>ipcRenderer.invoke('files:state'),fileCreate:data=>ipcRenderer.invoke('files:create',data),fileResolve:data=>ipcRenderer.invoke('files:resolve',data),fileImport:files=>ipcRenderer.invoke('files:import',files),fileSelect:()=>ipcRenderer.invoke('files:select'),fileOpen:id=>ipcRenderer.invoke('files:open',id),fileRoot:()=>ipcRenderer.invoke('files:root'),filePath:file=>webUtils.getPathForFile(file),
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
