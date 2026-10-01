'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
test('native writer reconciles the observed empty Chromium placeholder without discarding existing text',{skip:process.platform!=='win32'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-native-regression-'));
 const fixture=path.join(dir,'Regression.cs'),exe=path.join(dir,'Regression.exe');
 fs.writeFileSync(fixture,`using System;
class NativeVoiceRegression {
 static void Check(bool result,string scenario){if(!result)throw new Exception(scenario);}
 static void Main(){
  // Captured from a real empty Codex composer: virtual prefix=4, suffix=1,
  // followed by a real two-character document after SendInput.
  Check(FeimoInput.IsPlaceholder("随心输入\\n","随心输入","",""),"Codex placeholder");
  Check(FeimoInput.IsPlaceholder("Ask anything\\n","Ask anything","",""),"English placeholder");
  Check(FeimoInput.IsPlaceholder("询问任何问题","","询问任何问题",""),"help-text placeholder");
  Check(!FeimoInput.IsPlaceholder("正文","随心输入","",""),"preserve existing content");
  Check(!FeimoInput.IsPlaceholder("随心输入","随心输入","","随心输入"),"preserve explicit selection");
  Check(FeimoInput.CanRebasePlaceholder(true,true,"测试","测试"),"first actual keystrokes");
  Check(FeimoInput.CanRebasePlaceholder(true,true,"测试\\n","测试"),"virtual paragraph terminator");
  Check(!FeimoInput.CanRebasePlaceholder(true,true,"随心输入测试\\n","测试"),"ordinary append preserves prefix");
  Check(!FeimoInput.CanRebasePlaceholder(false,true,"测试","测试"),"never discard a later user edit");
  Check(!FeimoInput.CanRebasePlaceholder(true,false,"测试","测试"),"unproven placeholder must not rebase");
  Check(!FeimoInput.CanRebasePlaceholder(true,true,"另一个正文","测试"),"unrelated edit must not rebase");
  Console.WriteLine("native placeholder regression passed");
 }
}`);
 try{
  const framework=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319');
  execFileSync(path.join(framework,'csc.exe'),['/nologo','/target:exe','/main:NativeVoiceRegression','/out:'+exe,...['UIAutomationClient.dll','UIAutomationTypes.dll','WindowsBase.dll'].map(n=>'/r:'+path.join(framework,'WPF',n)),'/r:'+path.join(framework,'System.Web.Extensions.dll'),path.resolve(__dirname,'../lib/voice/input-target.cs'),fixture],{windowsHide:true});
  assert.match(execFileSync(exe,[],{encoding:'utf8',windowsHide:true}),/regression passed/);
 }finally{if(path.dirname(dir)===os.tmpdir()&&path.basename(dir).startsWith('feimo-native-regression-'))fs.rmSync(dir,{recursive:true,force:true});}
});
