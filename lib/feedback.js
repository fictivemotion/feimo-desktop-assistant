'use strict';
const DEFAULTS={enabled:true,volume:.24,pack:'soft'};
function config(value={}){return {enabled:value.enabled!==false,volume:Number.isFinite(value.volume)?Math.max(0,Math.min(1,value.volume)):DEFAULTS.volume,pack:['soft','minimal','zen'].includes(value.pack)?value.pack:'soft'};}
const cues={completed:'success',failed:'error',notification:'notification',reminder:'warning',needsInput:'warning',attention:'warning',greeting:'open',wake:'wake',interaction:'select',workbenchOpen:'open',toolsOpen:'open',settingsOpen:'open',focusRunning:'start',focusBreak:'complete',soundscapePlaying:'play',musicPlaying:'play',thinking:'start',replyStreaming:'progress-step'};
class Feedback{
 constructor({send,settings,now=()=>Date.now()}){this.send=send;this.settings=settings;this.now=now;this.scene=null;this.blocked=false;this.last=new Map();}
 configure(){this.send({type:'config',config:config(this.settings.get('feedback',{})),blocked:this.blocked});}
 voice(phase){const blocked=['starting','listening','paused','finishing','polishing'].includes(phase);if(blocked===this.blocked)return;this.blocked=blocked;this.configure();}
 state(scene){const old=this.scene;this.scene=scene;if(old!==null&&old!==scene)this.event(scene);}
 event(scene){const cue=cues[scene];if(!cue||this.blocked||!config(this.settings.get('feedback',{})).enabled)return false;const now=this.now();if(now-(this.last.get(cue)??-Infinity)<1600)return false;this.last.set(cue,now);this.send({type:'play',cue});return true;}
}
module.exports={DEFAULTS,config,cues,Feedback};
