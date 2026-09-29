'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  onState: (cb) => ipcRenderer.on('pet:state', (_e, s) => cb(s)),
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
