'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),readline=require('node:readline');
class Music{
  constructor({settings,onChange=()=>{},script=path.join(__dirname,'windows-media.ps1'),fetcher=fetch,spawnProcess=spawn}){Object.assign(this,{settings,onChange,script,spawnProcess});this.lyrics=new(require('./lyrics').Lyrics)(fetcher);this.state={available:false,message:'音乐尚未连接'};this.pending=new Map();this.seq=0;this.lyricOffset=0;this.lastTrackAt=0;}
  start(){
    if(process.platform!=='win32'){this.state={available:false,error:'媒体控制需要 Windows 10 1809 或更新版本'};return;}
    if(this.child)return;
    this.child=this.spawnProcess('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',this.script],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child.stderr.on('data',()=>{});
    readline.createInterface({input:this.child.stdout}).on('line',line=>{try{const m=JSON.parse(line),job=this.pending.get(m.id);if(job){clearTimeout(job.timer);this.pending.delete(m.id);const previous=this.state,data=m.data||{},same=data.title===previous.title&&data.artist===previous.artist;if(data.available){this.lastTrackAt=Date.now();if(!same)this.lyricOffset=0;this.state={...data,position:(Number(data.position)||0)+(data.timelineExact===false?this.lyricOffset:0),sampledAt:Date.now(),duration:Number(data.duration)||(same?previous.duration:0)||this.lyrics.durations.get(data.title+'|'+data.artist)||0,lyrics:same?previous.lyrics:[]};}else if(Date.now()-this.lastTrackAt<8000){this.state={...previous,error:data.error||null};}else this.state={...data,sampledAt:Date.now(),lyrics:[]};job.resolve(data.error?{...this.state,error:data.error}:this.state);this.onChange();if(data.available&&!same){const key=data.title+'|'+data.artist;void this.lyrics.get(data.title,data.artist).then(rows=>{if(this.state.title+'|'+this.state.artist===key){this.state.lyrics=rows;this.state.duration=this.state.duration||this.lyrics.durations.get(key)||0;this.onChange();}});}}}catch{}});
    const child=this.child;const closed=()=>{if(this.child!==child)return;this.child=null;clearInterval(this.timer);this.state={available:false,error:'音乐服务已停止，刷新或重新打开播放器后重试'};for(const job of this.pending.values()){clearTimeout(job.timer);job.resolve(this.state);}this.pending.clear();this.onChange();};this.child.on('error',closed);this.child.on('exit',closed);this.child.stdin.on('error',()=>{});
    this.timer=setInterval(()=>{if(this.settings.get('music',{}).enabled!==false)if(![...this.pending.values()].some(j=>j.command==='poll'))void this.command('poll');},500);this.timer.unref?.();void this.command('poll');
  }
  command(command){
    if(command?.command==='lyrics-sync'){
      const secs=Number(command.seconds);if(!Number.isFinite(secs)||secs<0||secs>86400)throw Error('无效歌词时间');
      if(!this.state.available||this.state.timelineExact!==false)throw Error('当前播放器无需手动校准');
      const now=Date.now(),position=(this.state.position||0)+(this.state.playing?(now-(this.state.sampledAt||now))/1000:0);
      this.lyricOffset+=secs-position;this.state={...this.state,position:secs,sampledAt:now};this.onChange();return Promise.resolve(this.state);
    }
    const seek=command?.command==='seek';const seconds=Number(command?.seconds);if(seek){if(!this.state.canSeek||!Number.isFinite(seconds)||seconds<0||seconds>this.state.duration)throw Error('当前歌曲不支持跳转到此进度');}else if(!['poll','toggle','next','previous'].includes(command))throw new Error('未知音乐操作');
    if(!this.child){if(!this.stopped)this.start();if(!this.child)return Promise.resolve(this.state);}
    return new Promise(resolve=>{const id=++this.seq,timer=setTimeout(()=>{this.pending.delete(id);resolve({available:false,error:'读取媒体信息超时，请重试'});},7000);this.pending.set(id,{resolve,timer,command});this.child.stdin.write(JSON.stringify({id,command:seek?'seek':command,seconds:seek?seconds:undefined,duration:seek?this.state.duration:undefined,track:seek?this.state.title:undefined,artist:seek?this.state.artist:undefined,player:this.settings.get('music',{}).player||'netease'})+'\n');});
  }
  stop(){this.stopped=true;clearInterval(this.timer);this.child?.kill();}
}
module.exports={Music};
