'use strict';
const DEFAULTS={enabled:true,volume:.24,pack:'mochi'};
function config(value={}){return {enabled:value.enabled!==false,volume:Number.isFinite(value.volume)?Math.max(0,Math.min(1,value.volume)):DEFAULTS.volume,pack:'mochi'};}
const cues={completed:'powerUp',failed:'error',notification:'message',reminder:'notify',needsInput:'notify',attention:'notify',greeting:'pop',wake:'pop',interaction:'bubble',workbenchOpen:'pop',toolsOpen:'pop',settingsOpen:'pop',focusRunning:'powerUp',focusBreak:'chime',soundscapePlaying:'pop',musicPlaying:'pop',textReady:'coin',imageReady:'coin'};
class Feedback{
 constructor({send,settings,now=()=>Date.now()}){this.send=send;this.settings=settings;this.now=now;this.scene=null;this.blocked=false;this.last=new Map();this.preludes=new Map();this.seq=0;}
 configure(){this.send({type:'config',config:config(this.settings.get('feedback',{})),blocked:this.blocked});}
 voice(phase){const blocked=['starting','listening','paused','finishing','polishing'].includes(phase);if(blocked===this.blocked)return;this.blocked=blocked;this.configure();}
 state(scene,sound=scene){const old=this.scene;this.scene=scene;if(old!==null&&old!==scene)this.event(sound);}
 beforeVoice(){const cfg=config(this.settings.get('feedback',{}));if(!cfg.enabled||cfg.volume===0)return Promise.resolve();return new Promise(resolve=>{const id=++this.seq,timer=setTimeout(()=>{this.preludes.delete(id);this.send({type:'cancelPrelude',id});resolve();},250);this.preludes.set(id,{resolve,timer});this.send({type:'prelude',cue:'pop',id,expiresAt:this.now()+250});});}
 done(id){const p=this.preludes.get(id);if(!p)return;this.preludes.delete(id);clearTimeout(p.timer);p.resolve();}
 event(scene){const cue=cues[scene];if(!cue||this.blocked||!config(this.settings.get('feedback',{})).enabled)return false;const now=this.now();if(now-(this.last.get(cue)??-Infinity)<1600)return false;this.last.set(cue,now);this.send({type:'play',cue});return true;}
}
module.exports={DEFAULTS,config,cues,Feedback};
