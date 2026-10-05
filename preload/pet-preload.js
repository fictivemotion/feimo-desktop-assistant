'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  fileLibrary:()=>ipcRenderer.invoke('files:state'),fileCreate:data=>ipcRenderer.invoke('files:create',data),fileResolve:data=>ipcRenderer.invoke('files:resolve',data),fileImport:files=>ipcRenderer.invoke('files:import',files),fileSelect:()=>ipcRenderer.invoke('files:select'),fileOpen:id=>ipcRenderer.invoke('files:open',id),fileRoot:()=>ipcRenderer.invoke('files:root'),filePath:file=>webUtils.getPathForFile(file),
  onState: (cb) => ipcRenderer.on('pet:state', (_e, s) => cb(s)),
  onActivity: (cb) => ipcRenderer.on('pet:activity', (_e, value) => cb(value)),
  onConfig: (cb) => ipcRenderer.on('pet:config', (_e, c) => cb(c)),
  onSnapped: (cb) => ipcRenderer.on('pet:snapped', () => cb()),
  onDock: (cb) => ipcRenderer.on('pet:dock', (_e, state) => cb(state)),
  onPlay: (cb) => ipcRenderer.on('pet:play', () => cb()),
  getPets: () => ipcRenderer.invoke('pets:list'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  dragStart: () => ipcRenderer.send('pet:dragStart'),
  dragEnd: () => ipcRenderer.invoke('pet:dragEnd'),
  setPassthrough: (on) => ipcRenderer.send('pet:setPassthrough', on),
  openMenu: () => ipcRenderer.send('pet:openMenu'),
  clicked: () => ipcRenderer.send('pet:clicked'),
  hovered: () => ipcRenderer.send('pet:hover'),
  left: () => ipcRenderer.send('pet:leave'),
  openWorkbar: (tab) => ipcRenderer.invoke('workbar:show', tab),
});
