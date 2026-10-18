'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const source=(id,refresh=false)=>ipcRenderer.invoke('soundscape:source',id,refresh);
contextBridge.exposeInMainWorld('soundscapePlayer',{source,feedbackDone:id=>ipcRenderer.send('feedback:done',id),onFeedback:cb=>ipcRenderer.on('feedback:command',(_e,value)=>cb(value)),ready:()=>ipcRenderer.send('soundscape:ready'),onCommand:cb=>ipcRenderer.on('soundscape:player',(_e,value)=>cb(value)),report:value=>ipcRenderer.send('soundscape:report',value)});
