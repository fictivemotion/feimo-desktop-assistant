'use strict';
// Read complete byte frames before decoding. Frozen Windows workers from older
// installers emitted CP936/GBK despite PYTHONIOENCODING being set by the parent.
function decodeLine(bytes,encoding='utf-8'){
 let text;try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch(error){if(encoding!=='utf-8')throw Error('本机 OCR 输出编码无效，请重新启动识别');encoding='gb18030';try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{throw Error('本机 OCR 输出编码无效，请重新启动识别');}}
 text=text.trim();if(!text.startsWith('{'))return {message:null,encoding};
 let message;try{message=JSON.parse(text);}catch{throw Error('本机 OCR 返回的数据格式无效，请重新识别');}
 if(message.protocol==='json-ascii-v1')encoding='utf-8';return {message,encoding};
}
class JsonLines{
 constructor(onMessage,{maxBytes=8*1024*1024}={}){this.onMessage=onMessage;this.maxBytes=maxBytes;this.pending=Buffer.alloc(0);this.encoding='utf-8';}
 push(chunk){this.pending=Buffer.concat([this.pending,Buffer.from(chunk)]);let end;while((end=this.pending.indexOf(10))!==-1){if(end>this.maxBytes)throw Error('OCR 结果过大，请缩小选区');const bytes=this.pending.subarray(0,end);this.pending=this.pending.subarray(end+1);const {message,encoding}=decodeLine(bytes,this.encoding);this.encoding=encoding;if(message)this.onMessage(message);}if(this.pending.length>this.maxBytes)throw Error('OCR 结果过大，请缩小选区');}
}
module.exports={decodeLine,JsonLines};
