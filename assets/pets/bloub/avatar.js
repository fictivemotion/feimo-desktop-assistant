'use strict';
(()=>{
 const {BotEngine,RAYON,NOTIF_BLUE,mixHex}=window.Bloub,svg=document.getElementById('avatar'),ink='#0a0a0c',paper='#f9f9f9',ns='http://www.w3.org/2000/svg';
 const node=(tag,attrs={},children=[])=>{const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))if(v!==undefined)el.setAttribute(k,String(v));el.append(...children);return el;};
 const engine=new BotEngine(RAYON,'idle');let state='idle',idleAt=performance.now()/1000,last=0;const preview=new URLSearchParams(location.search).has('preview'),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
 function render(frame){
  const mask=node('mask',{id:'eyes-mask',maskUnits:'userSpaceOnUse',x:-158,y:-158,width:316,height:316},[node('path',{d:frame.bodyPath,fill:'#fff'}),...frame.eyes.map(e=>node('path',{d:e.d,transform:e.matrix,opacity:e.alpha,fill:'#000'})),...(frame.notch?[node('circle',{...frame.notch,cx:frame.notch.x,cy:frame.notch.y,fill:'#000'})]:[])]);
  const defs=node('defs',{},[mask,...frame.arcs.map(a=>node('linearGradient',{id:'arc-'+a.id,gradientUnits:'userSpaceOnUse',x1:a.grad.x1,y1:a.grad.y1,x2:a.grad.x2,y2:a.grad.y2},a.grad.stops.map((c,i)=>node('stop',{offset:i/(a.grad.stops.length-1),'stop-color':c}))))]);
  const arcs=side=>node('g',{fill:'none','stroke-linecap':'round'},frame.arcs.map(a=>node('path',{d:a[side],stroke:'url(#arc-'+a.id+')','stroke-width':a.width,opacity:a.opacity})));
  const dots=()=>node('g',{},frame.dots.map(d=>node(d.d?'path':'circle',{fill:d.color??(d.depth===undefined?ink:mixHex(paper,ink,d.depth)),opacity:d.opacity,...(d.d?{d:d.d,transform:`translate(${d.x} ${d.y}) rotate(${d.rot??0}) scale(${RAYON})`}:{cx:d.x,cy:d.y,r:d.r})})));
  const body=node('g',{opacity:frame.bodyAlpha},[node('path',{d:frame.bodyPath,fill:paper}),node('g',{mask:'url(#eyes-mask)'},[node('rect',{x:-158,y:-158,width:316,height:316,fill:ink})])]);
  svg.replaceChildren(defs,arcs('back'),...(frame.dotsBehind?[dots()]:[]),body,...(!frame.dotsBehind?[dots()]:[]),...(frame.notif?[node('circle',{cx:frame.notif.x,cy:frame.notif.y,r:frame.notif.r,fill:NOTIF_BLUE})]:[]),arcs('front'));
 }
 const states={idle:'idle',thinking:'thinking',processing:'thinking',listening:'wide',sleeping:'sleep',agentWorking:'orbit',attention:'notify',completed:'wink',failed:'alert',greeting:'wink','dragging-left':'comet','dragging-right':'comet'};
 function set(next){if(next===state)return;state=next;const now=performance.now()/1000;idleAt=now;engine.setState(states[next]||'idle',now);svg.dataset.state=next;if(reduced)render(engine.sample(now+1));}
 window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='feimo:orb-state'||preview)return;set(e.data.state);});
 render(engine.sample(1));svg.dataset.state='idle';
 function tick(ms){if(ms-last>=1000/30){last=ms;const now=ms/1000;if(state==='idle'&&now-idleAt>22)engine.setState((now-idleAt)%40<14?'sleep':'idle',now);render(engine.sample(now));}requestAnimationFrame(tick);}
 if(!preview&&!reduced)requestAnimationFrame(tick);
})();
