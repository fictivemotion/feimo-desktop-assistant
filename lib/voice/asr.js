'use strict';
const {Worker}=require('node:worker_threads');const path=require('node:path');const {randomUUID}=require('node:crypto');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function wav(samples){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);samples.forEach((v,i)=>b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));return b;}
function mergeText(previous,next){if(!previous)return next;if(!next)return previous;for(let n=Math.min(previous.length,next.length,100);n>1;n--)if(previous.slice(-n)===next.slice(0,n))return previous+next.slice(n);return previous+( /[a-z0-9]$/i.test(previous)&&/^[a-z0-9]/i.test(next)?' ':'')+next;}
class LocalAsr{
  constructor(dir,onText,onError){this.dir=dir;this.onText=onText;this.onError=onError;this.ready=deferred();this.final=deferred();this.final.promise.catch(()=>{});this.ended=false;}
  async start(){
    this.worker=new Worker(path.join(__dirname,'recognizer-worker.js'),{workerData:{dir:this.dir}});
    this.worker.on('message',m=>{if(m.type==='ready')this.ready.resolve();if(m.type==='text')this.onText(m.text);if(m.type==='final'){this.ended=true;this.final.resolve(m.text);}if(m.type==='error')this.fail(new Error(m.message));});
    this.worker.on('error',()=>this.fail(new Error('离线语音进程发生错误')));this.worker.on('exit',code=>{if(!this.ended&&code!==0)this.fail(new Error('离线语音进程已退出'));});
    const timer=setTimeout(()=>this.fail(new Error('离线模型加载超时')),30000);try{await this.ready.promise;}finally{clearTimeout(timer);}
  }
  fail(e){this.ready.reject(e);this.final.reject(e);if(!this.ended)this.onError(e);}
  accept(samples){if(!this.ended)this.worker?.postMessage({type:'audio',samples},[samples.buffer]);}
  async finish(){this.worker?.postMessage({type:'finish'});const timer=setTimeout(()=>this.final.reject(new Error('识别结束超时')),15000);try{return await this.final.promise;}finally{clearTimeout(timer);}}
  close(){this.ended=true;this.worker?.terminate();this.worker=null;}
}
class CapsAsr{
  constructor(config,key,onText,onError){this.config=config;this.key=key;this.onText=onText;this.onError=onError;this.task=randomUUID();this.final=deferred();this.final.promise.catch(()=>{});this.text='';this.started=Date.now()/1000;this.ended=false;}
  async start(){const WebSocket=require('ws');this.ws=new WebSocket(this.config.capsUrl,{headers:this.key?{Authorization:`Bearer ${this.key}`}:{},maxPayload:1024*1024,handshakeTimeout:10000});await new Promise((resolve,reject)=>{this.ws.once('open',resolve);this.ws.once('error',()=>reject(new Error('无法连接 CapsWriter 服务，请检查地址和服务状态')));});
    this.ws.on('error',()=>{if(!this.ended){const e=new Error('CapsWriter 连接异常');this.final.reject(e);this.onError(e);}});
    this.ws.on('close',()=>{if(!this.ended){const e=new Error('CapsWriter 服务断开连接');this.final.reject(e);this.onError(e);}});
    this.ws.on('message',raw=>{let m;try{m=JSON.parse(raw.toString())}catch{return}if(m.task_id!==this.task)return;if(typeof m.text==='string'){this.text=m.text;this.onText(m.text);}if(m.is_final){this.ended=true;this.final.resolve(this.text);}});
  }
  send(samples,final){if(this.ws?.readyState!==1)throw new Error('CapsWriter 连接未准备好');if(this.ws.bufferedAmount>4*1024*1024)throw new Error('识别服务处理过慢，请检查网络');this.ws.send(JSON.stringify({task_id:this.task,source:'mic',data:Buffer.from(samples.buffer,samples.byteOffset,samples.byteLength).toString('base64'),is_final:final,time_start:this.started,seg_duration:2,seg_overlap:.25,context:'',language:this.config.language||'auto'}));}
  accept(samples){this.send(samples,false);}
  async finish(){this.send(new Float32Array(0),true);const timer=setTimeout(()=>this.final.reject(new Error('CapsWriter 最终识别超时')),20000);try{return await this.final.promise;}finally{clearTimeout(timer);}}
  close(){this.ended=true;this.ws?.terminate();}
}
class CloudAsr{
  constructor(config,key,onText,onError){this.config=config;this.key=key;this.onText=onText;this.onError=onError;this.parts=[];this.count=0;this.text='';this.queue=Promise.resolve();this.controller=new AbortController();this.ended=false;this.queued=0;}
  async start(){if(!this.config.asrUrl)throw new Error('请先填写云端语音识别接口地址');}
  accept(samples){this.parts.push(samples);this.count+=samples.length;if(this.count>=16000*3)this.submit();}
  submit(){if(!this.count)return;const samples=new Float32Array(this.count);let offset=0;for(const p of this.parts){samples.set(p,offset);offset+=p.length;}this.parts=[];this.count=0;if(++this.queued>10)throw new Error('云端识别响应过慢，请稍后重试');
    this.queue=this.queue.then(async()=>{if(this.ended)return;const form=new FormData();form.append('file',new Blob([wav(samples)],{type:'audio/wav'}),'dictation.wav');form.append('model',this.config.asrModel||'whisper-1');if(this.config.language!=='auto'&&this.config.language)form.append('language',this.config.language);if(this.config.hotwords)form.append('prompt',this.config.hotwords.slice(0,1000));
      const signal=AbortSignal.any([this.controller.signal,AbortSignal.timeout(30000)]);
      const response=await fetch(this.config.asrUrl.replace(/\/$/,'')+'/audio/transcriptions',{method:'POST',headers:this.key?{Authorization:`Bearer ${this.key}`}:{},body:form,signal});
      if(!response.ok)throw new Error(`云端语音识别失败 HTTP ${response.status}`);
      const result=await response.json();if(typeof result.text!=='string')throw new Error('语音接口未返回识别文本');if(!this.ended){this.text=mergeText(this.text,result.text.trim());this.onText(this.text);}
    }).finally(()=>{this.queued--;});this.queue.catch(e=>{if(!this.ended)this.onError(new Error(e.name==='TimeoutError'?'云端语音识别超时':e.message));});
  }
  async finish(){this.submit();await this.queue;return this.text;}
  close(){this.ended=true;this.controller.abort();this.parts=[];}
}
function createAsr(config,{dir,key,onText,onError,connectOptions}){return config.backend==='qwen'?new (require('./qwen').QwenAsr)(config,key,onText,onError,connectOptions):config.backend==='capswriter'?new CapsAsr(config,key,onText,onError):config.backend==='cloud'?new CloudAsr(config,key,onText,onError):new LocalAsr(dir,onText,onError);}
module.exports={createAsr,LocalAsr,CapsAsr,CloudAsr,wav,mergeText};
