'use strict';
/** Native hit region includes a transparent halo; CSS paints smooth rounded edges. */
function speechShape(width, height, side, anchor) {
  const left=side==='right'?14:8,top=side==='bottom'?13:5;
  const right=side==='left'?14:8,bottom=side==='top'?13:5;
  const box={x:left,y:top,width:width-left-right,height:height-top-bottom},rects=[];
  function rounded(r,radius,halo=3){
    const x=r.x-halo,y=r.y-halo,w=r.width+halo*2,h=r.height+halo*2,corner=Math.min(radius+halo,w/2,h/2);
    for(let row=0;row<h;row++){
      const d=Math.max(0,corner-Math.min(row+.5,h-row-.5)),inset=Math.ceil(corner-Math.sqrt(Math.max(0,corner*corner-d*d)));
      const yy=Math.round(y+row),xx=Math.max(0,Math.round(x+inset)),end=Math.min(width,Math.round(x+w-inset));
      if(yy>=0&&yy<height&&end>xx)rects.push({x:xx,y:yy,width:end-xx,height:1});
    }
  }
  rounded(box,18);
  const dotX=side==='right'?box.x-8:side==='left'?box.x+box.width+8:anchor;
  const dotY=side==='top'?box.y+box.height+7:side==='bottom'?6:anchor;
  rounded({x:dotX-5,y:dotY-5,width:10,height:10},5);
  return rects;
}
module.exports = { speechShape };
