'use strict';
(()=>{
 let current='hidden';
 function apply(surface){if(!['hidden','sprite','capsule','workbench'].includes(surface))return;current=surface;document.body.dataset.topState=surface;document.body.classList.toggle('capsule-hidden',surface==='hidden');document.getElementById('island').classList.toggle('idle-dot',surface==='hidden');if(surface==='hidden'||surface==='sprite')document.getElementById('quick-pills').hidden=true;for(const [selector,show]of [['.sprite-avatar iframe',surface==='sprite'],['.compact-avatar iframe',surface==='capsule'],['.brand-avatar iframe',surface==='workbench']])document.querySelectorAll(selector).forEach(f=>f.contentWindow?.postMessage({type:'feimo:orb-visibility',visible:show},'*'));window.IslandCards?.place();window.IslandHit?.();}
 window.IslandPresentation={apply,get:()=>current};
 api.onIslandPresentation(apply);
})();
