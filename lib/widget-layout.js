'use strict';
// Pure desktop geometry. Saved expanded sizes are never replaced by capsule sizes.
const GAP=8,MIN_WIDTH=320,MIN_HEIGHT=260;
function size(item){return {...item.bounds,width:item.collapsed&&(item.dockSide||item.capsuleWidthMode==='independent')?item.capsuleWidth:item.bounds.width,height:item.collapsed?52:item.bounds.height};}
function groupLayout(items,axis,area,anchor,requestedWidth){
 if(items.length<2)return null;
 const row=axis==='row',availableWidth=area.width-24,availableHeight=area.height-24;
 const width=Math.round(Math.min(requestedWidth||items[0].bounds.width,row?(availableWidth-GAP*(items.length-1))/items.length:availableWidth));
 if(width<MIN_WIDTH)return null;
 const heights=items.map(w=>w.collapsed?52:w.bounds.height);
 if(row&&Math.max(...heights)>availableHeight)return null;
 if(!row&&heights.reduce((a,b)=>a+b,0)+GAP*(items.length-1)>availableHeight){const expanded=items.filter(w=>!w.collapsed).length,room=availableHeight-GAP*(items.length-1)-items.filter(w=>w.collapsed).length*52;if(!expanded||room/expanded<MIN_HEIGHT)return null;for(let i=0;i<heights.length;i++)if(!items[i].collapsed)heights[i]=Math.floor(room/expanded);}
 const totalWidth=row?width*items.length+GAP*(items.length-1):width,totalHeight=row?Math.max(...heights):heights.reduce((a,b)=>a+b,0)+GAP*(items.length-1);
 const x=Math.round(Math.max(area.x+12,Math.min(anchor.x,area.x+area.width-totalWidth-12))),y=Math.round(Math.max(area.y+12,Math.min(anchor.y,area.y+area.height-totalHeight-12)));
 let offset=0;return items.map((w,i)=>{const bounds={x:row?x+offset:x,y:row?y:y+offset,width,height:w.collapsed?w.bounds.height:heights[i]};offset+=(row?width:heights[i])+GAP;return {...w,bounds};});
}
function joinCandidate(bounds,others,distance=22){
 let best=null;for(const item of others){const r=size(item),overlapX=Math.min(bounds.x+bounds.width,r.x+r.width)-Math.max(bounds.x,r.x),overlapY=Math.min(bounds.y+bounds.height,r.y+r.height)-Math.max(bounds.y,r.y);
 for(const [axis,before,d]of [['column',false,Math.abs(bounds.y-r.y-r.height-GAP)],['column',true,Math.abs(bounds.y+bounds.height+GAP-r.y)],['row',false,Math.abs(bounds.x-r.x-r.width-GAP)],['row',true,Math.abs(bounds.x+bounds.width+GAP-r.x)]]){if(d>distance||(axis==='column'?overlapX<Math.min(bounds.width,r.width)*.5:overlapY<Math.min(bounds.height,r.height)*.5))continue;if(!best||d<best.distance)best={item,axis,before,distance:d};}}
 return best;
}
module.exports={GAP,size,groupLayout,joinCandidate};

function overlaps(a,b,gap=GAP){return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;}
function areaFor(bounds,displays){return displays.map(d=>d.workArea||d).reduce((best,a)=>{const overlap=r=>Math.max(0,Math.min(bounds.x+bounds.width,r.x+r.width)-Math.max(bounds.x,r.x))*Math.max(0,Math.min(bounds.y+bounds.height,r.y+r.height)-Math.max(bounds.y,r.y));return !best||overlap(a)>overlap(best)?a:best;},null);}
function clampRect(r,a){return {x:Math.round(Math.max(a.x,Math.min(r.x,a.x+a.width-Math.min(r.width,a.width)))),y:Math.round(Math.max(a.y,Math.min(r.y,a.y+a.height-Math.min(r.height,a.height)))),width:Math.min(r.width,a.width),height:Math.min(r.height,a.height)};}
function avoid(items,displays,activeId){
 const rows=items.filter(w=>w.visible),ideal=new Map(),result=new Map(),groups=new Set();
 for(const item of rows){let r=size(item);const area=areaFor(r,displays);if(!area)continue;if(item.dockSide)r.x=item.dockSide==='left'?area.x:area.x+area.width-r.width;ideal.set(item.id,clampRect(r,area));}
 for(const item of rows){if(!item.groupId||groups.has(item.groupId))continue;groups.add(item.groupId);const members=rows.filter(w=>w.groupId===item.groupId),first=members[0],base=ideal.get(first.id);if(!base)continue;const area=areaFor(base,displays),row=first.groupAxis==='row';let offset=0;const positions=members.map(w=>{const r={...size(w),x:base.x+(row?offset:0),y:base.y+(row?0:offset)};offset+=(row?r.width:r.height)+GAP;return {w,r};});const width=Math.max(...positions.map(v=>v.r.x+v.r.width))-base.x,height=Math.max(...positions.map(v=>v.r.y+v.r.height))-base.y,box=clampRect({...base,width,height},area),dx=box.x-base.x,dy=box.y-base.y;for(const {w,r}of positions)ideal.set(w.id,clampRect({...r,x:r.x+dx,y:r.y+dy},area));}
 const ordered=[...rows].sort((a,b)=>(b.locked?4:b.id===activeId?3:!b.collapsed?2:1)-(a.locked?4:a.id===activeId?3:!a.collapsed?2:1)),occupied=[];
 for(const item of ordered){const wanted=ideal.get(item.id);if(!wanted)continue;const area=areaFor(wanted,displays);let chosen=wanted;
  if(!item.locked&&occupied.some(r=>overlaps(chosen,r))){const xs=[wanted.x,area.x,area.x+area.width-wanted.width,...occupied.flatMap(r=>[r.x-wanted.width-GAP,r.x+r.width+GAP])],ys=[wanted.y,area.y,area.y+area.height-wanted.height,...occupied.flatMap(r=>[r.y-wanted.height-GAP,r.y+r.height+GAP])];let best=null,cost=Infinity;for(const y of ys)for(const x of xs){const r={...wanted,x,y};if(x<area.x||y<area.y||x+r.width>area.x+area.width||y+r.height>area.y+area.height||occupied.some(o=>overlaps(r,o)))continue;const score=(x-wanted.x)**2*(item.dockSide?4:1)+(y-wanted.y)**2;if(score<cost){cost=score;best=r;}}chosen=best;}
  if(!chosen){result.set(item.id,{bounds:wanted,occluded:true});continue;}occupied.push(chosen);result.set(item.id,{bounds:chosen,occluded:false,shifted:chosen.x!==wanted.x||chosen.y!==wanted.y});
 }
 return result;
}
module.exports={...module.exports,overlaps,areaFor,clampRect,avoid};
