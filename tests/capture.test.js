'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {CaptureVision,config,imageBuffer}=require('../lib/capture-vision'),{CaptureHost}=require('../lib/capture-host'),{Toolbox}=require('../lib/toolbox');
const sharp=require('sharp');
test('OTSL tables preserve empty cells, pipe characters and merged cells',()=>{
 const {tableOutput}=require('../lib/capture-table');assert.equal(tableOutput('<fcel>Name<fcel>Count<nl><fcel>Apple<ecel><nl>'),'| Name | Count |\n| --- | --- |\n| Apple |  |');assert.match(tableOutput('<fcel>Header<lcel><nl><fcel>A<fcel>12<nl>'),/colspan="2"/);assert.throws(()=>tableOutput('<ucel><fcel>Bad<nl>'),/不完整/);
});
const png=async()=> 'data:image/png;base64,'+(await sharp({create:{width:64,height:64,channels:3,background:'#fff'}}).png().toBuffer()).toString('base64');
test('capture rejects nonlocal endpoints, credentials, malformed images and invalid transport',()=>{
 assert.equal(config().backend,'xiaomi');assert.throws(()=>config({localUrl:'https://external.example'}));assert.throws(()=>config({url:'http://external.example'}));assert.throws(()=>config({localUrl:'http://user:secret@localhost:11434'}));assert.throws(()=>config({transport:'shell'}));assert.throws(()=>imageBuffer('data:image/png;base64,AAAA'));
});
test('Xiaomi requests stay local and disable thinking; cleaning receives only recognized text',async()=>{
 let called,cleaned;const v=new CaptureVision({settings:{get:()=>({backend:'xiaomi'})},getSecret:()=>{throw Error('local should not read key');},cleaner:{clean:async(text)=>{cleaned=text;return{output:'整理后的正文'};}},fetcher:async(url,options)=>{called={url,body:JSON.parse(options.body)};return{ok:true,json:async()=>({message:{content:'木\n桶'},done_reason:'stop'})};}});
 assert.equal(await v.extract({image:await png(),kind:'clean'}),'整理后的正文');assert.equal(cleaned,'木\n桶');assert.equal(called.url,'http://127.0.0.1:11434/api/chat');assert.equal(called.body.think,false);assert.equal(called.body.messages[0].images.length,1);assert.equal(called.body.options.num_predict,8192);
});
test('truncation and model failure never claim complete extraction',async()=>{
 const v=new CaptureVision({settings:{get:()=>({backend:'xiaomi'})},fetcher:async()=>({ok:true,json:async()=>({message:{content:'half'},done_reason:'length'})})});await assert.rejects(v.extract({image:await png(),kind:'formula'}),/过长/);
});
test('translation preserves local OCR bounds and sends text only',async()=>{
 let source;const v=new CaptureVision({settings:{get:()=>({backend:'xiaomi'})},ocr:{recognize:async()=>({width:200,height:100,lines:[{text:'Hello',x:10,y:20,w:100,h:30}]})},translateText:async(lines)=>{source=lines;return ['你好'];},fetcher:()=>{throw Error('no image upload');}});
 const result=await v.extract({image:await png(),kind:'translate'});assert.deepEqual(source,[{id:0,text:'Hello'}]);assert.deepEqual(result.regions,[{x:50,y:200,w:500,h:300,text:'你好'}]);
});
test('capture IPC rejects untrusted senders and closes all display overlays on cancellation',async()=>{
 const handlers={},host=new CaptureHost({electron:{ipcMain:{handle:(n,fn)=>handlers[n]=fn}},overlays:()=>[],toolbox:()=>{},settings:{get:()=>({})}});host.register();await assert.rejects(handlers['capture:init']({sender:{}}),/此窗口/);
 let closed=0,restored=0;const win={webContents:{},isDestroyed:()=>false,destroy:()=>closed++};host.windows.set(win,{image:'synthetic'});host.active=true;host.hidden=[{isDestroyed:()=>false,showInactive:()=>restored++}];await handlers['capture:cancel']({sender:win.webContents});assert.equal(closed,1);assert.equal(restored,1);assert.equal(host.active,false);
});
test('middle popup clamps to cursor display and dismisses outside clicks without hooks',async()=>{
 let bounds,hidden=0;const popup={isDestroyed:()=>false,setFocusable:()=>{},setBounds:b=>bounds=b,webContents:{reload:()=>{}},showInactive:()=>{},isVisible:()=>true,hide:()=>hidden++,getBounds:()=>bounds};const screen={getCursorScreenPoint:()=>({x:1900,y:1050}),getDisplayNearestPoint:()=>({workArea:{x:0,y:0,width:1920,height:1080}})};const host=new CaptureHost({electron:{screen},settings:{get:()=>({middleHold:true})}});host.popup=popup;await host.showClipboard();assert.deepEqual(bounds,{x:1550,y:590,width:370,height:490});screen.getCursorScreenPoint=()=>({x:0,y:0});host.outsideClick();assert.equal(hidden,1);
 const script=fs.readFileSync(path.join(__dirname,'../lib/middle-pointer.ps1'),'utf8');assert.match(script,/-ge 500/);assert.match(script,/GetAsyncKeyState/);assert.doesNotMatch(script,/SetWindowsHookEx|SendInput|BlockInput/);
});
test('large screenshots can be saved in encrypted history and remain bounded',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-capture-test-'));try{const b=new Toolbox(path.join(dir,'clips'),{encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()});const image='data:image/png;base64,'+'A'.repeat(4000001);assert.equal(b.capture({kind:'image',dataUrl:image}).status,'saved');assert.equal(b.view().clips[0].kind,'image');assert.equal(b.capture({kind:'image',dataUrl:'data:image/png;base64,'+'A'.repeat(24000001)}).status,'large');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
