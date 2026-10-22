'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
const {nativeScript}=require('./native-script'),{JsonStore}=require('./store');
const NIGHT='事已至此先睡觉吧，明天继续努力',MORNING='帮你把亮屏时间调到一小时啦';
const day=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
class Bedtime{
 constructor({dir,notice,now=()=>new Date(),platform=process.platform,run,canNotify=()=>true}){this.dir=path.join(dir,'bedtime-display');this.notice=notice;this.now=now;this.platform=platform;this.canNotify=canNotify;this.state=new JsonStore(path.join(this.dir,'notifications.json'),{});this.run=run||this.native.bind(this);this.pending=null;this.checking=null;this.stopped=false;}
 native(operation){const script=nativeScript(path.join(__dirname,'bedtime-display.ps1'),this.dir);return new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',script,'-Operation',operation,'-StateDir',this.dir],{windowsHide:true,timeout:60000,maxBuffer:65536},(error,stdout)=>{if(error)return reject(Error('屏幕设置未能完成，请重试'));try{resolve(JSON.parse(stdout.trim()));}catch{reject(Error('屏幕设置结果无效，请重试'));}}));}
 read(name){try{return JSON.parse(fs.readFileSync(path.join(this.dir,name+'.json'),'utf8'));}catch{return null;}}
 poll(){if(this.timer||this.stopped)return;this.timer=setInterval(()=>void this.tick(),30000);this.timer.unref?.();}
 async start(){if(this.platform!=='win32'||!this.read('installed'))return;try{await this.install();}catch{}if(this.stopped)return;this.poll();await this.tick();}
 async install(){if(!this.installing)this.installing=this.run('Install').then(result=>{this.registered=!!result.registered;return result;}).finally(()=>{this.installing=null;});return this.installing;}
 night(){if(this.pending)return this.pending;this.pending=this.enterNight().finally(()=>{this.pending=null;});return this.pending;}
 async enterNight(){if(this.platform!=='win32')throw Error('此操作仅支持 Windows');if(!this.registered)await this.install();if(!this.registered)throw Error('早晨自动恢复未能设置，请重试');this.poll();this.notice({kind:'bedtime-action',text:NIGHT,scene:'sleepy',expiresAt:Date.now()+15000});const result=await this.run('Night');if(result.timeoutMinutes!==1)throw Error('未能将熄屏时间设为1分钟');return result;}
 tick(){if(this.checking||this.pending||this.stopped||(!this.registered&&!this.read('installed')))return this.checking;this.checking=this.checkMorning().catch(()=>{}).finally(()=>{this.checking=null;});return this.checking;}
 async checkMorning(){const now=this.now(),today=day(now);if(now.getHours()<8)return;let result=this.read('morning');const night=this.read('night'),late=night&&day(new Date(night.at))===today&&new Date(night.at).getHours()>=8;
  if(result?.day!==today&&!late){if(this.retryAt&&+now<this.retryAt)return;this.retryAt=+now+300000;await this.run('Morning');result=this.read('morning');}
  if(this.stopped||!result?.changed||result.day!==today||this.state.get('lastNotified')===today||!this.canNotify())return;
  this.notice({kind:'bedtime-morning',text:MORNING,scene:'notification',expiresAt:Date.now()+20000});this.state.set('lastNotified',today);
 }
 stop(){this.stopped=true;clearInterval(this.timer);}
}
module.exports={Bedtime,day,NIGHT,MORNING};
