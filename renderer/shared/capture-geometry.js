'use strict';
(function(root,factory){const v=factory();if(typeof module==='object')module.exports=v;else root.CaptureGeometry=v;})(globalThis,()=>{
 function resize(r,dir,dx,dy,width,height){let l=r.x,t=r.y,right=r.x+r.w,bottom=r.y+r.h;if(dir.includes('w'))l=Math.max(0,Math.min(right-6,l+dx));if(dir.includes('e'))right=Math.max(l+6,Math.min(width,right+dx));if(dir.includes('n'))t=Math.max(0,Math.min(bottom-6,t+dy));if(dir.includes('s'))bottom=Math.max(t+6,Math.min(height,bottom+dy));return{x:l,y:t,w:right-l,h:bottom-t};}
 return{resize};
});
