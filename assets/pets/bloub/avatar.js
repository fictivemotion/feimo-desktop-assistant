'use strict';
(()=>{
 const {BotEngine,RAYON,NOTIF_BLUE,mixHex}=window.Bloub,svg=document.getElementById('avatar'),ink='#0a0a0c',paper='#f9f9f9',ns='http://www.w3.org/2000/svg';
 const node=(tag,attrs={},children=[])=>{const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))if(v!==undefined)el.setAttribute(k,String(v));el.append(...children);return el;};
 const engine=new BotEngine(RAYON,'idle'),player=new window.BloubScenes.ScenePlayer(performance.now()/1000);let last=0,pointer=null;const preview=new URLSearchParams(location.search).has('preview'),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 function render(frame){
  const mask=node('mask',{id:'eyes-mask',maskUnits:'userSpaceOnUse',x:-158,y:-158,width:316,height:316},[node('path',{d:frame.bodyPath,fill:'#fff'}),...frame.eyes.map(e=>node('path',{d:e.d,transform:e.matrix,opacity:e.alpha,fill:'#000'})),...(frame.notch?[node('circle',{...frame.notch,cx:frame.notch.x,cy:frame.notch.y,fill:'#000'})]:[])]);
  const defs=node('defs',{},[mask,...frame.arcs.map(a=>node('linearGradient',{id:'arc-'+a.id,gradientUnits:'userSpaceOnUse',x1:a.grad.x1,y1:a.grad.y1,x2:a.grad.x2,y2:a.grad.y2},a.grad.stops.map((c,i)=>node('stop',{offset:i/(a.grad.stops.length-1),'stop-color':c}))))]);
  const arcs=side=>node('g',{fill:'none','stroke-linecap':'round'},frame.arcs.map(a=>node('path',{d:a[side],stroke:'url(#arc-'+a.id+')','stroke-width':a.width,opacity:a.opacity})));
  const dots=()=>node('g',{},frame.dots.map(d=>node(d.d?'path':'circle',{fill:d.color??(d.depth===undefined?ink:mixHex(paper,ink,d.depth)),opacity:d.opacity,...(d.d?{d:d.d,transform:`translate(${d.x} ${d.y}) rotate(${d.rot??0}) scale(${RAYON})`}:{cx:d.x,cy:d.y,r:d.r})})));
  const body=node('g',{opacity:frame.bodyAlpha},[node('path',{d:frame.bodyPath,fill:paper}),node('g',{mask:'url(#eyes-mask)'},[node('rect',{x:-158,y:-158,width:316,height:316,fill:ink})])]);
  svg.replaceChildren(defs,arcs('back'),...(frame.dotsBehind?[dots()]:[]),body,...(!frame.dotsBehind?[dots()]:[]),...(frame.notif?[node('circle',{cx:frame.notif.x,cy:frame.notif.y,r:frame.notif.r,fill:NOTIF_BLUE})]:[]),arcs('front'));
 }
 function look(now){engine.setLook(window.BloubScenes.gazeFor(svg.dataset.animation||'idle',pointer),now,.18);svg.dataset.gaze='viewer';}
 function advance(now){const next=player.sample(now);svg.dataset.state=player.base;svg.dataset.scene=next.scene;svg.dataset.animation=next.state;if(next.changed){engine.setState(next.state,now);look(now);}if(!reduced||next.changed)render(engine.sample(reduced?now+window.Bloub.POSES[next.state]:now));}
 window.addEventListener('message',e=>{
  if(e.source!==parent||preview)return;const data=e.data,now=performance.now()/1000;
  if(data?.type==='feimo:orb-state')player.set(data.state,now);
  else if(data?.type==='feimo:orb-event')player.pulse(data.scene,now);
  else if(data?.type==='feimo:orb-look'){pointer=Number.isFinite(data.x)&&Number.isFinite(data.y)?{x:Math.max(-1,Math.min(1,data.x)),y:Math.max(-1,Math.min(1,data.y))}:null;look(now);}
  else return;advance(now);
 });
 // Settle the initial look before the first visible frame, avoiding a native rightward flash.
 svg.dataset.state='idle';svg.dataset.animation='idle';look(-1);render(engine.sample(1));
 if(!preview){player.pulse('startup',performance.now()/1000);advance(performance.now()/1000);}
 function tick(ms){if(ms-last>=1000/30){last=ms;advance(ms/1000);}requestAnimationFrame(tick);}
 if(!preview)requestAnimationFrame(tick);
})();
