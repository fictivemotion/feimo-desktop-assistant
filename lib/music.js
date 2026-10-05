'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),readline=require('node:readline');
class Music{
  constructor({settings,onChange=()=>{},script=path.join(__dirname,'windows-media.ps1'),fetcher=fetch}){Object.assign(this,{settings,onChange,script});this.lyrics=new(require('./lyrics').Lyrics)(fetcher);this.state={available:false,message:'音乐尚未连接'};this.pending=new Map();this.seq=0;}
  start(){
    if(process.platform!=='win32'){this.state={available:false,error:'媒体控制需要 Windows 10 1809 或更新版本'};return;}
    if(this.child)return;
    this.child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',this.script],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child.stderr.on('data',()=>{});
    readline.createInterface({input:this.child.stdout}).on('line',line=>{try{const m=JSON.parse(line),job=this.pending.get(m.id);if(job){clearTimeout(job.timer);this.pending.delete(m.id);const previous=this.state;this.state={...m.data,sampledAt:Date.now(),lyrics:previous.title===m.data.title?previous.lyrics:[]};job.resolve(this.state);this.onChange();if(m.data.available&&m.data.title!==previous.title){const title=m.data.title;void this.lyrics.get(title,m.data.artist).then(rows=>{if(this.state.title===title){this.state.lyrics=rows;this.onChange();}});}}}catch{}});
    const child=this.child;const closed=()=>{if(this.child!==child)return;this.child=null;clearInterval(this.timer);this.state={available:false,error:'音乐服务已停止，刷新或重新打开播放器后重试'};for(const job of this.pending.values()){clearTimeout(job.timer);job.resolve(this.state);}this.pending.clear();this.onChange();};this.child.on('error',closed);this.child.on('exit',closed);this.child.stdin.on('error',()=>{});
    this.timer=setInterval(()=>{if(this.settings.get('music',{}).enabled!==false)void this.command('poll');},5000);this.timer.unref?.();void this.command('poll');
  }
  command(command){
    if(!['poll','toggle','next','previous'].includes(command))throw new Error('未知音乐操作');
    if(!this.child){if(!this.stopped)this.start();if(!this.child)return Promise.resolve(this.state);}
    return new Promise(resolve=>{const id=++this.seq,timer=setTimeout(()=>{this.pending.delete(id);resolve({available:false,error:'读取媒体信息超时，请重试'});},7000);this.pending.set(id,{resolve,timer});this.child.stdin.write(JSON.stringify({id,command,player:this.settings.get('music',{}).player||'netease'})+'\n');});
  }
  stop(){this.stopped=true;clearInterval(this.timer);this.child?.kill();}
}
module.exports={Music};
