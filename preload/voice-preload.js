'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('voiceApi',{
  ready:()=>ipcRenderer.send('voice:ready'),
  onCommand:cb=>ipcRenderer.on('voice:capture',(_e,value)=>cb(value)),
  onState:cb=>ipcRenderer.on('voice:changed',(_e,value)=>cb(value)),
  report:(id,type,message)=>ipcRenderer.send('voice:report',{id,type,message}),
  audio:(id,samples,level)=>ipcRenderer.send('voice:audio',{id,samples,level}),
  pause:()=>ipcRenderer.invoke('voice:pause'),finish:()=>ipcRenderer.invoke('voice:finish'),cancel:()=>ipcRenderer.invoke('voice:cancel'),
  dismiss:()=>ipcRenderer.send('voice:dismiss'),
});
