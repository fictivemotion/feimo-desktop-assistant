'use strict';
const catalog=require('../assets/soundscape/catalog.json');
const byId=new Map(catalog.sounds.map(s=>[s.id,s]));
function normalizeTracks(value){
  const result=[],seen=new Set();
  for(const t of Array.isArray(value)?value:[]){if(!byId.has(t?.id)||seen.has(t.id)||result.length===3)continue;seen.add(t.id);result.push({id:t.id,volume:Math.max(0,Math.min(1,Number.isFinite(t.volume)?t.volume:.5))})}
  return result;
}
class Soundscape {
  constructor({settings,send,onChange=()=>{}}){Object.assign(this,{settings,send,onChange});const saved=settings.get('soundscape',{});this.state={tracks:normalizeTracks(saved.tracks||catalog.mixes[0].tracks),name:saved.name||catalog.mixes[0].name,playing:false,loading:false,error:null,revision:0};}
  view(){return {...this.state,catalog};}
  emit(){this.onChange(this.view());}
  save(){this.settings.set('soundscape',{tracks:this.state.tracks,name:this.state.name});}
  command(data={}){
    if(data.preset){const mix=catalog.mixes.find(m=>m.id===data.preset);if(!mix)throw new Error('未找到声景');this.state.tracks=normalizeTracks(mix.tracks);this.state.name=mix.name;}
    if(data.tracks){const tracks=normalizeTracks(data.tracks);if(data.tracks.length>3)throw new Error('最多混合三个声音');this.state.tracks=tracks;this.state.name=String(data.name||'我的混音').slice(0,40);}
    if(typeof data.playing==='boolean')this.state.playing=data.playing;
    if(!this.state.tracks.length)this.state.playing=false;
    this.state.revision++;this.state.loading=this.state.playing;this.state.error=null;this.save();this.send(this.state);this.emit();return this.view();
  }
  report(data){if(data.revision!==this.state.revision)return;this.state.loading=false;this.state.error=data.error?String(data.error).slice(0,150):null;if(this.state.error)this.state.playing=false;this.emit();}
}
module.exports={Soundscape,normalizeTracks,catalog};
