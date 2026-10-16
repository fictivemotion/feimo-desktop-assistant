'use strict';
const {randomUUID}=require('node:crypto');
const WebSocket=require('ws');
const {pcm16}=require('./qwen');
const MODEL='qwen-audio-3.1-realtime-plus';
const URL='wss://maas.qianwenaiapi.com/api-ws/v1/realtime';
const VOICES=[['longanqian_v3.1','龙安倩 · 默认'],['longanhuan_v3.1','龙安欢'],['longanlingxin_v3.1','龙安灵心'],['longanfengyue_v3.1','龙安风月'],['xunanchuan_v3.1','徐南川'],['beth_v3.1','Beth'],['betty_v3.1','Betty'],['cally_v3.1','Cally'],['longanqian','龙安倩 · 经典'],['longanlingxin','龙安灵心 · 经典'],['longanlingxi','龙安灵犀'],['longanxiaoxin','龙安小新'],['longanlufeng','龙安陆风']];
const CONNECTING='稍等稍等，容我戴个耳机🎧',GREETING='天才斐墨，为您服务🌹',FAREWELL='下班了886👋';
function config(value={}){const voice=String(value.voice||VOICES[0][0]);if(!VOICES.some(v=>v[0]===voice))throw Error('请选择支持的对话音色');return {model:MODEL,voice};}
const normalize=text=>String(text||'').replace(/[\s，。！？、,.!?；;：:]/g,'').toLowerCase();
const meaningful=text=>!!normalize(text)&&! /^(嗯+|恩+|呃+|啊+|哦+|噢+|唔+|哈+)$/.test(normalize(text));
class Conversation{
  constructor({settings,getSecret,send=()=>{},onChange=()=>{},onEnd=()=>{},connectOptions=async()=>({}),beforeStart=async()=>{},afterStop=async()=>{},socketFactory=(url,options)=>new WebSocket(url,options),now=Date.now,idleMs=20000,connectTimeoutMs=20000,sessionTimeoutMs=10000,deviceTimeoutMs=12000}){
    Object.assign(this,{settings,getSecret,send,onChange,onEnd,connectOptions,beforeStart,afterStop,socketFactory,now,idleMs,connectTimeoutMs,sessionTimeoutMs,deviceTimeoutMs});
    this.snapshot={active:false,phase:'idle',text:'',answer:'',userText:''};this.generation=0;this.stopping=Promise.resolve();
  }
  state(){return {...this.snapshot};}
  changed(patch={}){Object.assign(this.snapshot,patch);this.onChange(this.state());}
  clearTimers(){clearTimeout(this.idleTimer);clearTimeout(this.startTimer);clearTimeout(this.turnTimer);}
  idle(){clearTimeout(this.idleTimer);if(!this.snapshot.active||!this.ready)return;const id=this.snapshot.id;this.idleTimer=setTimeout(()=>{if(this.snapshot.id===id)void this.stop();},this.idleMs);this.idleTimer.unref?.();}
  waitForConnection(stage,ms,message){clearTimeout(this.startTimer);const generation=this.generation;this.changed({connectionStage:stage});this.startTimer=setTimeout(()=>{if(generation===this.generation&&!this.ready)void this.fail(message);},ms);this.startTimer.unref?.();}
  watchTurn(){clearTimeout(this.idleTimer);clearTimeout(this.turnTimer);this.turnTimer=setTimeout(()=>this.fail('语音响应超时，请重新双击开始'),45000);this.turnTimer.unref?.();}
  async start(){
    if(this.snapshot.active)return this.state();await this.stopping;if(this.snapshot.active)return this.state();
    const generation=++this.generation,id=randomUUID();this.cancelled=new Set();this.seenItems=new Set();this.response=null;this.playing=false;this.ready=false;this.sessionRequested=false;this.sessionReady=false;this.deviceStarted=false;this.receivedAudio=false;this.playbackLimited=null;this.transcriptChannel=false;this.preparing=false;this.validTurn=false;this.lastFinal=null;
    this.changed({id,active:true,phase:'connecting',connectionStage:'network',text:CONNECTING,role:'connecting',userText:'',answer:'',replyId:'',replyAt:0,error:null});
    this.waitForConnection('network',this.connectTimeoutMs,'千问语音连接超时，请检查网络后重新双击');
    try{
      const c=config(this.settings.get('conversation',{}));
      const key=await this.getSecret('conversationApiKey')||await this.getSecret('voiceAsrApiKey');
      if(generation!==this.generation)return this.state();
      if(!key)throw Error('请先在设置中填写千问对话密钥');
      const options=await this.connectOptions(URL);if(generation!==this.generation)return this.state();
      const ws=this.socketFactory(URL+'?model='+MODEL,{...options,headers:{Authorization:'Bearer '+key},handshakeTimeout:12000,maxPayload:2*1024*1024});this.ws=ws;
      ws.on('open',()=>{if(generation!==this.generation||this.sessionRequested)return;this.sessionRequested=true;this.waitForConnection('session',this.sessionTimeoutMs,'千问语音会话未响应，请稍后重新双击');this.event({type:'session.update',session:{modalities:['text','audio'],voice:c.voice,input_audio_format:'pcm',output_audio_format:'pcm',input_audio_transcription:{language:'zh'},turn_detection:{type:'smart_turn'},max_history_turns:20,instructions:'你是斐墨，一位严谨、友善的研究者与桌面助手。使用自然简洁的中文与用户语音问答，先回答核心问题，科学问题准确表达不确定性。只回应用户明确表达的内容，不把环境声、自己的回声或无意义附和当作新问题。不要主动播报问候或静默提醒。'}});});
      ws.on('message',raw=>{if(generation!==this.generation)return;try{this.message(JSON.parse(raw.toString()));}catch{this.fail('实时语音返回了无效数据');}});
      ws.on('error',error=>{if(generation===this.generation)this.fail(/401|403/.test(error.message)?'千问对话密钥无效或尚未开通模型':'千问实时语音连接失败，请检查网络');});
      ws.on('close',()=>{if(generation===this.generation&&this.snapshot.active)this.fail('实时语音连接已断开，请重新双击开始');});
    }catch(error){if(generation===this.generation)await this.fail(error.message);}
    return this.state();
  }
  event(value){if(this.ws?.readyState!==1)return false;if(this.ws.bufferedAmount>1024*1024){void this.fail('音频发送积压，请检查网络后重试');return false;}try{this.ws.send(JSON.stringify({event_id:randomUUID(),...value}));return true;}catch{void this.fail('千问实时语音发送失败，请重新双击开始');return false;}}
  async prepare(){
    if(!this.snapshot.active||!this.sessionReady||this.preparing||this.deviceStarted||this.ready)return;this.preparing=true;const generation=this.generation;
    try{await this.beforeStart();if(generation!==this.generation)return;this.deviceStarted=true;this.send({type:'start',id:this.snapshot.id,deviceId:this.settings.get('voice',{}).deviceId||''});}
    catch{if(generation===this.generation)this.fail('麦克风音频准备失败');}finally{if(generation===this.generation)this.preparing=false;}
  }
  report({id,type,responseId,message}={}){
    if(!this.snapshot.active||id!==this.snapshot.id)return;
    // The renderer reports ready only after both audio worklets have processed
    // their first frame. A socket open or an early/stale IPC is not a handshake.
    if(type==='ready'){if(this.ready||!this.sessionReady||!this.deviceStarted||this.ws?.readyState!==1)return;this.ready=true;clearTimeout(this.startTimer);this.changed({phase:'waiting',connectionStage:'ready',role:'greeting',text:GREETING});this.idle();}
    else if(type==='error')this.fail(String(message||'音频设备不可用').replace(/sk-[a-z0-9]+/gi,'[已隐藏]').slice(0,160));
    else if(type==='progress'&&responseId===this.response&&this.playing)this.watchTurn();
    // A pathological >3-minute burst may exceed the memory budget. Preserve
    // the complete text stream and continuous microphone; only this reply's
    // playback is skipped, and the next reply starts with a clean queue.
    else if(type==='limited'&&responseId===this.response){this.playing=false;this.receivedAudio=false;this.playbackLimited=responseId;this.changed({phase:'streaming'});}
    else if(type==='drained'&&responseId===this.response&&this.responseDone){this.playing=false;clearTimeout(this.turnTimer);this.changed({phase:'waiting',replyAt:this.now()});this.idle();}
  }
  audio(id,samples){if(!this.ready||!this.snapshot.active||id!==this.snapshot.id)return;if(!(Array.isArray(samples)||samples instanceof Float32Array)||!samples.length||samples.length>3200||!samples.every(Number.isFinite))return;this.event({type:'input_audio_buffer.append',audio:pcm16(samples).toString('base64')});}
  cancelResponse(remote=true){if(this.response){this.cancelled.add(this.response);if(this.cancelled.size>64)this.cancelled.delete(this.cancelled.values().next().value);if(remote&&!this.responseDone)this.event({type:'response.cancel'});}this.send({type:'flush',id:this.snapshot.id});this.playing=false;this.response=null;this.responseDone=false;this.receivedAudio=false;}
  message(m){
    if(!this.snapshot.active)return;const type=m.type;
    if(type==='session.updated'){if(!this.sessionRequested||this.sessionReady||this.ws?.readyState!==1)return;this.sessionReady=true;this.waitForConnection('audio',this.deviceTimeoutMs,'麦克风或语音播放通道未就绪，请检查设备权限后重新双击');void this.prepare();return;}
    if(type==='error'){const code=String(m.error?.code||'');if(/cancel.*(not|no)|no active response|response.*not.*active/i.test(code+' '+(m.error?.message||'')))return;this.fail(/auth|key|401|403/i.test(code)?'千问对话密钥无效或模型未授权':'千问对话服务返回错误，请检查模型权限或稍后重试');return;}
    if(type==='session.finished'){void this.stop();return;}
    if(!this.ready)return;
    // In smart_turn, speech_started is a semantic interruption, not a raw RMS
    // threshold. Preserve the continuous microphone while cancelling one reply.
    if(type==='input_audio_buffer.speech_started'){
      clearTimeout(this.idleTimer);this.cancelResponse(false);this.validTurn=false;this.speechItem=m.item_id;this.changed({phase:'listening',role:'user',text:'正在听你说…',userText:'',answer:'',replyId:'',replyAt:0});this.watchTurn();return;
    }
    if(type==='input_audio_buffer.speech_stopped'){if(this.snapshot.phase==='listening')this.changed({phase:'thinking'});this.watchTurn();return;}
    if(/^conversation.item.input_audio_transcription\.(delta|text|completed)$/.test(type)){
      const item=m.item_id||this.speechItem||'current';if(this.seenItems.has(item))return;
      const final=type.endsWith('.completed'),text=String(final?m.transcript||'':(m.text||'')+(m.stash||'')).slice(0,24000);
      if(final){this.seenItems.add(item);if(this.seenItems.size>100)this.seenItems.delete(this.seenItems.values().next().value);const duplicate=this.lastFinal&&normalize(text)===this.lastFinal.text&&this.now()-this.lastFinal.at<1800;this.validTurn=meaningful(text)&&!duplicate;this.lastFinal={text:normalize(text),at:this.now()};
        if(!this.validTurn){this.cancelResponse();clearTimeout(this.turnTimer);this.changed({phase:'waiting',role:'user',text:text||'我在听',userText:text});this.idle();return;}
      }else if(meaningful(text))this.validTurn=true;
      // ASR final may arrive after the first answer audio; never replace a
      // streaming assistant answer with a late user transcript.
      this.watchTurn();const replying=['speaking','streaming'].includes(this.snapshot.phase);this.changed({userText:text,...(!replying?{text,role:'user',phase:final?'thinking':'listening'}:{})});return;
    }
    if(type==='response.created'){
      const id=m.response?.id||m.response_id;if(!id||this.cancelled.has(id))return;
      if(this.response&&this.response!==id)this.cancelResponse();this.response=id;this.responseDone=false;this.receivedAudio=false;this.transcriptChannel=false;this.changed({phase:'thinking',replyId:id,replyAt:0,answer:''});this.watchTurn();return;
    }
    const responseId=m.response_id||m.response?.id;if(responseId&&responseId!==this.response||responseId&&this.cancelled.has(responseId))return;
    if(!this.response)return;
    if(type==='response.audio.delta'){
      if(typeof m.delta!=='string'||m.delta.length>1024*1024)return;this.watchTurn();if(this.playbackLimited===this.response)return;this.receivedAudio=true;this.playing=true;this.changed({phase:'speaking'});this.send({type:'audio',id:this.snapshot.id,responseId:this.response,audio:m.delta});return;
    }
    if(['response.audio_transcript.delta','response.text.delta'].includes(type)){
      // Audio transcripts are the canonical answer in text+audio mode; text
      // events are accepted only until an audio transcript channel is seen.
      if(type==='response.audio_transcript.delta')this.transcriptChannel=true;else if(this.transcriptChannel)return;
      this.watchTurn();const answer=(this.snapshot.answer+String(m.delta||'')).slice(0,30000);this.changed({phase:this.playing?'speaking':'streaming',role:'assistant',text:answer,answer});return;
    }
    if(['response.audio_transcript.done','response.text.done'].includes(type)){
      const answer=String(m.transcript||m.text||this.snapshot.answer).slice(0,30000);this.changed({role:'assistant',text:answer,answer});return;
    }
    if(type==='response.done'){
      if(m.response?.status==='cancelled'){this.cancelResponse();clearTimeout(this.turnTimer);this.changed({phase:'waiting'});this.idle();return;}
      if(m.response?.status==='failed'){this.fail('本轮语音回答失败，请重新开始');return;}
      this.responseDone=true;this.send({type:'end',id:this.snapshot.id,responseId:this.response});
      if(!this.receivedAudio){clearTimeout(this.turnTimer);this.changed({phase:'waiting',replyAt:this.now()});this.idle();}
    }
  }
  async fail(message){if(!this.snapshot.active)return;return this.stop(message);}
  async stop(error=null){
    if(!this.snapshot.active)return this.stopping;const id=this.snapshot.id;this.generation++;this.clearTimers();this.ready=false;this.cancelResponse(false);const ws=this.ws;this.ws=null;ws?.terminate();const stopped=this.send({type:'stop',id});this.changed({active:false,phase:error?'error':'idle',connectionStage:null,error,text:error||FAREWELL,role:'farewell'});this.onEnd({text:error||FAREWELL,error:!!error});
    this.stopping=Promise.resolve(stopped).then(()=>this.afterStop()).catch(()=>{});await this.stopping;return this.state();
  }
}
module.exports={Conversation,MODEL,URL,VOICES,config,meaningful,CONNECTING,GREETING,FAREWELL};
