'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('capture',{
 init:()=>ipcRenderer.invoke('capture:init'),cancel:()=>ipcRenderer.invoke('capture:cancel'),commit:image=>ipcRenderer.invoke('capture:commit',image),save:image=>ipcRenderer.invoke('capture:save',image),select:()=>ipcRenderer.invoke('capture:select'),extract:data=>ipcRenderer.invoke('capture:extract',data),copyText:text=>ipcRenderer.invoke('capture:copyText',text),clips:()=>ipcRenderer.invoke('capture:clips'),copyClip:id=>ipcRenderer.invoke('capture:copyClip',id),focus:()=>ipcRenderer.invoke('capture:focus')
});
