'use strict';
(()=>{
 const sprite=document.getElementById('top-sprite'),lamp=document.createElement('button');lamp.id='bedtime-lamp';lamp.type='button';lamp.hidden=true;lamp.setAttribute('aria-label','关灯，准备睡觉');lamp.title='关灯，准备睡觉';
 // Small code-native pendant, with no opaque tile or shadow around the control.
 lamp.innerHTML='<svg viewBox="0 0 64 80" aria-hidden="true"><path class="lamp-cord" d="M32 0v28"/><ellipse class="lamp-light" cx="32" cy="62" rx="26" ry="15"/><path class="lamp-shade" d="M24 28h16l14 25H10z"/><path class="lamp-bulb" d="M25 54a7 7 0 0 0 14 0"/><path class="lamp-rim" d="M10 53h44"/></svg>';
 document.body.append(lamp);let dwell,leaveTimer,offTimer,sceneTimer,lastPoint,within=false,busy=false;
 const allowed=()=>['sprite','capsule'].includes(document.body.dataset.topState)&&!document.hidden;
 const layout=()=>{if(lamp.hidden)return;const r=sprite.getBoundingClientRect(),w=Math.max(28,Math.min(58,r.width*.65));lamp.style.width=w+'px';lamp.style.height=Math.max(40,w*1.25)+'px';lamp.style.left=Math.min(innerWidth-w-6,r.right+4)+'px';lamp.style.top=Math.max(0,r.top)+'px';window.IslandCards?.place();window.IslandHit?.();};
 const hide=()=>{clearTimeout(dwell);clearTimeout(leaveTimer);if(busy)return;lamp.hidden=true;document.body.classList.remove('bedtime-lamp-visible');window.IslandCards?.place();window.IslandHit?.();};
 const arm=()=>{clearTimeout(dwell);if(busy||!allowed()||!lamp.hidden)return;dwell=setTimeout(()=>{if(!within||!allowed())return;lamp.hidden=false;lamp.classList.remove('lamp-off');document.body.classList.add('bedtime-lamp-visible');api.islandHover(true,'card');layout();},3000);};
 sprite.addEventListener('pointerenter',e=>{within=true;lastPoint=[e.screenX,e.screenY];clearTimeout(leaveTimer);arm();});
 sprite.addEventListener('pointermove',e=>{const p=[e.screenX,e.screenY];if(!lastPoint||p.some((n,i)=>n!==lastPoint[i])){lastPoint=p;arm();}});
 sprite.addEventListener('pointerleave',()=>{within=false;clearTimeout(dwell);leaveTimer=setTimeout(()=>{if(!lamp.matches(':hover'))hide();},400);});
 sprite.addEventListener('pointerdown',hide,true);
 lamp.addEventListener('pointerenter',()=>{clearTimeout(leaveTimer);api.islandHover(true,'card');});
 lamp.addEventListener('pointerleave',()=>{if(!within){hide();api.islandHover(false);api.islandLeave();}});
 lamp.onclick=async e=>{e.stopPropagation();if(busy)return;busy=true;lamp.disabled=true;lamp.classList.add('lamp-off');clearTimeout(offTimer);clearTimeout(sceneTimer);
  window.IslandBedtimeScene='sleepy';dispatchEvent(new Event('feimo:topActivity'));sceneTimer=setTimeout(()=>{window.IslandBedtimeScene=null;dispatchEvent(new Event('feimo:topActivity'));},4400);
  try{const result=await api.bedtimeNight();if(!result.brightnessChanged||result.brightnessPartial)await api.islandNotify('事已至此先睡觉吧，明天继续努力\n已设为1分钟熄屏；部分屏幕不支持自动调节亮度。');}
  catch(error){await api.islandNotify(error.message||'晚安设置未完成，请重试',true);}
  finally{offTimer=setTimeout(()=>{busy=false;lamp.disabled=false;hide();},1000);}
 };
 addEventListener('keydown',e=>{if(e.key==='Escape')hide();});addEventListener('resize',layout);
 api.onIslandPresentation?.(()=>{if(!allowed())hide();else layout();});api.onIslandResetHover?.(()=>{if(!busy)hide();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){within=false;hide();}});
 new ResizeObserver(layout).observe(sprite);
})();
