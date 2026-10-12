import {sounds,playWhenReady,setSoundVolume,stopSounds} from './mochi-sounds';
// One application-wide Web Audio player. No iframe can emit its own sound.
let blocked=false,enabled=true,revision=0,prelude=null;
function finishPrelude(id){if(prelude?.id!==id)return;clearTimeout(prelude.timer);prelude=null;stopSounds();window.soundscapePlayer.feedbackDone(id);}
window.soundscapePlayer.onFeedback(message=>{
 if(message.type==='config'){revision++;blocked=message.blocked===true;enabled=message.config.enabled;setSoundVolume(enabled?message.config.volume:0);if(blocked||!enabled)stopSounds();return;}
 if(message.type==='cancelPrelude'){if(prelude?.id===message.id)finishPrelude(message.id);return;}
 if(message.type==='prelude'){
  if(!enabled||Date.now()+160>message.expiresAt){window.soundscapePlayer.feedbackDone(message.id);return;}
  if(prelude)finishPrelude(prelude.id);stopSounds();prelude={id:message.id,timer:setTimeout(()=>finishPrelude(message.id),Math.max(1,message.expiresAt-Date.now()))};
  playWhenReady(()=>{if(prelude?.id!==message.id||Date.now()+160>message.expiresAt){finishPrelude(message.id);return;}clearTimeout(prelude.timer);prelude.timer=setTimeout(()=>finishPrelude(message.id),160);sounds.pop();});return;
 }
 if(message.type!=='play'||blocked||!enabled||!Object.hasOwn(sounds,message.cue))return;
 const current=revision;playWhenReady(()=>{if(current!==revision||blocked||!enabled)return;stopSounds();sounds[message.cue]();});
});
addEventListener('pagehide',()=>{if(prelude)finishPrelude(prelude.id);stopSounds();},{once:true});
