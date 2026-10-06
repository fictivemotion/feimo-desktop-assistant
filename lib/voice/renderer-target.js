'use strict';
// Only our own trusted renderer windows are eligible. External apps retain UIA ownership checks.
class RendererTarget {
  constructor(native, focused){this.native=native;this.focused=focused;this.owner=null;}
  prepare(){return this.native.prepare();}
  owns(contents){return this.owner===contents;}
  async capture(){
    this.owner=null;const contents=this.focused();
    if(!contents)return this.native.capture();
    const result=await contents.executeJavaScript('window.FeimoVoiceInput?.capture() || {ok:false,message:"请点击可编辑输入框"}');
    if(result.ok)this.owner=contents;
    return result;
  }
  async update(text){
    if(!this.owner)return this.native.update(text);
    if(this.owner.isDestroyed()||this.focused()!==this.owner)return {ok:false,message:'输入框已切换，结果会复制到剪贴板'};
    return this.owner.executeJavaScript('window.FeimoVoiceInput.update('+JSON.stringify(text)+')');
  }
  async release(){const owner=this.owner;this.owner=null;if(owner&&!owner.isDestroyed())await owner.executeJavaScript('window.FeimoVoiceInput?.release()').catch(()=>{});return this.native.release();}
  close(){void this.release().catch(()=>{});this.native.close();}
}
module.exports={RendererTarget};
