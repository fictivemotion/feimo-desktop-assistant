'use strict';
const path=require('node:path'),{spawn}=require('node:child_process'),readline=require('node:readline');
// A per-process helper; a failed launch may be retried without touching system settings.
class WidgetMaterialNative{
 constructor(dir){this.dir=dir;this.jobs=new Map();this.seq=0;this.closed=false;}
 start(){
  if(this.closed)return Promise.resolve(false);if(this.ready)return this.ready;
  const file=require('./native-script').nativeScript(path.join(__dirname,'widget-material-native.ps1'),this.dir);
  let resolveReady;this.ready=new Promise(resolve=>{resolveReady=resolve;});
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file],{windowsHide:true,stdio:['pipe','pipe','pipe']});this.child=child;
  const timer=setTimeout(()=>{resolveReady(false);child.kill();cleanup();},5000);timer.unref?.();
  const cleanup=()=>{clearTimeout(timer);resolveReady(false);if(this.child!==child)return;this.child=null;this.ready=null;for(const job of this.jobs.values()){clearTimeout(job.timer);job.resolve(false);}this.jobs.clear();};this.cleanup=cleanup;
  readline.createInterface({input:child.stdout}).on('line',line=>{try{const value=JSON.parse(line);if(value.ready){clearTimeout(timer);resolveReady(true);return;}const job=this.jobs.get(value.id);if(job){this.jobs.delete(value.id);clearTimeout(job.timer);job.resolve(value.ok===true);}}catch{}});
  child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});child.on('error',cleanup);child.on('exit',cleanup);return this.ready;
 }
 async apply(win,dark,radius,material='none'){
  try{if(this.closed||win.isDestroyed())return false;const handle=win.getNativeWindowHandle().readBigUInt64LE().toString();if(!await this.start()||this.closed||win.isDestroyed()||!this.child)return false;
   return new Promise(resolve=>{const id=++this.seq,timer=setTimeout(()=>{this.jobs.delete(id);resolve(false);},3000);timer.unref?.();this.jobs.set(id,{resolve,timer});this.child.stdin.write(JSON.stringify({id,handle,pid:process.pid,dark:!!dark,rounded:radius>0,material})+'\n');});
  }catch{return false;}
 }
 stop(){this.closed=true;this.child?.kill();this.cleanup?.();}
}
module.exports={WidgetMaterialNative};
