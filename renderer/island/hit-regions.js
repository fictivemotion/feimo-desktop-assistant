'use strict';
(()=>{
 const shell=document.getElementById('island'),panel=document.getElementById('expanded');
 let frame=null,until=0,fullUntil=0,signature='';
 const visible=n=>n&&n.getClientRects().length&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden';
 const box=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
 function publish(force=false){
  const now=performance.now(),hidden=document.body.classList.contains('capsule-hidden');
  const motion=now<until,full=now<fullUntil||!shell.classList.contains('collapsed');
  // SetWindowRgn clips pixels as well as input. Keep one region throughout a
  // morph, and let the rounded CSS shell clip its own animated contents.
  const sprite=document.getElementById('top-sprite'),spriteMode=document.body.dataset.topState==='sprite',rect=box(spriteMode?sprite:shell);
  if(motion&&!spriteMode){const width=full?panel.offsetWidth:Math.min(420,innerWidth-16),height=full?panel.offsetHeight:66;rect.x=(innerWidth-width)/2;rect.y=2;rect.width=width;rect.height=height;}
  const rects=[rect];
  if(!hidden&&!(motion&&full&&!spriteMode)){
   for(const n of document.querySelectorAll('#top-sprite,#compact-hide,#quick-pills:not([hidden]),#island-bubble:not([hidden]),#island-bubble-stack:not([hidden]) .stacked-bubble,#island-cards:not([hidden]) .island-pop-card:not([hidden]),dialog[open]'))if(visible(n))rects.push(box(n));
   for(const [id,gap]of [['quick-pills',20],['island-cards',8]]){const n=document.getElementById(id);if(visible(n)){const r=box(n);rects.unshift({x:r.x,y:r.y-gap,width:r.width,height:gap});}}
  }
  if(!hidden&&spriteMode){for(const id of ['island-bubble','island-cards']){const node=document.getElementById(id);if(visible(node)){const r=box(node);if(r.y<=rect.y+rect.height&&r.x>=rect.x+rect.width)rects.push({x:rect.x+rect.width,y:rect.y,width:r.x-rect.x-rect.width,height:rect.height});}}}
  const next=JSON.stringify(rects);if(force||next!==signature){signature=next;api.islandHit?.(rects);}
 }
 function tick(){frame=null;publish();if(performance.now()<until)frame=requestAnimationFrame(tick);}
 function schedule(){if(frame===null)frame=requestAnimationFrame(tick);}
 window.IslandHit=schedule;
 window.IslandSpriteMotion=()=>{until=performance.now()+400;schedule();};
 window.IslandMotion=()=>{fullUntil=until=performance.now()+500;schedule();};
 shell.addEventListener('transitionrun',e=>{if(e.target!==shell)return;until=Math.max(until,performance.now()+500);schedule();});
 document.addEventListener('animationstart',e=>{if(!e.target.closest?.('#quick-pills,#island-cards'))return;until=Math.max(until,performance.now()+300);schedule();});
 const resize=new ResizeObserver(schedule);resize.observe(shell);resize.observe(document.getElementById('top-sprite'));
 const changes=new MutationObserver(schedule);changes.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','style','open']});
 // Reconcile after reload/show and after quiet periods: no interaction should
 // depend on a single ResizeObserver callback having reached the main process.
 api.onIslandHitRefresh?.(()=>publish(true));
 document.addEventListener('visibilitychange',()=>publish(true));
 setInterval(()=>publish(true),1000);
 publish(true);
})();
