'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
// An existing user-owned Ollama is reused. Only the process started here is
// stopped with Feimo; models never live inside the installer or repository.
class CaptureRuntime{
 constructor({fetcher=fetch,base=path.join(process.env.LOCALAPPDATA||'', 'Feimo','model-runtime')}={}){this.fetcher=fetcher;this.base=base;this.child=null;this.pending=null;}
 async ping(url){try{const r=await this.fetcher(url.replace(/\/v1\/?$/,'')+'/api/tags',{signal:AbortSignal.timeout(1500)});return r.ok?await r.json():null;}catch{return null;}}
 async ensure(cfg){if(cfg.backend!=='xiaomi'||cfg.transport!=='ollama')return;if(this.pending)return this.pending;this.pending=this._ensure(cfg);try{return await this.pending;}finally{this.pending=null;}}
 async _ensure(cfg){let state=await this.ping(cfg.localUrl);if(!state){const u=new URL(cfg.localUrl),exe=path.join(this.base,'ollama','ollama.exe');if(!['127.0.0.1','localhost'].includes(u.hostname)||u.port!=='11434'||!fs.existsSync(exe))throw Error('本机 OCR 服务未启动，请先按设置中的部署指引下载模型');if(!this.child){fs.mkdirSync(this.base,{recursive:true});this.child=spawn(exe,['serve'],{windowsHide:true,stdio:'ignore',env:{...process.env,OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_MODELS:path.join(this.base,'models'),OLLAMA_KEEP_ALIVE:'5m',OLLAMA_VULKAN:'1'}});this.child.on('error',()=>{});this.child.on('exit',()=>{this.child=null;});}for(let i=0;i<30&&!state;i++){await new Promise(r=>setTimeout(r,200));state=await this.ping(cfg.localUrl);}}
 if(!state)throw Error('本机 OCR 服务启动失败');if(!state.models?.some(m=>m.name===cfg.localModel||m.model===cfg.localModel))throw Error('本机未下载 '+cfg.localModel+'，请先下载模型');return true;}
 async status(cfg){const state=await this.ping(cfg.localUrl);return{installed:fs.existsSync(path.join(this.base,'ollama','ollama.exe')),connected:!!state,ready:!!state?.models?.some(m=>m.name===cfg.localModel||m.model===cfg.localModel),model:cfg.localModel};}
 stop(){this.child?.kill();this.child=null;}
}
module.exports={CaptureRuntime};
