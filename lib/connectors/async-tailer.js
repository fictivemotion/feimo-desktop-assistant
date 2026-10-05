'use strict';
const fs = require('node:fs');
const path = require('node:path');
const CHUNK = 256 * 1024;
const yieldLoop = () => new Promise(resolve => setImmediate(resolve));
// Bounded history replay keeps Electron's tray, windows and IPC responsive.
class FileTailer {
  constructor({root, include, onLines, debounceMs = 400}) {
    Object.assign(this, {root, include:include || (()=>true), onLines, debounceMs});
    this.offsets = new Map(); this.pending = new Map(); this.reading = new Set();
    this.again = new Set(); this.available = false; this.stopped = false;
  }
  start() {
    this.stopped = false;
    try {
      fs.mkdirSync(this.root, {recursive:true});
      // Use the long canonical path: Windows recursive watchers can abort on 8.3 aliases.
      this.root = fs.realpathSync.native(this.root);
      this.watcher = fs.watch(this.root, {recursive:true}, (_event, name) => {
        if(name){const file=path.join(this.root,String(name));if(this.include(file))this._debounce(file);}
      });
      this.watcher.on('error',()=>{this.available=false;}); this.available=true;
      this.ready=this._scanExisting().catch(()=>{this.available=false;});
    } catch {this.ready=Promise.resolve();}
    return this;
  }
  async _scanExisting() {
    const dirs=[this.root];
    while(dirs.length&&!this.stopped){
      const dir=dirs.shift();let entries;
      try{entries=await fs.promises.readdir(dir,{withFileTypes:true});}catch{continue;}
      for(const e of entries){
        if(this.stopped)return;
        const file=path.join(dir,e.name);
        if(e.isDirectory())dirs.push(file);else if(this.include(file))await this._readNew(file,true);
        await yieldLoop();
      }
    }
  }
  _debounce(file){clearTimeout(this.pending.get(file));this.pending.set(file,setTimeout(()=>{this.pending.delete(file);void this._readNew(file,!this.offsets.has(file));},this.debounceMs));}
  async _readNew(file,first=false){
    if(this.stopped)return;
    if(this.reading.has(file)){this.again.add(file);return;}
    this.reading.add(file);let handle;
    try{
      handle=await fs.promises.open(file,'r');const st=await handle.stat();
      let from=this.offsets.get(file)??0;if(st.size<from){from=0;first=true;}
      const end=st.size,buf=Buffer.alloc(CHUNK);let carry=Buffer.alloc(0),pendingFrom=from;
      while(from<end&&!this.stopped){
        const {bytesRead}=await handle.read(buf,0,Math.min(CHUNK,end-from),from);if(!bytesRead)break;
        from+=bytesRead;const combined=Buffer.concat([carry,buf.subarray(0,bytesRead)]),nl=combined.lastIndexOf(10);
        if(nl>=0){
          const lines=combined.subarray(0,nl).toString('utf8').split('\n').map(x=>x.trim()).filter(Boolean);
          pendingFrom+=nl+1;this.offsets.set(file,pendingFrom);carry=Buffer.from(combined.subarray(nl+1));
          this.replaying=first;
          try{if(lines.length)this.onLines(file,lines,first);}catch{/* A malformed record cannot disable monitoring. */}
          finally{this.replaying=false;}
        }else{carry=combined;if(carry.length>8*1024*1024)throw new Error('Log record too large');}
        await yieldLoop();
      }
      if(!this.offsets.has(file))this.offsets.set(file,0);
    }catch(error){if(error.code==='ENOENT')this.offsets.delete(file);}
    finally{await handle?.close().catch(()=>{});this.reading.delete(file);if(this.again.delete(file)&&!this.stopped)this._debounce(file);}
  }
  stop(){this.stopped=true;this.watcher?.close();for(const t of this.pending.values())clearTimeout(t);this.pending.clear();}
}
module.exports={FileTailer};
