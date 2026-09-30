'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const {spawn,execFile}=require('node:child_process');const {promisify}=require('node:util');
const isModifierShortcut=s=>/^Ctrl\+Alt$/i.test(String(s).replace(/\s/g,''));
class ModifierShortcut{
 constructor(dir,onToggle){Object.assign(this,{dir,onToggle});this.child=null;this.ready=false;this.starting=null;this.generation=0;}
 async enable(){if(this.ready)return;if(this.starting)return this.starting;this.starting=this.start().finally(()=>{this.starting=null});return this.starting;}
 async start(){
  const token=this.generation;
  fs.mkdirSync(this.dir,{recursive:true});const source=fs.readFileSync(path.join(__dirname,'modifier-shortcut.cs')),hash=crypto.createHash('sha256').update(source).digest('hex').slice(0,16),file=path.join(this.dir,`modifier-${hash}.exe`);
  if(!fs.existsSync(file)){const src=file+'.cs';fs.writeFileSync(src,source);await promisify(execFile)(path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/target:exe',`/out:${file}`,src],{windowsHide:true,timeout:30000});}
  if(token!==this.generation)throw new Error('快捷键监听已取消');
  const child=spawn(file,[],{windowsHide:true,stdio:['ignore','pipe','ignore']});this.child=child;let buffer='';
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(new Error('Ctrl + Alt 快捷键监听启动超时'));},5000);child.stdout.setEncoding('utf8');child.stdout.on('data',s=>{buffer+=s;let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n).trim();buffer=buffer.slice(n+1);if(line==='ready'){clearTimeout(timer);this.ready=true;resolve();}else if(line==='toggle'&&this.ready)this.onToggle();else if(line==='error'){clearTimeout(timer);reject(new Error('Ctrl + Alt 快捷键监听不可用'));}}});child.on('error',()=>{clearTimeout(timer);reject(new Error('快捷键组件无法启动'));});child.on('exit',()=>{clearTimeout(timer);if(this.child===child){this.child=null;this.ready=false;}reject(new Error('快捷键组件已停止'));});});
 }
 disable(){this.generation++;this.ready=false;this.child?.kill();this.child=null;}
}
module.exports={ModifierShortcut,isModifierShortcut};
