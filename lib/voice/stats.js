'use strict';
const fs=require('node:fs'),path=require('node:path');
const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const countChars=text=>(String(text).match(/[\p{L}\p{N}]/gu)||[]).length;
class VoiceStats{
 constructor(file){this.file=file;try{this.data=JSON.parse(fs.readFileSync(file,'utf8'));}catch{this.data={days:{},recentIds:[]};}this.data.days??={};this.data.recentIds??=[];}
 record(id,text,seconds,at=new Date()){
  const chars=countChars(text);if(!chars||this.data.recentIds.includes(id))return false;
  const key=dayKey(at),d=this.data.days[key]||{chars:0,seconds:0,sessions:0};d.chars+=chars;d.seconds+=Math.max(0,Math.round(Number(seconds)||0));d.sessions++;this.data.days[key]=d;this.data.recentIds=[...this.data.recentIds,id].slice(-1000);
  const tmp=this.file+'.tmp';fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(tmp,JSON.stringify(this.data));fs.renameSync(tmp,this.file);return true;
 }
 view(at=new Date()){
  const today=dayKey(at),month=today.slice(0,7);const days=Object.entries(this.data.days).map(([key,d])=>({key,...d})).sort((a,b)=>a.key.localeCompare(b.key));const sum=rows=>rows.reduce((a,d)=>({chars:a.chars+d.chars,seconds:a.seconds+d.seconds,sessions:a.sessions+d.sessions}),{chars:0,seconds:0,sessions:0});const total=sum(days);
  return {today:{key:today,...(this.data.days[today]||{chars:0,seconds:0,sessions:0})},month:sum(days.filter(d=>d.key.startsWith(month))),total,activeDays:days.length,speed:total.seconds?Math.round(total.chars/(total.seconds/60)):0,days};
 }
}
module.exports={VoiceStats,countChars,dayKey};
