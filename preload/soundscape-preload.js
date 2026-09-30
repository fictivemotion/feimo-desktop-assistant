'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('soundscapePlayer',{ready:()=>ipcRenderer.send('soundscape:ready'),onCommand:cb=>ipcRenderer.on('soundscape:player',(_e,value)=>cb(value)),report:value=>ipcRenderer.send('soundscape:report',value)});
