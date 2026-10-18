'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
function audioHeader(bytes){return bytes.length>=12&&((bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE')||bytes.toString('ascii',0,3)==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224));}
class SoundscapeCache{
 constructor({directory,sounds,fetcher=fetch,maxBytes=128*1024*1024,fileLimit=16*1024*1024,timeout=15000}){Object.assign(this,{directory,fetcher,maxBytes,fileLimit,timeout});this.sounds=new Map(sounds.map(s=>[s.id,s]));this.pending=new Map();this.protected=new Set();this.queue=[];this.running=0;}
 file(id){const s=this.sounds.get(id);if(!s)throw Error('未找到白噪音音源');return path.join(this.directory,crypto.createHash('sha256').update(s.audioUrl).digest('hex')+path.extname(new URL(s.audioUrl).pathname));}
 keep(ids){this.protected=new Set(ids.map(id=>this.file(id)));}
 source(id,refresh=false){
  if(!this.sounds.has(id))return Promise.reject(Error('未找到白噪音音源'));
  if(this.pending.has(id))return this.pending.get(id);
  const task=new Promise((resolve,reject)=>{this.queue.push({run:()=>this.load(id,refresh),resolve,reject});this.drain();}).finally(()=>this.pending.delete(id));
  this.pending.set(id,task);return task;
 }
 drain(){while(this.running<2&&this.queue.length){const job=this.queue.shift();this.running++;job.run().then(job.resolve,job.reject).finally(()=>{this.running--;this.drain();});}}
 async load(id,refresh){
  const file=this.file(id);await fs.mkdir(this.directory,{recursive:true});
  if(!refresh){try{const stat=await fs.stat(file);if(stat.size>12&&stat.size<=this.fileLimit){await fs.utimes(file,new Date(),new Date()).catch(()=>{});return pathToFileURL(file).href;}}catch{}}
  for(let attempt=0;attempt<2;attempt++){
   const temp=file+'.'+crypto.randomUUID()+'.tmp';let handle,response;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeout);timer.unref?.();
   try{
    response=await this.fetcher(this.sounds.get(id).audioUrl,{signal:controller.signal,cache:'no-store'});
    if(response.status!==200)throw Error('音源服务器返回异常（'+response.status+'）');
    const declared=Number(response.headers.get('content-length'));if(declared>this.fileLimit)throw Error('音源文件超出大小限制');
    handle=await fs.open(temp,'wx');let size=0,header=Buffer.alloc(0);
    for await(const value of response.body){const bytes=Buffer.from(value);size+=bytes.length;if(size>this.fileLimit)throw Error('音源文件超出大小限制');if(header.length<12)header=Buffer.concat([header,bytes.subarray(0,12-header.length)]);await handle.writeFile(bytes);}
    if(!audioHeader(header)||size<13||(declared>0&&declared!==size))throw Error('音源文件不完整或格式异常');
    await handle.close();handle=null;await fs.rename(temp,file);await this.trim(file).catch(()=>{});return pathToFileURL(file).href;
   }catch(error){controller.abort();await response?.body?.cancel().catch(()=>{});await handle?.close().catch(()=>{});await fs.rm(temp,{force:true}).catch(()=>{});if(attempt===1){const failure=Error(error.name==='AbortError'?'音源下载超时，请稍后重试':error.message==='fetch failed'?'音源服务器暂时无法连接，请稍后重试':error.message);failure.code='SOUNDSCAPE_SOURCE';throw failure;}}
   finally{clearTimeout(timer);}
  }
 }
 async trim(current){
  const files=[];for(const name of await fs.readdir(this.directory)){if(!/^[a-f0-9]{64}\.(mp3|wav)$/.test(name))continue;const file=path.join(this.directory,name),stat=await fs.stat(file).catch(()=>null);if(stat)files.push({file,size:stat.size,time:stat.mtimeMs});}
  let size=files.reduce((n,f)=>n+f.size,0);for(const f of files.sort((a,b)=>a.time-b.time)){if(size<=this.maxBytes)break;if(f.file===current||this.protected.has(f.file))continue;try{await fs.unlink(f.file);size-=f.size;}catch{}}
 }
}
module.exports={SoundscapeCache,audioHeader};
