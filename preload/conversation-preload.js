'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('conversationAudio',{
  ready:()=>ipcRenderer.send('conversation:ready'),
  onCommand:cb=>ipcRenderer.on('conversation:audioCommand',(_e,value)=>cb(value)),
  audio:(id,samples)=>ipcRenderer.send('conversation:audio',{id,samples}),
  report:value=>ipcRenderer.send('conversation:report',value),
});
