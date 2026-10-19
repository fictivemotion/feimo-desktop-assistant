'use strict';
// Restrict our own HWND before a pending move is committed. Correcting it in a
// later activity tick leaves a visible AppBar/focus bounce on every activation.
let pinTypes;
class IslandEdgePin{
 constructor(win){
  const k=this.k=require('koffi'),u=k.load('user32.dll'),c=k.load('comctl32.dll');
  this.hwnd=win.getNativeWindowHandle().readBigUInt64LE();const pid=[0],thread=u.func('uint32_t GetWindowThreadProcessId(void *, _Out_ uint32_t *)')(this.hwnd,pid);
  if(pid[0]!==process.pid||thread!==k.load('kernel32.dll').func('uint32_t GetCurrentThreadId()')())throw Error('Island edge guard requires its owning UI thread');
  this.pos=(pinTypes?.pos)||k.struct({hwnd:'void *',after:'void *',x:'int32_t',y:'int32_t',cx:'int32_t',cy:'int32_t',flags:'uint32_t'});
  const proto=pinTypes?.proto||k.proto('intptr_t __stdcall FeimoIslandEdgeSubclass(void *, uint32_t, uintptr_t, intptr_t, uintptr_t, uintptr_t)');
  pinTypes={pos:this.pos,proto};
  this.next=c.func('intptr_t __stdcall DefSubclassProc(void *, uint32_t, uintptr_t, intptr_t)');this.remove=c.func('int32_t __stdcall RemoveWindowSubclass(void *, void *, uintptr_t)');
  this.callback=k.register((hwnd,message,wparam,lparam)=>{const result=this.next(hwnd,message,wparam,lparam);if(message===0x46&&this.target&&!this.closed){try{const p=k.decode(lparam,this.pos);if(!(p.flags&2)){p.x=this.target.x;p.y=this.target.y;k.encode(lparam,this.pos,p);}}catch{}}return result;},k.pointer(proto));
  if(!c.func('int32_t __stdcall SetWindowSubclass(void *, void *, uintptr_t, uintptr_t)')(this.hwnd,this.callback,0xFE1901,0)){k.unregister(this.callback);throw Error('Unable to install island edge guard');}
 }
 setTarget(point){if(Number.isFinite(point.x)&&Number.isFinite(point.y))this.target={x:Math.round(point.x),y:Math.round(point.y)};}
 dispose(){if(this.closed)return;this.closed=true;try{this.remove(this.hwnd,this.callback,0xFE1901);}catch{}const callback=this.callback;setImmediate(()=>this.k.unregister(callback)).unref?.();}
}
module.exports={IslandEdgePin};
