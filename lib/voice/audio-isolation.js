'use strict';
// Serialize source pause and Windows mute, including rapid pause/resume/cancel.
class AudioIsolation {
 constructor({output,soundscape}){Object.assign(this,{output,soundscape});this.serial=Promise.resolve();}
 run(fn){const task=this.serial.then(fn);this.serial=task.catch(()=>{});return task;}
 begin(){return this.run(async()=>{await this.soundscape.suspendForVoice();return this.output.begin();});}
 end(){return this.run(async()=>{try{return await this.output.end();}finally{this.soundscape.resumeAfterVoice();}});}
 prepare(){return this.output.prepare();}
 close(){this.output.close();this.soundscape.resumeAfterVoice();}
}
module.exports={AudioIsolation};
