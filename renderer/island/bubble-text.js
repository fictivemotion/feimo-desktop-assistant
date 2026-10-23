'use strict';
(function(root,factory){const value=factory();if(typeof module==='object')module.exports=value;else root.FeimoBubbleText=value;})(typeof globalThis==='object'?globalThis:this,()=>{
 function metrics(size,fontSize){const px=Math.max(24,Math.min(180,Number(size)||90)),scale=Math.sqrt(px/90),font=Number.isFinite(fontSize)?Math.max(12,Math.min(28,fontSize)):Math.max(14,Math.min(20,Math.round(16*scale))),height=Number.isFinite(fontSize)?Math.max(Math.round(px*.82),Math.ceil(font*1.25)+4):Math.round(px*.82);return {height,font,actionFont:Math.max(12,font-2),maxWidth:Math.max(280,Math.round(340*scale)),minTextWidth:font*8};}
 class Scroller{
  constructor(reduced=()=>false){this.reduced=reduced;this.key='';this.animation=null;this.line=null;}
  stop(){this.animation?.cancel();this.animation=null;this.key='';if(this.line)this.line.style.transform='none';this.line=null;}
  update(viewport,line,{identity='',latest=false,visible=true}={}){
   if(!visible||!viewport||!line||viewport.clientWidth<=0){this.stop();return;}
   const overflow=Math.max(0,line.scrollWidth-viewport.clientWidth),reduced=this.reduced(),key=JSON.stringify([identity,line.textContent,Math.ceil(overflow),viewport.clientWidth,reduced,latest]);
   viewport.title=line.textContent;viewport.setAttribute('aria-label',line.textContent);viewport.tabIndex=overflow>1?0:-1;viewport.classList.toggle('manual-scroll',reduced&&overflow>1);
   if(key===this.key&&line===this.line)return;
   this.stop();this.key=key;this.line=line;viewport.scrollLeft=0;
   const start=latest?-overflow:0,end=latest?0:-overflow;line.style.transform=`translateX(${reduced?0:start}px)`;
   if(overflow<=1||reduced)return;
   const travel=Math.max(1400,overflow/36*1000),hold=1100,duration=2*(travel+hold),at=x=>`translateX(${x}px)`;
   this.animation=line.animate([{transform:at(start),offset:0},{transform:at(start),offset:hold/duration},{transform:at(end),offset:(hold+travel)/duration},{transform:at(end),offset:(2*hold+travel)/duration},{transform:at(start),offset:1}],{duration,iterations:Infinity,easing:'linear'});
  }
 }
 return {metrics,Scroller};
});
