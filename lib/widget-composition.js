'use strict';
// Clip an application-owned Composition brush, not the separate rectangular
// DWM system backdrop (which ignores CSS border-radius and SetWindowRgn).
// ABI: Microsoft Windows.UI.Composition and ICompositorDesktopInterop.
const IID={compositor:'b403ca50-7f8c-4e83-985f-cc45060036d8',host:'c9dd8ef0-6eb1-4e3c-a658-675d9c64d4ab',shapes:'48ea31ad-7fcd-4076-a79c-90cc4b852c9b',clips:'7a38b2bd-cec8-4eeb-830f-d8d07aedebc3',wallpaper:'0d8fb190-f122-5b8d-9fdd-543b0d8eb7f3',desktop:'29e691fa-4567-4dca-b319-d0f207eb6807',target:'a1bea8ba-d726-4663-8129-6b5e7927ffa6',visual:'117e202d-a859-4c89-873b-c2aa566788e3',brush:'ab0d7608-30c0-40e9-b568-b60a6bd1fb46',geometry:'e985217c-6a17-4207-abd8-5fd3dd612a9d',clip:'1ccd2a52-cfc7-4ace-9983-146bb8eb6a3c',closable:'30d5a829-7fa4-4026-83bb-d75bae4ea99e'};
function geometryFor(width,height,dpi,radius){const scale=Math.max(1,Number.isFinite(dpi)?dpi/96:1);return {width,height,radius:Math.min(Math.max(0,Math.min(48,Number.isFinite(radius)?radius:32))*scale,width/2,height/2)};}
function guid(value){const b=Buffer.from(value.replaceAll('-',''),'hex'),result=Buffer.from(b);result.writeUInt32LE(b.readUInt32BE(0),0);result.writeUInt16LE(b.readUInt16BE(4),4);result.writeUInt16LE(b.readUInt16BE(6),6);return result;}
let runtime;
function getRuntime(){
 if(runtime)return runtime;
 if(process.platform!=='win32'||process.arch!=='x64')throw Error('Windows x64 composition required');
 const k=require('koffi'),vec=k.struct({x:'float',y:'float'}),rect=k.struct({left:'int32_t',top:'int32_t',right:'int32_t',bottom:'int32_t'}),queueOptions=k.struct({size:'uint32_t',thread:'int32_t',apartment:'int32_t'}),protos=new Map(),typeIds=new Map();
 function call(pointer,index,types=[],args=[],result='int32_t'){
  const key=result+':'+types.map(t=>{if(typeof t==='string')return t;if(!typeIds.has(t))typeIds.set(t,typeIds.size);return '#'+typeIds.get(t);}).join(',');
  if(!protos.has(key))protos.set(key,k.proto(result,['void *',...types]));
  return k.call(k.decode(k.decode(pointer,'void *'),index*8,'void *'),protos.get(key),pointer,...args);
 }
 function check(hr,label){if(hr<0)throw Error(label+' (0x'+(hr>>>0).toString(16)+')');}
 function get(refs,pointer,index,types=[],args=[]){const out=[null];check(call(pointer,index,[...types,'_Out_ void **'],[...args,out]),'Windows composition');if(!out[0])throw Error('Composition brush unavailable');refs.push(out[0]);return out[0];}
 const qi=(refs,pointer,id)=>get(refs,pointer,0,['void *'],[guid(id)]),release=refs=>{for(const pointer of refs.splice(0).reverse())call(pointer,2,[],[],'uint32_t');};
 const user=k.load('user32.dll'),dwm=k.load('dwmapi.dll'),base=k.load('combase.dll');
 const api={getOwner:user.func('GetWindowThreadProcessId','uint32_t',['void *',k.out(k.pointer('uint32_t'))]),getRect:user.func('GetClientRect','int32_t',['void *',k.out(k.pointer(rect))]),getDpi:user.func('uint32_t GetDpiForWindow(void *hwnd)'),dpi:user.func('void *SetThreadDpiAwarenessContext(void *context)'),region:user.func('int32_t SetWindowRgn(void *hwnd, void *region, int32_t redraw)'),attribute:dwm.func('int32_t DwmSetWindowAttribute(void *hwnd, int32_t attribute, int32_t *value, uint32_t size)'),createString:base.func('int32_t WindowsCreateString(str16 value, uint32_t length, _Out_ void **result)'),deleteString:base.func('int32_t WindowsDeleteString(void *value)'),activate:base.func('int32_t RoActivateInstance(void *name, _Out_ void **instance)')};
 // A single controller on Electron's existing UI thread, retained until exit.
 // No child windows, screen capture, input hooks, or foreground activation.
 const queue=[null];check(k.load('CoreMessaging.dll').func('CreateDispatcherQueueController','int32_t',[queueOptions,k.out(k.pointer('void *'))])({size:12,thread:2,apartment:2},queue),'Composition dispatcher');
 runtime={k,vec,api,call,check,get,qi,release,queue:queue[0]};return runtime;
}
class WidgetComposition{
 constructor(){
  this.rt=getRuntime();this.refs=[];this.windows=new Map();const {api,qi,check}=this.rt,h=[null],instance=[null],name='Windows.UI.Composition.Compositor';
  try{check(api.createString(name,name.length,h),'Composition name');check(api.activate(h[0],instance),'Composition activation');this.refs.push(instance[0]);for(const key of ['compositor','host','shapes','clips','desktop','wallpaper'])this[key]=qi(this.refs,instance[0],IID[key]);}
  catch(error){this.rt.release(this.refs);throw error;}finally{if(h[0])api.deleteString(h[0]);}
 }
 configure(win,dark,material){
  const {api,check}=this.rt,hwnd=win.getNativeWindowHandle().readBigUInt64LE(),owner=[0];api.getOwner(hwnd,owner);if(owner[0]!==process.pid)throw Error('Window owner mismatch');
  // Clearing DWM alone preserves Electron's translucent compositor. Calling
  // Electron setBackgroundMaterial('none') would make its pixels opaque.
  for(const [attribute,value]of [[38,1],[17,material==='none'?0:1],[20,dark?1:0],[33,1],[34,-2]])check(api.attribute(hwnd,attribute,[value],4),'Window appearance');
  api.region(hwnd,null,1);return hwnd;
 }
 create(win,hwnd){
  const {get,qi,call,check}=this.rt,refs=[];
  try{
   const target=get(refs,this.desktop,3,['void *','int32_t'],[hwnd,0]),targetI=qi(refs,target,IID.target),sprite=get(refs,this.compositor,22),visual=qi(refs,sprite,IID.visual),rounded=get(refs,this.shapes,20),geometry=qi(refs,rounded,IID.geometry),geometricClip=get(refs,this.clips,7,['void *'],[geometry]),clip=qi(refs,geometricClip,IID.clip);
   check(call(visual,15,['void *'],[clip]),'Background clip');
   const record={refs,target,targetI,sprite,visual,rounded,geometry,geometricClip,clip,brushes:{},material:'none'};this.windows.set(win,record);return record;
  }catch(error){this.rt.release(refs);throw error;}
 }
 apply(win,dark,radius,material){
  const hwnd=this.configure(win,dark,material),{api,call,check,get,qi,vec}=this.rt;let record=this.windows.get(win);
  if(material==='none'){if(record){check(call(record.targetI,7,['void *'],[null]),'Hide background');record.material='none';}return true;}
  if(!record)record=this.create(win,hwnd);
  const previous=api.dpi(-4n),bounds={};let shape;
  try{if(!api.getRect(hwnd,bounds))throw Error('Window bounds unavailable');shape=geometryFor(bounds.right-bounds.left,bounds.bottom-bounds.top,api.getDpi(hwnd),radius);}finally{api.dpi(previous);}
  // Physical pixels match Chromium CSS at each monitor's DPI. The compositor
  // antialiases the curve; no stair-step rectangle mask replaces the CSS edge.
  const size={x:shape.width,y:shape.height};check(call(record.rounded,11,[vec],[size]),'Background size');check(call(record.rounded,7,[vec],[{x:shape.radius,y:shape.radius}]),'Background radius');check(call(record.visual,36,[vec],[size]),'Visual size');
  check(call(record.visual,11,['int32_t'],[0]),'Soft background edge');
  const kind=material==='acrylic'?'host':'wallpaper';if(!record.brushes[kind])record.brushes[kind]=qi(record.refs,get(record.refs,this[kind],6),IID.brush);
  check(call(record.sprite,7,['void *'],[record.brushes[kind]]),'Background brush');check(call(record.targetI,7,['void *'],[record.visual]),'Background root');record.material=material;return true;
 }
 inspect(win){
  const record=this.windows.get(win);if(!record)return null;const {call,vec,check,k,qi,release}=this.rt,radius={},size={},refs=[];
  check(call(record.rounded,6,[k.out(k.pointer(vec))],[radius]),'Read radius');check(call(record.rounded,10,[k.out(k.pointer(vec))],[size]),'Read size');
  const same=(pointer,index,expected)=>{const out=[null];check(call(pointer,index,['_Out_ void **'],[out]),'Read visual tree');if(out[0])refs.push(out[0]);if(!out[0]||!expected)return !out[0]&&!expected;return qi(refs,out[0],'00000000-0000-0000-c000-000000000046')===qi(refs,expected,'00000000-0000-0000-c000-000000000046');};
  try{return {material:record.material,radius:radius.x,size:{width:size.x,height:size.y},brush:record.material==='acrylic'?'host':'wallpaper',clipped:same(record.visual,14,record.clip)&&same(record.geometricClip,6,record.geometry),attached:same(record.targetI,6,record.material==='none'?null:record.visual)};}finally{release(refs);}
 }
 remove(win){
  const record=this.windows.get(win);if(!record)return;this.windows.delete(win);try{this.rt.call(record.targetI,7,['void *'],[null]);}catch{}
  const close=[];try{this.rt.call(this.rt.qi(close,record.target,IID.closable),6);}catch{}finally{this.rt.release(close);this.rt.release(record.refs);}
 }
 stop(){for(const win of this.windows.keys())this.remove(win);this.rt.release(this.refs);}
}
function clearBackdrop(win){
 if(win.isDestroyed())return;const k=require('koffi'),hwnd=win.getNativeWindowHandle().readBigUInt64LE(),user=k.load('user32.dll'),owner=[0];
 user.func('uint32_t GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *owner)')(hwnd,owner);if(owner[0]!==process.pid)return;
 const set=k.load('dwmapi.dll').func('int32_t DwmSetWindowAttribute(void *hwnd, int32_t attribute, int32_t *value, uint32_t size)');set(hwnd,38,[1],4);set(hwnd,17,[0],4);
}
module.exports={WidgetComposition,geometryFor,clearBackdrop};
