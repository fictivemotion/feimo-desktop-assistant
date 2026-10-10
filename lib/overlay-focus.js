'use strict';
// Mouse hit testing does not release keyboard focus. Passive overlays must use
// WS_EX_NOACTIVATE as well; only an explicitly opened editor may receive focus.
function overlayFocusable(win,on){
  if(!win||win.isDestroyed())return;
  if(win.isFocusable()!==!!on){win.setFocusable(!!on);win._feimoShape=null;}
  if(!on&&win.isFocused())win.blur();
}
function overlayShape(win,rects,{force=false}={}){
  if(!win||win.isDestroyed()||typeof win.setShape!=='function')return;
  const {width,height}=win.getBounds();
  const shape=rects.filter(r=>['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0).map(r=>{
    const x=Math.max(0,Math.floor(r.x)),y=Math.max(0,Math.floor(r.y));
    return {x,y,width:Math.min(width,Math.ceil(r.x+r.width))-x,height:Math.min(height,Math.ceil(r.y+r.height))-y};
  }).filter(r=>r.width>0&&r.height>0);
  const key=JSON.stringify(shape),now=Date.now();
  if(!force&&win._feimoShape===key){
    // Native style changes (focus, show, display resume) can restore mouse
    // transparency without changing DOM geometry. Repair input independently
    // of the region cache, without repeatedly invalidating the compositor.
    if(now-(win._feimoMouseChecked||0)>=1000){win.setIgnoreMouseEvents(!shape.length);win._feimoMouseChecked=now;}
    return;
  }
  // Empty SetWindowRgn restores the full rectangular region, so explicitly
  // ignore mouse input when there are no visible controls.
  if(shape.length)win.setShape(shape);
  win.setIgnoreMouseEvents(!shape.length);win._feimoShape=key;win._feimoMouseChecked=now;
}
module.exports={overlayFocusable,overlayShape};
