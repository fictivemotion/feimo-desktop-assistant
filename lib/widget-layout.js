'use strict';
// Pure desktop geometry. Saved expanded sizes are never replaced by capsule sizes.
const GAP=8,MIN_WIDTH=320,MIN_HEIGHT=260;
function size(item){return {...item.bounds,width:item.collapsed&&!item.groupId&&item.capsuleWidthMode==='independent'?item.capsuleWidth:item.bounds.width,height:item.collapsed?52:item.bounds.height};}
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
