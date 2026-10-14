'use strict';
// Project a shared yaw into native Rive keyframes. Head, ear pads, headband and
// orbiting notes share one angle; front/back layers provide real occlusion.
module.exports=function({id,tag,group,rect,ellipse,line,ink,gold}){
 const defaults={},parts=[],front=[],back=[];
 const vertex=(name,x,y)=>{defaults[name]={x,y};return tag('StraightVertex',{id:id(name),name,x,y});};
 function segment(name,color,width){defaults[name]={opacity:0};return tag('Shape',{id:id(name),name},tag('PointsPath',{},vertex(name+'a',0,0)+vertex(name+'b',0,0))+tag('Stroke',{thickness:width,cap:'round',join:'round'},tag('SolidColor',{colorValue:color})));}
 for(const layer of ['front','back']){
  const list=layer==='front'?front:back;
  for(let note=0;note<2;note++){
   const name=`orbit-${layer}-${note}`,color=note?'FFAAA0EE':gold;
   defaults[name]={x:0,y:0,scaleX:1,scaleY:1,rotation:0,opacity:0};
   list.push(group(name,0,0,ellipse(name+'dot',0,0,13,9,color,{rotation:-.3})+line(name+'stem',[[5,-2],[5,-26],[16,-21]],color,4)));
   parts.push({name,layer,note,type:'note'});
   for(let tail=0;tail<10;tail++)for(const glow of [false,true]){
    const n=`trail-${layer}-${note}-${tail}-${glow?1:0}`,alpha=Math.round((glow?.13:.65)*(1-tail/11)*255).toString(16).padStart(2,'0').toUpperCase();
    list.push(segment(n,alpha+color.slice(2),glow?9:2.6));parts.push({name:n,layer,note,tail,type:'trail'});
   }
  }
  for(const side of [-1,1]){const n=`ear-${layer}-${side}`;defaults[n]={x:side*78,y:-1,scaleX:1,scaleY:1,opacity:0};list.push(rect(n,side*78,-1,23,45,10,ink));parts.push({name:n,layer,side,type:'ear'});}
  for(let i=0;i<14;i++){const n=`band-${layer}-${i}`;list.push(segment(n,ink,9));parts.push({name:n,layer,index:i,type:'band'});}
 }
 const clamp=x=>Math.max(0,Math.min(1,x));
 const visibility=(z,layer)=>layer==='front'?clamp(z/5+.5):1-clamp(z/5+.5);
 const project=(x,y,z,a)=>{const depth=-x*Math.sin(a)+z*Math.cos(a),scale=1+depth/700;return {x:(x*Math.cos(a)+z*Math.sin(a))*scale,y:y*scale,z:depth,scale};};
 const orbit=(note,a)=>{const t=a+note*Math.PI;return {x:110*Math.cos(t),y:(note?20:-24)+32*Math.sin(t),z:110*Math.sin(t)};};
 function animate(set){const tracks={};const key=(n,p,f,v)=>{((tracks[n]||={})[p]||=[]).push([f,Math.round(v*10000)/10000]);};
  for(let f=0;f<=240;f+=6){const progress=clamp((f-18)/174),smooth=progress*progress*(3-2*progress),a=smooth*2*Math.PI;
   key('eyes','x',f,67*Math.sin(a));key('eyes','scaleX',f,Math.max(.12,Math.abs(Math.cos(a))));
   for(const n of ['eyeL','eyeR'])key(n,'opacity',f,clamp((Math.cos(a)-.05)*5));
   key('character','y',f,164-8*Math.sin(progress*Math.PI));
   for(const p of parts){const n=p.name;
    if(p.type==='ear'){const q=project(p.side*78,-1,0,a);key(n,'x',f,q.x);key(n,'y',f,q.y);key(n,'scaleX',f,(Math.abs(Math.cos(a))+.95*Math.abs(Math.sin(a)))*q.scale);key(n,'scaleY',f,q.scale);key(n,'opacity',f,visibility(q.z,p.layer));}
    if(p.type==='band'){let middle=0;for(let j=0;j<2;j++){const phi=(p.index+j)/14*Math.PI,q=project(78*Math.cos(phi),-6-80*Math.sin(phi),-18*Math.sin(phi),a);key(n+(j?'b':'a'),'x',f,q.x);key(n+(j?'b':'a'),'y',f,q.y);middle+=q.z/2;}key(n,'opacity',f,visibility(middle,p.layer));}
    if(p.type==='note'){const q=orbit(p.note,a);key(n,'x',f,q.x);key(n,'y',f,q.y);key(n,'scaleX',f,1+q.z/650);key(n,'scaleY',f,1+q.z/650);key(n,'rotation',f,.22*Math.sin(a));key(n,'opacity',f,visibility(q.z,p.layer));}
    if(p.type==='trail'){let middle=0;for(let j=0;j<2;j++){const q=orbit(p.note,a-(p.tail+j)*.09);key(n+(j?'b':'a'),'x',f,q.x);key(n+(j?'b':'a'),'y',f,q.y);middle+=q.z/2;}key(n,'opacity',f,visibility(middle,p.layer)*Math.sin(progress*Math.PI));}
   }
  }
  set('headphones','opacity',0);set('notes','opacity',0);for(const [n,properties]of Object.entries(tracks))for(const [p,keys]of Object.entries(properties))set(n,p,keys);
 }
 return {front:front.join(''),back:back.join(''),defaults,animate};
};
