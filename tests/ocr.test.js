'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),sharp=require('sharp');
const {OcrService}=require('../lib/ocr');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'feimo-ocr-test-'));
test('OCR bridge executes a physical script outside asar and omits empty auto-language arguments',async()=>{
 const dir=temp();try{const s=new OcrService({workDir:dir});assert.ok(fs.existsSync(s.script));assert.equal(path.dirname(s.script),dir);
 s._runPowerShell=async args=>{assert.ok(!args.includes('-Lang'));const image=await sharp(args[args.indexOf('-ImagePath')+1]).metadata();assert.equal(image.width,80);fs.writeFileSync(args[args.indexOf('-OutFile')+1],JSON.stringify({ok:true,language:'zh-Hans-CN',lines:[{text:'测试',x:5,y:6,w:20,h:12}]}))};
 const r=await s.recognize(await sharp({create:{width:80,height:40,channels:4,background:'#fff'}}).png().toBuffer());assert.equal(r.lines[0].text,'测试');assert.equal(r.width,80);assert.deepEqual(fs.readdirSync(dir),['windows-ocr.ps1']);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('oversized OCR images really shrink and boxes use prepared image coordinates',async()=>{
 const dir=temp();try{const s=new OcrService({workDir:dir});s._runPowerShell=async args=>{const meta=await sharp(args[args.indexOf('-ImagePath')+1]).metadata();assert.equal(meta.width,4096);fs.writeFileSync(args[args.indexOf('-OutFile')+1],JSON.stringify({ok:true,lines:[{text:'文字',x:100,y:10,w:30,h:12}]}))};const r=await s.recognize(await sharp({create:{width:5000,height:100,channels:3,background:'#fff'}}).png().toBuffer());assert.equal(r.width,4096);assert.equal(r.lines[0].x,100);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('OCR language errors stay distinct from process failures and temporary image data is removed',async()=>{
 const dir=temp();try{const s=new OcrService({workDir:dir});s._runPowerShell=async args=>{assert.equal(args.at(-1),'en');fs.writeFileSync(args[args.indexOf('-OutFile')+1],JSON.stringify({ok:false,error:'NO_LANGPACK: en'}))};await assert.rejects(s.recognize(await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).png().toBuffer(),'en'),e=>e.code==='NO_LANGPACK');assert.deepEqual(fs.readdirSync(dir),['windows-ocr.ps1']);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
