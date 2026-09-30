'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const REVISION='8e40c43232a1c5c66c82111efc5820d3accca11b';
const FILES=[
  {name:'encoder.int8.onnx',size:165462184,sha:'81a70226a8934e6ed92aa1d4fc486b428b5398e2f2619ed4897b7294cab90e9a'},
  {name:'decoder.int8.onnx',size:71664561,sha:'f3cca9f77bb9d93c8fcbfb63ae617b6b1ee96818df3aa3b151c40658fe38594f'},
  {name:'tokens.txt',size:75756},
];
class VoiceModels {
  constructor(dir,{onChange=()=>{},fetcher=fetch}={}) { this.dir=dir;this.onChange=onChange;this.fetcher=fetcher;this.progress=null;this.controller=null; }
  state(){return {ready:FILES.every(f=>{try{return fs.statSync(path.join(this.dir,f.name)).size===f.size&&!!this.manifest()?.[f.name]}catch{return false}}),progress:this.progress,size:FILES.reduce((n,f)=>n+f.size,0)};}
  manifest(){try{return JSON.parse(fs.readFileSync(path.join(this.dir,'verified.json'),'utf8'))}catch{return null}}
  async install(){
    if(this.controller)throw new Error('模型正在下载');
    this.controller=new AbortController();const signal=this.controller.signal;
    fs.mkdirSync(this.dir,{recursive:true});const verified=this.manifest()||{};let received=0;const total=FILES.reduce((n,f)=>n+f.size,0);
    this.progress={file:FILES[0].name,received:0,total,percent:0};this.onChange(this.state());
    try{
      for(const f of FILES){
        const dest=path.join(this.dir,f.name), temp=dest+'.part';
        if(fs.existsSync(dest)&&fs.statSync(dest).size===f.size&&verified[f.name]){received+=f.size;continue;}
        const res=await this.fetcher(`https://huggingface.co/csukuangfj/sherpa-onnx-streaming-paraformer-bilingual-zh-en/resolve/${REVISION}/${f.name}`,{signal});
        if(!res.ok||!res.body)throw new Error(`模型下载失败 HTTP ${res.status}`);
        const hash=crypto.createHash('sha256');let count=0, last=0;const handle=await fs.promises.open(temp,'w');
        try{for await(const chunk of res.body){if(signal.aborted)throw new Error('下载已取消');count+=chunk.length;if(count>f.size)throw new Error('模型大小不匹配');hash.update(chunk);await handle.write(chunk);if(Date.now()-last>180){last=Date.now();this.progress={file:f.name,received:received+count,total,percent:Math.floor((received+count)/total*100)};this.onChange(this.state());}}}finally{await handle.close();}
        const sha=hash.digest('hex');if(count!==f.size||(f.sha&&sha!==f.sha))throw new Error('模型完整性校验失败，请重新下载');
        fs.renameSync(temp,dest);verified[f.name]=sha;received+=count;fs.writeFileSync(path.join(this.dir,'verified.json'),JSON.stringify(verified));
      }
      this.progress=null;return this.state();
    }finally{this.controller=null;this.progress=null;this.onChange(this.state());}
  }
  cancel(){this.controller?.abort();}
}
module.exports={VoiceModels,FILES,REVISION};
