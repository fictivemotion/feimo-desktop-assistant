'use strict';
function parseLrc(text){const rows=[];for(const line of String(text).split(/\r?\n/)){const words=line.replace(/\[[^\]]*\]/g,'').trim();if(!words)continue;for(const m of line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g))rows.push({time:+m[1]*60+(+m[2]),text:words});}return rows.sort((a,b)=>a.time-b.time);}
class Lyrics{
  constructor(fetcher=fetch){this.fetcher=fetcher;this.cache=new Map();}
  async get(title,artist){const key=title+'|'+artist;if(this.cache.has(key))return this.cache.get(key);const read=async route=>{const r=await this.fetcher('https://music.163.com'+route,{headers:{Referer:'https://music.163.com/','User-Agent':'Feimo'},signal:AbortSignal.timeout(7000)});if(!r.ok)throw Error('歌词暂不可用');return r.json();};try{const d=await read('/api/search/get?type=1&limit=8&s='+encodeURIComponent(title+' '+artist));const norm=s=>String(s).toLowerCase().replace(/[\s·,，]/g,'');const match=d.result?.songs?.find(x=>norm(x.name)===norm(title)&&(!artist||x.artists?.some(a=>norm(artist).includes(norm(a.name)))));if(!match)return [];const l=await read('/api/song/lyric?id='+encodeURIComponent(match.id)+'&lv=-1&kv=-1&tv=-1');const rows=parseLrc(l.lrc?.lyric||'');this.cache.set(key,rows);if(this.cache.size>100)this.cache.delete(this.cache.keys().next().value);return rows;}catch{this.cache.set(key,[]);return [];}}
}
module.exports={Lyrics,parseLrc};
