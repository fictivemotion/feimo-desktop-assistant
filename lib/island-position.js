'use strict';
// AppBars reserve workArea space. The island belongs to the physical screen
// edge in DIP coordinates; expanded content still clears the bottom taskbar.
function topBounds(display){
 const screen=display.bounds||display.workArea,work=display.workArea||screen;
 const width=Math.max(1,Math.min(1000,screen.width-16));
 const bottom=Math.min(screen.y+screen.height,work.y+work.height);
 return {x:Math.round(screen.x+(screen.width-width)/2),y:screen.y,width,height:Math.max(1,Math.min(640,bottom-screen.y-12))};
}
function atTopEdge(point,display){
 const screen=display.bounds||display.workArea;
 return point.y>=screen.y&&point.y<=screen.y+8&&Math.abs(point.x-(screen.x+screen.width/2))<Math.min(300,screen.width/2);
}
module.exports={topBounds,atTopEdge};
