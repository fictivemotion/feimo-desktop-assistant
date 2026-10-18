'use strict';
// Pure desktop geometry. Saved expanded sizes are never replaced by capsule sizes.
const GAP=8,MIN_WIDTH=320,MIN_HEIGHT=260,DOCK_WIDTH=48,DOCK_HEIGHT=52;
// The edge tab paints the visible end of a capsule inside the work area. Keeping
// the native window on screen also works when another monitor adjoins that edge.
function size(item){return {...item.bounds,width:item.collapsed&&item.dockSide?DOCK_WIDTH:item.collapsed&&item.capsuleWidthMode==='independent'?item.capsuleWidth:item.bounds.width,height:item.collapsed?DOCK_HEIGHT:item.bounds.height};}
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
module.exports={GAP,DOCK_WIDTH,DOCK_HEIGHT,size,groupLayout,joinCandidate};

function overlaps(a,b,gap=GAP){return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;}
function areaFor(bounds,displays){return displays.map(d=>d.workArea||d).reduce((best,a)=>{const overlap=r=>Math.max(0,Math.min(bounds.x+bounds.width,r.x+r.width)-Math.max(bounds.x,r.x))*Math.max(0,Math.min(bounds.y+bounds.height,r.y+r.height)-Math.max(bounds.y,r.y));return !best||overlap(a)>overlap(best)?a:best;},null);}
function clampRect(r,a){return {x:Math.round(Math.max(a.x,Math.min(r.x,a.x+a.width-Math.min(r.width,a.width)))),y:Math.round(Math.max(a.y,Math.min(r.y,a.y+a.height-Math.min(r.height,a.height)))),width:Math.min(r.width,a.width),height:Math.min(r.height,a.height)};}
function avoid(items,displays,activeId){
 const result=new Map(),columns=[];
 // Use saved anchors, never the clamped expanded rectangles or activation order.
 // A lower capsule keeps its slot even if its preferred height exceeds the room.
 for(const [index,item]of items.entries()){
  if(!item.visible)continue;const area=areaFor(item.bounds,displays);if(!area)continue;
  let r=size(item);if(item.dockSide)r.x=item.dockSide==='left'?area.x:area.x+area.width-r.width;r=clampRect(r,area);
  const entry={item,index,area,r},right=item.bounds.x+item.bounds.width;
  const column=columns.find(c=>c.area===area&&(
   item.dockSide?c.side===item.dockSide:!c.side&&(
    item.groupId&&item.groupAxis==='column'&&c.group===item.groupId||
    !(item.groupId&&item.groupAxis==='row')&&!c.row&&(Math.abs(item.bounds.x-c.left)<=24||Math.abs(right-c.right)<=24))));
  if(column)column.entries.push(entry);else columns.push({area,side:item.dockSide,group:item.groupAxis==='column'?item.groupId:'',row:!!item.groupId&&item.groupAxis==='row',left:item.bounds.x,right,entries:[entry]});
 }
 for(const column of columns){
  const {area}=column,entries=column.entries.sort((a,b)=>a.item.bounds.y-b.item.bounds.y||a.index-b.index);
  const rightAligned=column.side==='right'||!column.side&&entries.length>1&&entries.every(e=>Math.abs(e.item.bounds.x+e.item.bounds.width-column.right)<=24)&&!entries.every(e=>Math.abs(e.item.bounds.x-column.left)<=24);
  // Same-column windows retain a common left/right edge. Locks keep their exact
  // native geometry and divide the column into independent vertical intervals.
  for(const e of entries)if(!e.item.locked&&!column.side)e.r.x=rightAligned?Math.max(area.x,Math.min(column.right,area.x+area.width)-e.r.width):Math.max(area.x,Math.min(column.left,area.x+area.width-e.r.width));
  let start=0,top=area.y;
  for(let i=0;i<=entries.length;i++)if(i===entries.length||entries[i].item.locked){
   const bottom=i===entries.length?area.y+area.height:entries[i].r.y-GAP;
   packColumn(entries.slice(start,i),top,bottom,activeId,result,!!column.group);
   if(i<entries.length){const e=entries[i];result.set(e.item.id,{bounds:e.r,occluded:false,shifted:false});top=e.r.y+e.r.height+GAP;}start=i+1;
  }
 }
 return result;
}
function packColumn(entries,top,bottom,activeId,result,compact=false){
 if(!entries.length)return;const room=Math.max(0,bottom-top),gap=Math.min(GAP,Math.max(0,(room-52*entries.length)/Math.max(1,entries.length-1))),heights=entries.map(e=>e.r.height);
 let excess=heights.reduce((a,b)=>a+b,0)+gap*(entries.length-1)-room;
 const shrink=(indices,floor)=>{while(excess>0&&indices.length){const share=Math.ceil(excess/indices.length);let used=0;for(const i of indices){const delta=Math.min(share,Math.max(0,heights[i]-floor));heights[i]-=delta;excess-=delta;used+=delta;}if(!used)break;indices=indices.filter(i=>heights[i]>floor);}};
 const expanded=entries.flatMap((e,i)=>e.item.collapsed?[]:[i]);
 shrink(expanded.filter(i=>entries[i].item.id!==activeId),128);shrink(expanded,128);
 // Very small displays still keep every header accessible; body areas scroll.
 shrink(expanded,52);if(excess>0)shrink(entries.map((_,i)=>i),Math.max(1,Math.floor(room/entries.length)-Math.ceil(gap)));
 const ys=[];for(let i=0;i<entries.length;i++)ys[i]=Math.max(top,compact&&i?top:entries[i].item.bounds.y,i?ys[i-1]+heights[i-1]+gap:top);
 if(ys.at(-1)+heights.at(-1)>bottom){ys[ys.length-1]=bottom-heights.at(-1);for(let i=ys.length-2;i>=0;i--)ys[i]=Math.min(ys[i],ys[i+1]-gap-heights[i]);}
 for(let i=0;i<entries.length;i++){const e=entries[i],bounds={...e.r,y:Math.round(ys[i]),height:Math.max(1,Math.floor(heights[i]))};result.set(e.item.id,{bounds,occluded:room<entries.length,shifted:bounds.x!==e.r.x||bounds.y!==e.item.bounds.y||bounds.height!==e.r.height});}
}
// Reorder the collapsed anchor slots, independently of temporary expanded sizes.
// Locked cards divide a dock into separate segments and never move.
function reorderDock(items,id,targetY,displays){
 const item=items.find(w=>w.id===id);if(!item?.dockSide||!item.collapsed||item.locked||!Number.isFinite(targetY))return null;
 const area=areaFor(item.bounds,displays),sameArea=w=>{const a=areaFor(w.bounds,displays);return a&&a.x===area.x&&a.y===area.y&&a.width===area.width&&a.height===area.height;};
 const column=items.filter(w=>w.visible&&w.dockSide===item.dockSide&&sameArea(w)).sort((a,b)=>a.bounds.y-b.bounds.y||items.indexOf(a)-items.indexOf(b));
 const index=column.findIndex(w=>w.id===id);let first=index,last=index;while(first>0&&!column[first-1].locked)first--;while(last+1<column.length&&!column[last+1].locked)last++;
 const segment=column.slice(first,last+1),top=Math.max(area.y,first?column[first-1].bounds.y+DOCK_HEIGHT+GAP:segment[0].bounds.y),bottom=last+1<column.length?column[last+1].bounds.y-GAP:area.y+area.height;
 const step=Math.min(DOCK_HEIGHT+GAP,Math.max(DOCK_HEIGHT,(bottom-top-DOCK_HEIGHT)/Math.max(1,segment.length-1))),base=Math.max(area.y,Math.min(top,bottom-DOCK_HEIGHT-step*(segment.length-1)));
 const destination=Math.max(0,Math.min(segment.length-1,Math.round((targetY-base)/step))),ordered=segment.filter(w=>w.id!==id);ordered.splice(destination,0,item);
 const placed=new Map(ordered.map((w,i)=>[w.id,{...w,bounds:{...w.bounds,y:Math.round(base+i*step)}}]));return items.map(w=>placed.get(w.id)||w);
}
module.exports={...module.exports,overlaps,areaFor,clampRect,avoid,reorderDock};
