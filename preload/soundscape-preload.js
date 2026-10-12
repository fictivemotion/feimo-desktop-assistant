'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('soundscapePlayer',{onFeedback:cb=>ipcRenderer.on('feedback:command',(_e,value)=>cb(value)),ready:()=>ipcRenderer.send('soundscape:ready'),onCommand:cb=>ipcRenderer.on('soundscape:player',(_e,value)=>cb(value)),report:value=>ipcRenderer.send('soundscape:report',value)});
