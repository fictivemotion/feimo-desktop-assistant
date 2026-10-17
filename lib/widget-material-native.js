'use strict';
const path=require('node:path'),{spawn}=require('node:child_process'),readline=require('node:readline');
// Set only the owning widget's DWM theme; changing nativeTheme.themeSource would
// recolor every assistant window. JSON is data, never executable PowerShell.
class WidgetMaterialNative{
 constructor(dir){this.dir=dir;this.jobs=new Map();this.seq=0;this.closed=false;}
 start(){if(this.ready)return this.ready;const file=require('./native-script').nativeScript(path.join(__dirname,'widget-material-native.ps1'),this.dir);this.ready=new Promise(resolve=>{this.resolveReady=resolve;});this.child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  this.startTimer=setTimeout(()=>{this.resolveReady(false);this.stop();},5000);this.startTimer.unref?.();
  readline.createInterface({input:this.child.stdout}).on('line',line=>{try{const value=JSON.parse(line);if(value.ready){clearTimeout(this.startTimer);this.resolveReady(true);return;}const job=this.jobs.get(value.id);if(job){this.jobs.delete(value.id);clearTimeout(job.timer);job.resolve(value.ok===true);}}catch{}});
  this.child.stderr.on('data',()=>{});this.child.stdin.on('error',()=>{});const closed=()=>{clearTimeout(this.startTimer);this.child=null;this.resolveReady(false);for(const job of this.jobs.values()){clearTimeout(job.timer);job.resolve(false);}this.jobs.clear();};this.child.on('error',closed);this.child.on('exit',closed);return this.ready;
 }
 async apply(win,dark,radius){try{if(this.closed||win.isDestroyed())return false;const handle=win.getNativeWindowHandle().readBigUInt64LE().toString();if(!await this.start()||this.closed||win.isDestroyed())return false;return new Promise(resolve=>{const id=++this.seq,timer=setTimeout(()=>{this.jobs.delete(id);resolve(false);},3000);timer.unref?.();this.jobs.set(id,{resolve,timer});this.child?.stdin.write(JSON.stringify({id,handle,pid:process.pid,dark:!!dark,rounded:radius>0})+'\n');});}catch{return false;}}
 stop(){this.closed=true;clearTimeout(this.startTimer);this.resolveReady?.(false);this.child?.kill();for(const job of this.jobs.values()){clearTimeout(job.timer);job.resolve(false);}this.jobs.clear();}
}
module.exports={WidgetMaterialNative};
