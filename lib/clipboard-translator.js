'use strict';
// Watch only while explicitly enabled. New copies supersede older requests;
// the translated clipboard write is ignored to prevent translation loops.
class ClipboardTranslator{
 constructor({read,write,translate,notice,changed=()=>{}}){Object.assign(this,{read,write,translate,notice,changed});this.enabled=false;this.generation=0;this.last='';this.ownOutput=null;}
 state(){return{enabled:this.enabled,busy:!!this.controller};}
 async start(){if(this.enabled)return this.state();this.last=await this.read();this.enabled=true;this.notice('翻译官已就位🫡，复制文本自动翻译到剪贴板');this.changed();this.timer=setInterval(()=>void this.poll(),300);this.timer.unref?.();return this.state();}
 stop(){this.enabled=false;this.generation++;this.controller?.abort();this.controller=null;clearInterval(this.timer);this.notice('翻译官下班了👋');this.changed();return this.state();}
 async poll(){if(!this.enabled||this.polling)return;this.polling=true;let text;try{text=await this.read();}catch{return;}finally{this.polling=false;}if(!this.enabled||typeof text!=='string'||text===this.last)return;this.last=text;if(text===this.ownOutput){this.ownOutput=null;return;}this.ownOutput=null;this.controller?.abort();this.controller=null;const generation=++this.generation;if(!text.trim())return;const controller=new AbortController();this.controller=controller;this.changed();this.notice('收到，翻译中...🧐');
 try{const output=await this.translate(text,controller.signal);if(!this.enabled||generation!==this.generation||controller.signal.aborted)return;
  // Preserve a newer copy even when it arrives between the latest poll and completion.
  if(await this.read()!==text){this.controller=null;this.changed();return;}
  this.ownOutput=output;await this.write(output);this.last=output;this.notice('翻译完成已加入剪贴板，请直接粘贴👌');
 }catch(error){if(this.enabled&&generation===this.generation&&!controller.signal.aborted)this.notice('翻译失败，原文已保留。'+error.message);}
 finally{if(generation===this.generation){this.controller=null;this.changed();}}
 }
 dispose(){this.enabled=false;this.generation++;clearInterval(this.timer);this.controller?.abort();this.controller=null;}
}
module.exports={ClipboardTranslator};
