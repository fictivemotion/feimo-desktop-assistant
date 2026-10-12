import {createUISFX} from 'uisfx';
// Exactly one player for the application, independent of mascot iframe count.
const player=createUISFX({pack:'soft',volume:.24,maxVoices:2,cooldownMs:1600});
let blocked=false,enabled=true,revision=0;
window.soundscapePlayer.onFeedback(async message=>{
 if(message.type==='config'){
  revision++;blocked=message.blocked===true;enabled=message.config.enabled;
  player.setPack(message.config.pack);player.setVolume(message.config.volume);player.setEnabled(enabled&&!blocked);
  if(blocked||!enabled)player.stopAll();return;
 }
 if(message.type!=='play'||blocked||!enabled)return;
 const current=revision;
 if(await player.unlock()&&current===revision&&!blocked&&enabled)player.play(message.cue,{loop:false,retrigger:'ignore'});
});
addEventListener('pagehide',()=>void player.destroy(),{once:true});
