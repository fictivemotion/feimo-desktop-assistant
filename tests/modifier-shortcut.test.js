'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
test('modifier detector observes complete chords without keyboard hooks or input injection',{skip:process.platform!=='win32'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-chord-')),fixture=path.join(dir,'Check.cs'),exe=path.join(dir,'Check.exe');
 fs.writeFileSync(fixture,`using System;class Check {
 static void Yes(bool b,string name){if(!b)throw new Exception(name);}
 static void Main(){var c=new ModifierShortcut.Chord();
 Yes(!c.Step(true,false,false,0),"ctrl alone");Yes(!c.Step(true,true,false,20),"hold chord");Yes(!c.Step(false,true,false,60),"partial release");Yes(c.Step(false,false,false,70),"toggle after full release");
 c.Step(true,true,false,90);Yes(!c.Step(false,false,false,140),"debounce");
 c.Step(true,true,false,400);c.Step(true,true,true,430);Yes(!c.Step(false,false,false,480),"Ctrl Alt other is not dictation");
 c.Step(true,true,true,800);Yes(!c.Step(false,false,false,900),"AltGr or held on startup rejected");
 c.Step(true,true,false,1100);Yes(!c.Step(false,false,false,3101),"long hold rejected");
 c.Step(false,true,false,3400);c.Step(true,true,false,3410);Yes(c.Step(false,false,false,3460),"Alt then Ctrl");
 c.Step(true,false,false,4000);c.Step(false,false,false,4200);c.Step(false,true,false,4300);Yes(!c.Step(false,false,false,4400),"separate modifiers rejected");
 Console.WriteLine("passed");}}`);
 try{const source=path.resolve(__dirname,'../lib/voice/modifier-shortcut.cs');assert.doesNotMatch(fs.readFileSync(source,'utf8'),/SetWindowsHookEx|SendInput|keybd_event|BlockInput/);
 execFileSync(path.join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/main:Check','/out:'+exe,source,fixture],{windowsHide:true});assert.match(execFileSync(exe,[],{encoding:'utf8',windowsHide:true}),/passed/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
