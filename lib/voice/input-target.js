'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {spawn,execFile}=require('node:child_process');const {promisify}=require('node:util');
class InputTarget{
  constructor(dir){this.dir=dir;this.process=null;this.pending=new Map();this.id=0;this.starting=null;}
  async prepare(){
    if(this.process&&!this.process.killed)return;
    if(this.starting)return this.starting;
    this.starting=this.start().finally(()=>{this.starting=null});return this.starting;
  }
  async start(){
    if(process.platform!=='win32')throw new Error('全局语音输入仅支持 Windows');
    fs.mkdirSync(this.dir,{recursive:true});const source=fs.readFileSync(path.join(__dirname,'input-target.cs'));
    const hash=crypto.createHash('sha256').update(source).digest('hex').slice(0,16),file=path.join(this.dir,`input-${hash}.exe`);
    if(!fs.existsSync(file)){
      const src=path.join(this.dir,`input-${hash}.cs`);fs.writeFileSync(src,source);
      const framework=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319');
      try{await promisify(execFile)(path.join(framework,'csc.exe'),['/nologo','/target:exe',`/out:${file}`,`/r:${path.join(framework,'WPF','UIAutomationClient.dll')}`,`/r:${path.join(framework,'WPF','UIAutomationTypes.dll')}`,`/r:${path.join(framework,'WPF','WindowsBase.dll')}`,`/r:${path.join(framework,'System.Web.Extensions.dll')}`,src],{windowsHide:true,timeout:30000});}catch{throw new Error('Windows 输入组件无法初始化，请检查 .NET Framework 4.8 是否可用');}
    }
    const child=spawn(file,[],{windowsHide:true,stdio:['pipe','pipe','pipe']});this.process=child;let buffer='';
    child.stdout.setEncoding('utf8');child.stdout.on('data',part=>{buffer+=part;let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);try{const msg=JSON.parse(line);const p=this.pending.get(msg.id);if(p){clearTimeout(p.timer);this.pending.delete(msg.id);p.resolve(msg.result);}}catch{}}});
    child.stderr.resume();
    const close=()=>{if(this.process===child)this.process=null;for(const[id,p]of this.pending){if(p.child!==child)continue;clearTimeout(p.timer);p.reject(new Error('Windows 输入服务已停止'));this.pending.delete(id);}};
    child.on('exit',close);child.on('error',close);
  }
  async command(command,text){await this.prepare();const id=++this.id,child=this.process;const timeout=command==='update'?Math.min(30000,8000+String(text||'').length*10):8000;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('目标输入框响应超时'));if(this.process===child)this.close();},timeout);this.pending.set(id,{resolve,reject,timer,child});child.stdin.write(JSON.stringify({id,command,text})+'\n','utf8',error=>{if(!error)return;clearTimeout(timer);this.pending.delete(id);reject(new Error('Windows 输入服务已停止'));});});}
  capture(){return this.command('capture');}update(text){return this.command('update',text);}release(){return this.process?this.command('release'):Promise.resolve({ok:true});}
  close(){this.process?.kill();this.process=null;}
}
module.exports={InputTarget};
