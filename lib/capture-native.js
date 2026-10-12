'use strict';
const path=require('node:path'),{spawn}=require('node:child_process'),readline=require('node:readline');
class RegionCapture{
 constructor(dir){this.dir=dir;this.jobs=new Map();this.seq=0;}
 start(){if(this.child)return this.ready;const file=require('./native-script').nativeScript(path.join(__dirname,'capture-native.ps1'),this.dir);this.ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});this.child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  readline.createInterface({input:this.child.stdout}).on('line',line=>{try{const result=JSON.parse(line);if(result.ready){this.resolveReady();return;}const job=this.jobs.get(result.id);if(!job)return;this.jobs.delete(result.id);clearTimeout(job.timer);result.error?job.reject(Error(result.error)):job.resolve(result.image);}catch{}});
  this.child.stderr.on('data',()=>{});const closed=()=>{this.child=null;this.rejectReady?.(Error('原始像素截图服务未启动'));for(const job of this.jobs.values()){clearTimeout(job.timer);job.reject(Error('截图服务已停止'));}this.jobs.clear();};this.child.on('exit',closed);this.child.on('error',closed);this.child.stdin.on('error',()=>{});return this.ready;
 }
 async capture(bounds){await this.start();return new Promise((resolve,reject)=>{const id=++this.seq,timer=setTimeout(()=>{this.jobs.delete(id);reject(Error('截图超时，请重新选择'));},5000);this.jobs.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,...bounds})+'\n');});}
 stop(){this.child?.kill();}
}
module.exports={RegionCapture};
