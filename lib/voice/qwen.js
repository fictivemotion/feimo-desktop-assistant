'use strict';
const {randomUUID}=require('node:crypto');const WebSocket=require('ws');const {parseWords}=require('./hotwords');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});promise.catch(()=>{});return {promise,resolve,reject};}
function pcm16(samples){const data=Buffer.alloc(samples.length*2);for(let i=0;i<samples.length;i++)data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),i*2);return data;}
class QwenAsr{
  constructor(config,key,onText,onError,connectOptions=async()=>({})){Object.assign(this,{config,key,onText,onError,connectOptions});this.ready=deferred();this.final=deferred();this.task=randomUUID();this.parts=new Map();this.last='';this.closed=false;this.finished=false;this.samples=0;this.realtime=/^qwen3-asr-.*realtime/.test(config.qwenModel);}
  endpoint(){const url=new URL(this.config.qwenUrl);if(this.realtime){url.pathname=url.pathname.replace(/\/inference$/,'/realtime');url.searchParams.set('model',this.config.qwenModel);}return url.toString();}
  async start(){
    if(!this.key)throw new Error('请先在斐墨语音中填写 Qwen API 密钥');
    const options=await this.connectOptions(this.endpoint());if(this.closed)return;
    this.ws=new WebSocket(this.endpoint(),{...options,headers:{Authorization:`Bearer ${this.key}`,'OpenAI-Beta':'realtime=v1'},maxPayload:1024*1024,handshakeTimeout:12000});
    this.ws.on('open',()=>{if(this.realtime)this.send({event_id:randomUUID(),type:'session.update',session:{modalities:['text'],input_audio_format:'pcm',sample_rate:16000,input_audio_transcription:{...(this.config.language==='auto'?{}:{language:this.config.language})},turn_detection:{type:'server_vad',threshold:.2,silence_duration_ms:500}}});else{
      const vocabulary=Object.fromEntries(parseWords(this.config.hotwords).slice(0,200).map(w=>[w.target,3]));
      this.send({header:{action:'run-task',task_id:this.task,streaming:'duplex'},payload:{task_group:'audio',task:'asr',function:'recognition',model:this.config.qwenModel,parameters:{format:'pcm',sample_rate:16000,vocabulary,...(this.config.language==='auto'?{}:{language_hints:[this.config.language]}),...(this.config.qwenModel.includes('3.1')?{vad_model:'near_meeting_16k'}:{max_sentence_silence:600})},input:{}}});
    }});
    this.ws.on('message',raw=>{let m;try{m=JSON.parse(raw.toString())}catch{return}this.message(m);});
    this.ws.on('error',e=>this.fail(new Error(/401/.test(e.message)?'Qwen 密钥无效或地域不匹配':/403/.test(e.message)?'Qwen 服务未授权，请在百炼控制台检查模型权限':'无法连接 Qwen 实时语音服务')));
    this.ws.on('close',()=>{if(!this.closed&&!this.finished)this.fail(new Error('Qwen 实时识别连接已断开'));});
    const timer=setTimeout(()=>this.fail(new Error('Qwen 识别服务启动超时')),16000);try{await this.ready.promise;}finally{clearTimeout(timer);}
  }
  message(m){
    if(this.closed)return;
    if(m.type==='error'||m.type==='conversation.item.input_audio_transcription.failed'||m.header?.event==='task-failed'){
      const code=String(m.error?.code||m.header?.error_code||'');const model=/model|invalidparameter|notfound/i.test(code+' '+(m.header?.error_message||m.error?.message||''));this.fail(new Error(model?'Qwen 模型不可用，请检查模型名称、地域或业务空间地址':`Qwen 识别失败${code?'（'+code.slice(0,64)+'）':''}`));return;
    }
    if(m.type==='session.updated'||m.header?.event==='task-started')this.ready.resolve();
    if(this.realtime){
      if(m.type==='conversation.item.input_audio_transcription.text')this.parts.set(m.item_id||'current',String(m.text||'')+String(m.stash||''));
      if(m.type==='conversation.item.input_audio_transcription.completed')this.parts.set(m.item_id||'current',String(m.transcript||''));
      if(m.type==='session.finished'){this.finished=true;this.final.resolve(this.text());}
    }else{
      if(m.header?.task_id&&m.header.task_id!==this.task)return;
      const sentence=m.payload?.output?.sentence||m.payload?.output?.output?.sentence;
      if(m.header?.event==='result-generated'&&sentence&&!sentence.heartbeat){const key=String(sentence.sentence_id??sentence.begin_time??this.parts.size);this.parts.set(key,String(sentence.text||''));}
      if(m.header?.event==='task-finished'){this.finished=true;this.final.resolve(this.text());}
    }
    const text=this.text();if(text!==this.last){this.last=text;this.onText(text);}
  }
  text(){let output='';for(const part of this.parts.values())output+=(/[a-z0-9]$/i.test(output)&&/^[a-z0-9]/i.test(part)?' ':'')+part;return output;}
  send(message){if(this.ws?.readyState!==WebSocket.OPEN)throw new Error('Qwen 连接未准备好');if(this.ws.bufferedAmount>4*1024*1024)throw new Error('Qwen 音频发送积压，请检查网络');this.ws.send(typeof message==='object'&&!Buffer.isBuffer(message)?JSON.stringify(message):message);}
  accept(samples){if(this.closed)return;this.samples+=samples.length;const pcm=pcm16(samples);this.send(this.realtime?{event_id:randomUUID(),type:'input_audio_buffer.append',audio:pcm.toString('base64')}:pcm);}
  async finish(){if(this.closed)throw new Error('Qwen 连接已关闭');this.send(this.realtime?{event_id:randomUUID(),type:'session.finish'}:{header:{action:'finish-task',task_id:this.task,streaming:'duplex'},payload:{input:{}}});const timer=setTimeout(()=>this.final.reject(new Error('Qwen 最终转写超时')),20000);try{return await this.final.promise;}finally{clearTimeout(timer);}}
  fail(error){this.ready.reject(error);this.final.reject(error);if(!this.closed){this.closed=true;this.ws?.terminate();this.onError(error);}}
  close(){this.closed=true;this.ws?.terminate();this.parts.clear();}
}
module.exports={QwenAsr,pcm16};
