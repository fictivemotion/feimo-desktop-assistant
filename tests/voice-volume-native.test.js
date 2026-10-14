'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
test('native session isolation keeps volume stable, preserves mute snapshots, and restores sessions',{skip:process.platform!=='win32'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-volume-regression-')),exe=path.join(dir,'VolumeRegression.exe');
 try{const framework=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET','Framework64','v4.0.30319');execFileSync(path.join(framework,'csc.exe'),['/nologo','/target:exe','/main:VolumeRestoreRegression','/out:'+exe,'/r:'+path.join(framework,'System.Web.Extensions.dll'),path.resolve(__dirname,'../lib/voice/output-audio.cs'),path.resolve(__dirname,'fixtures/volume-restore.cs')],{windowsHide:true,timeout:30000});assert.match(execFileSync(exe,[],{encoding:'utf8',windowsHide:true}),/volume lease restoration passed/);}finally{if(path.dirname(dir)===os.tmpdir()&&path.basename(dir).startsWith('feimo-volume-regression-'))fs.rmSync(dir,{recursive:true,force:true});}
});
