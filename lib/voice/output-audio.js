'use strict';
const {InputTarget}=require('./input-target'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn,execFile}=require('child_process'),{promisify}=require('util');
class OutputAudio extends InputTarget{
 constructor(dir){super(dir);this.serial=Promise.resolve();}
 async start(){
  if(process.platform!=='win32')throw Error('系统输出静音仅支持 Windows');
  fs.mkdirSync(this.dir,{recursive:true});const source=fs.readFileSync(path.join(__dirname,'output-audio.cs')),hash=crypto.createHash('sha256').update(source).digest('hex').slice(0,16),file=path.join(this.dir,'output-'+hash+'.exe');
  if(!fs.existsSync(file)){const src=path.join(this.dir,'output-'+hash+'.cs');fs.writeFileSync(src,source);const framework=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET','Framework64','v4.0.30319');await promisify(execFile)(path.join(framework,'csc.exe'),['/nologo','/target:exe','/out:'+file,'/r:'+path.join(framework,'System.Web.Extensions.dll'),src],{windowsHide:true,timeout:30000});}
  const child=spawn(file,[],{windowsHide:true,stdio:['pipe','pipe','ignore']});this.process=child;let buffer='';child.stdout.setEncoding('utf8');child.stdout.on('data',part=>{buffer+=part;let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);try{const m=JSON.parse(line),p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);p.resolve(m.result);}}catch{}}});
  const close=()=>{if(this.process===child)this.process=null;for(const [id,p]of this.pending)if(p.child===child){clearTimeout(p.timer);this.pending.delete(id);p.reject(Error('输出声音控制服务已停止'));}};child.on('error',close);child.on('exit',close);
 }
 lease(command){const result=this.serial.then(()=>this.command(command));this.serial=result.catch(()=>{});return result.then(r=>{if(!r.ok)throw Error(r.message||'无法恢复输出声音');return r;});}
 begin(){return this.lease('begin');}
 end(){return this.process?this.lease('end'):Promise.resolve({ok:true});}
 // Closing stdin triggers the native finally block, including when the app crashes.
 close(){const child=this.process;if(child){child.stdin.end();this.process=null;}}
}
module.exports={OutputAudio};
