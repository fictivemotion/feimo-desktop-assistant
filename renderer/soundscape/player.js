'use strict';
(()=>{
 const api=window.soundscapePlayer,players=new Map(),levels={nature:.5,rain:.4,animals:.36,urban:.34,places:.34,transport:.34,things:.3,noise:.34};
 let revision=0,playing=false;
 api.onCommand(async state=>{
  revision=state.revision;playing=state.playing;const current=revision,desired=new Set(state.tracks.map(t=>t.id));
  for(const [id,a] of players){if(desired.has(id))continue;a.pause();a.removeAttribute('src');a.load();players.delete(id)}
  try{
   for(const track of state.tracks){const s=state.sounds.find(s=>s.id===track.id);if(!s)continue;let a=players.get(track.id);if(!a){a=new Audio(s.audioUrl);a.loop=true;a.preload='auto';a.addEventListener('error',()=>{if(players.get(track.id)===a&&playing){for(const p of players.values())p.pause();api.report({revision,error:'在线音源加载失败，请检查网络后重试'})}});players.set(track.id,a)}a.volume=track.volume*levels[s.category];if(!state.playing)a.pause();}
   if(state.playing){let timeout;try{await Promise.race([Promise.all([...players.values()].map(a=>a.play())),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('timeout')),15000)})])}finally{clearTimeout(timeout)}}
   if(current===revision)api.report({revision:current});
  }catch{if(current===revision){for(const a of players.values())a.pause();api.report({revision:current,error:'在线白噪音播放失败，请检查网络后重试'})}}
 });api.ready();
})();
