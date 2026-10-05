'use strict';
function alive(win){return !!win&&!win.isDestroyed()&&!win.webContents.isDestroyed();}
function safeBounds(raw,area,width,height){
  const x=Number.isFinite(raw?.x)?raw.x:area.x+area.width-width-24;
  const y=Number.isFinite(raw?.y)?raw.y:area.y+120;
  return {x:Math.round(Math.max(area.x+4,Math.min(x,area.x+area.width-width-4))),y:Math.round(Math.max(area.y+4,Math.min(y,area.y+area.height-height-4)))};
}
function watchWindow(win,{file,onReady=()=>{},onFailure=()=>{},quitting=()=>false}){
  let attempts=0,timer=null;
  const retry=()=>{if(quitting()||!alive(win)||timer||attempts>=3)return;timer=setTimeout(()=>{timer=null;if(alive(win)&&!quitting()){attempts++;void win.loadFile(file).catch(onFailure);}},500*2**attempts);};
  win.webContents.on('did-finish-load',()=>onReady(win));
  win.webContents.on('render-process-gone',(_e,details)=>{onFailure(new Error('renderer '+details.reason));retry();});
  win.webContents.on('did-fail-load',(_e,code)=>{if(code!==-3)retry();});
  win.on('unresponsive',retry);win.on('closed',()=>clearTimeout(timer));
}
module.exports={alive,safeBounds,watchWindow};
