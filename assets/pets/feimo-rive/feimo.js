'use strict';
(()=>{
 const canvas=document.getElementById('feimo'),reduced=matchMedia('(prefers-reduced-motion: reduce)'),controller=new FeimoScenes.Controller(undefined,undefined,{ambient:!reduced.matches});
 let binding,last=-1,pauseTimer;
 rive.RuntimeLoader.setWasmUrl(new URL('../../vendor/rive/rive.wasm',location.href).href);
 rive.RuntimeLoader.setWasmFallbackUrl(null);
 const player=new rive.Rive({src:'feimo.riv',canvas,artboard:'Feimo',stateMachines:'Feimo',autoplay:true,autoBind:true,layout:new rive.Layout({fit:rive.Fit.Contain,alignment:rive.Alignment.Center}),onLoad(){binding=player.viewModelInstance?.number('mode');if(!binding){document.body.dataset.error='missing-mode';return;}player.resizeDrawingSurfaceToCanvas();document.body.dataset.ready='true';apply();},onLoadError(){document.body.dataset.error='load';}});
 function apply(){const value=controller.value();if(!binding||value===last)return;binding.value=value;last=value;document.body.dataset.mode=FeimoScenes.modes[value];player.play('Feimo');clearTimeout(pauseTimer);if(reduced.matches)pauseTimer=setTimeout(()=>player.pause(),400);}
 addEventListener('message',event=>{if(event.source!==parent)return;const data=event.data;if(data?.type==='feimo:orb-state')controller.set(data.state);else if(data?.type==='feimo:orb-event')controller.event(data.scene);else return;apply();});
 const resize=new ResizeObserver(()=>player.resizeDrawingSurfaceToCanvas());resize.observe(canvas);
 const timer=setInterval(()=>{if(!document.hidden)apply();},120);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)player.pause();else {controller.rest();player.play('Feimo');last=-1;apply();}});
 reduced.addEventListener('change',()=>{controller.ambientEnabled=!reduced.matches;controller.rest();last=-1;apply();});
 addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(pauseTimer);resize.disconnect();player.cleanup();},{once:true});
})();
