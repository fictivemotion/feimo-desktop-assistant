'use strict';
class WidgetMaterialNative{
 constructor(){this.closed=false;}
 async apply(win,dark,radius,material='none'){
  if(this.closed||win.isDestroyed())return false;
  try{this.surface??=new(require('./widget-composition').WidgetComposition)();return this.surface.apply(win,dark,radius,material);}
  catch{try{require('./widget-composition').clearBackdrop(win);this.surface?.remove(win);}catch{}return false;}
 }
 remove(win){this.surface?.remove(win);}
 inspect(win){return this.surface?.inspect(win);}
 stop(){this.closed=true;this.surface?.stop();this.surface=null;}
}
module.exports={WidgetMaterialNative};
