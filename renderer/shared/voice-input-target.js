'use strict';
(()=>{
 let target=null,child=null;
 const editable=n=>n instanceof HTMLTextAreaElement||n instanceof HTMLInputElement&&['text','search','url','email','tel'].includes(n.type);
 function capture(){release();const n=document.activeElement;
  if(n instanceof HTMLIFrameElement){try{const helper=n.contentWindow.FeimoVoiceInput;if(helper){const result=helper.capture();if(result.ok)child=helper;return result;}}catch{} }
  if(!editable(n)||n.disabled||n.readOnly)return {ok:false,message:'未选中可编辑输入框，使用剪贴板听写'};
  target={node:n,prefix:n.value.slice(0,n.selectionStart),suffix:n.value.slice(n.selectionEnd),owned:n.value.slice(n.selectionStart,n.selectionEnd)};return {ok:true,kind:'renderer'};
 }
 function update(text){if(child)return child.update(text);const t=target,n=t?.node;
  if(!n?.isConnected||document.activeElement!==n||n.disabled||n.readOnly)return {ok:false,message:'输入框已切换，结果会复制到剪贴板'};
  if(n.value!==t.prefix+t.owned+t.suffix||!((n.selectionStart===t.prefix.length+t.owned.length&&n.selectionEnd===n.selectionStart)||(n.selectionStart===t.prefix.length&&n.selectionEnd===t.prefix.length+t.owned.length)))return {ok:false,message:'输入框已被编辑，结果会复制到剪贴板'};
  n.setRangeText(String(text),t.prefix.length,t.prefix.length+t.owned.length,'end');t.owned=String(text);n.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));return {ok:true};
 }
 function release(){child?.release();child=null;target=null;return {ok:true};}
 window.FeimoVoiceInput={capture,update,release};
})();
