'use strict';
(()=>{
 const api=window.soundscapePlayer,players=new Map(),levels={nature:.5,rain:.4,animals:.36,urban:.34,places:.34,transport:.34,things:.3,noise:.34};
 let revision=0,playing=false,idle,state;
 const current=(id,r)=>playing&&revision===r&&state.tracks.some(t=>t.id===id);
 function remove(id){const p=players.get(id);if(!p)return;players.delete(id);p.audio.pause();p.audio.removeAttribute('src');p.audio.load();}
 function fail(r,error){if(r!==revision||!playing)return;playing=false;for(const p of players.values())p.audio.pause();api.report({revision:r,error});releaseLater();}
 function releaseLater(){clearTimeout(idle);idle=setTimeout(()=>{if(!playing)for(const id of [...players.keys()])remove(id);},90000);}
 function message(error,a){const code=a?.error?.code;if(code===3||code===4)return '白噪音音源解码失败，请重新播放';if(error.name==='NotAllowedError')return '音频播放未获许可，请重新点击播放';return error.message||'白噪音播放失败，请重新播放';}
 async function start(track,r,attempt=0,refresh=false){
  let p=players.get(track.id);
  try{
   if(!p){const source=await api.source(track.id,refresh);if(!current(track.id,r))return;if(source.error)throw Error(source.error);p=players.get(track.id);if(!p){const audio=new Audio(source.url);p={audio,ready:false,attempt};players.set(track.id,p);audio.loop=true;audio.preload='auto';const record=p;audio.addEventListener('error',()=>{if(players.get(track.id)!==record||!record.ready||!playing)return;const latest=revision,active=state.tracks.find(t=>t.id===track.id),error=message(Error('音源读取失败，请重新播放'),audio),code=audio.error?.code;remove(track.id);if(record.attempt<1&&active)void start(active,latest,1,code===3||code===4).then(()=>{if(current(track.id,latest))api.report({revision:latest})});else fail(latest,error);});}}
   if(!current(track.id,r))return;
   const sound=state.sounds.find(s=>s.id===track.id);p.audio.volume=track.volume*(levels[sound?.category]??.34);p.attempt=attempt;
   let timeout;try{await Promise.race([p.audio.play(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('音源加载超时，请重新播放')),15000)})]);}finally{clearTimeout(timeout);}
   if(current(track.id,r)&&players.get(track.id)===p)p.ready=true;
  }catch(error){
   if(!current(track.id,r))return;
   const code=p?.audio.error?.code,text=message(error,p?.audio);if(players.get(track.id)===p)remove(track.id);
   if(attempt<1)return start(track,r,attempt+1,code===3||code===4);
   fail(r,text);
  }
 }
 api.onCommand(async next=>{
  state=next;revision=next.revision;playing=next.playing&&!next.pausedForVoice;clearTimeout(idle);
  const r=revision,desired=new Set(next.tracks.map(t=>t.id));
  for(const id of [...players.keys()])if(!desired.has(id))remove(id);
  // Acknowledge voice isolation synchronously, before any download or play promise.
  if(!playing){for(const p of players.values())p.audio.pause();api.report({revision:r,pausedForVoice:next.pausedForVoice===true});releaseLater();return;}
  await Promise.all(next.tracks.map(t=>start(t,r)));
  if(revision===r&&playing)api.report({revision:r});
 });api.ready();
})();
