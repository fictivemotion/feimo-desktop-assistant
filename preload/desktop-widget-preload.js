'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const listen=(channel,callback)=>{const handler=(_event,value)=>callback(value);ipcRenderer.on(channel,handler);return ()=>ipcRenderer.removeListener(channel,handler);};
contextBridge.exposeInMainWorld('widgetApi',{
 state:()=>ipcRenderer.invoke('widgets:state'),update:(id,patch)=>ipcRenderer.invoke('widgets:update',{id,patch}),call:(method,value)=>ipcRenderer.invoke('widgets:call',{method,value}),
 onChanged:callback=>listen('widgets:changed',callback),onDataChanged:callback=>listen('widgets:dataChanged',callback),onFilesChanged:callback=>listen('files:changed',callback),onNotesChanged:callback=>listen('toolbox:changed',callback),
 onCalendarChanged:callback=>listen('calendar:changed',callback),onCalendarPlannerProgress:callback=>listen('calendar:plannerProgress',callback),
});
