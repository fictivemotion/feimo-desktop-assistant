'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{JsonLines}=require('./ocr-transport');
class FastOcr {
 constructor(base,{spawnProcess=spawn,idleMs=90000}={}){this.base=base;this.spawn=spawnProcess;this.jobs=new Map();this.seq=0;this.generation=0;this.idle=new(require('./idle-release').IdleRelease)({delay:idleMs,busy:()=>!!this.pending||this.jobs.size>0,release:()=>this.stop()});}
 installed(){return fs.existsSync(path.join(this.base,'feimo-ocr.exe'))||fs.existsSync(path.join(this.base,'Scripts','python.exe'));}
 async ensure(){this.idle.cancel();if(this.ready){this.idle.arm();return;}if(this.pending)return this.pending;if(!this.installed())throw Error('快速本机 OCR 尚未部署，请在设置中打开部署指引');
  const generation=++this.generation,standalone=fs.existsSync(path.join(this.base,'feimo-ocr.exe'));let args=[];
  if(!standalone){fs.mkdirSync(this.base,{recursive:true});const script=path.join(this.base,'feimo-worker.py');fs.copyFileSync(path.join(__dirname,'..','assets','scripts','rapid-ocr-worker.py'),script);args=['-u',script];}
  const child=this.spawn(path.join(this.base,standalone?'feimo-ocr.exe':'Scripts/python.exe'),args,{cwd:this.base,windowsHide:true,stdio:['pipe','pipe','ignore'],env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONUTF8:'1',OMP_NUM_THREADS:'4'}});this.child=child;
  this.pending=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.stop();reject(Error('快速 OCR 加载超时，请检查模型下载是否完成'));},90000);let settled=false;
   const fail=error=>{clearTimeout(timer);if(!settled){settled=true;reject(error);}if(generation!==this.generation)return;this.ready=false;this.idle.cancel();for(const j of this.jobs.values()){j.cleanup();j.reject(error);}this.jobs.clear();};this.cancelLoading=error=>fail(error);
   const lines=new JsonLines(data=>{if(generation!==this.generation)return;if(Object.hasOwn(data,'ready')){if(data.ready){clearTimeout(timer);settled=true;this.ready=true;resolve();}else{fail(Error(data.error||'快速 OCR 加载失败'));child.kill();}return;}const job=this.jobs.get(data.id);if(job){this.jobs.delete(data.id);job.cleanup();data.error?job.reject(Error(data.error)):job.resolve(data.result);this.idle.arm();}});
   child.stdout.on('data',chunk=>{try{lines.push(chunk);}catch(error){fail(error);child.kill();}});
   child.on('error',fail);child.on('exit',()=>{if(this.child===child)this.child=null;fail(Error('快速 OCR 服务已停止，请重试'));});child.stdin.on('error',()=>{});
  });try{await this.pending;}finally{if(generation===this.generation){this.pending=null;this.cancelLoading=null;if(this.ready)this.idle.arm();}}
 }
 async extract({bytes,kind,signal,onProgress=()=>{}}){signal?.throwIfAborted();onProgress(this.ready?'正在识别…':'正在加载快速本机 OCR…');const abortLoading=()=>this.stop();signal?.addEventListener('abort',abortLoading,{once:true});try{await this.ensure();}finally{signal?.removeEventListener('abort',abortLoading);}signal?.throwIfAborted();onProgress(kind==='formula'?'正在识别公式…':kind==='table'?'正在恢复表格结构…':'正在识别文字…');
  this.idle.cancel();return new Promise((resolve,reject)=>{const id=++this.seq,timer=setTimeout(()=>{this.stop();reject(Error('本机 OCR 超时，请缩小选区后重试'));},kind==='formula'?30000:20000),abort=()=>{this.jobs.delete(id);clearTimeout(timer);reject(signal.reason||Error('识别已取消'));this.stop();};const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};this.jobs.set(id,{resolve,reject,cleanup});signal?.addEventListener('abort',abort,{once:true});try{this.child.stdin.write(JSON.stringify({id,kind,image:bytes.toString('base64')})+'\n');}catch(error){this.stop();reject(error);}});
 }
 async status(){return{installed:this.installed(),connected:!!this.ready,ready:!!this.ready,model:'RapidOCR / SLANet-plus / LaTeX-OCR'};}
 stop(){this.idle.cancel();this.cancelLoading?.(Error('识别已停止'));this.cancelLoading=null;this.generation++;this.ready=false;this.pending=null;const child=this.child;this.child=null;child?.kill();for(const j of this.jobs.values()){j.cleanup();j.reject(Error('识别已停止'));}this.jobs.clear();}
}
module.exports={FastOcr};
