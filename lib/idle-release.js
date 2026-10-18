'use strict';
// Release only disposable resources. The owner supplies the active-work guard;
// drafts, visible windows and running jobs must never be evicted by a timer.
class IdleRelease{
 constructor({release,busy=()=>false,delay=90000}){Object.assign(this,{release,busy,delay});}
 cancel(){clearTimeout(this.timer);this.timer=null;}
 arm(){this.cancel();if(this.closed)return;this.timer=setTimeout(()=>{this.timer=null;if(!this.flush())this.arm();},this.delay);this.timer.unref?.();}
 flush(){if(this.closed||this.busy())return false;this.cancel();this.release();return true;}
 dispose(){this.closed=true;this.cancel();}
}
module.exports={IdleRelease};
