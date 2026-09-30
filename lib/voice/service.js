'use strict';
const {randomUUID}=require('node:crypto');const {createAsr}=require('./asr');const {correct,parseRules}=require('./hotwords');const {DEFAULTS,validateConfig}=require('./config');const {LlmGateway}=require('../llm');
const ACTIVE=new Set(['starting','listening','paused','finishing','polishing']);
class VoiceService{
  constructor({settings,getSecret,models,input,capture,copy,onChange,onComplete,asrFactory=createAsr,fetcher=fetch,connectOptions}){Object.assign(this,{settings,getSecret,models,input,capture,copy,onChange,onComplete,asrFactory,fetcher,connectOptions});this.session=null;this.snapshot={phase:'idle',message:'语音输入待命',text:'',elapsed:0,level:0,targetOk:true};this.generation=0;this.queue=Promise.resolve();this.pendingText=null;this.pumping=false;}
  config(){return validateConfig({...DEFAULTS,...this.settings.get('voice',{})});}
  active(){return ACTIVE.has(this.snapshot.phase);}
  state(){return {...this.snapshot,active:this.active(),model:this.models.state()};}
  publish(patch){this.snapshot={...this.snapshot,...patch};this.onChange?.(this.state());}
  async toggle(){if(this.snapshot.phase==='listening'||this.snapshot.phase==='paused')return this.finish();if(this.active())return this.state();return this.start();}
  async start(){
    if(this.active())return this.state();const config=this.config();parseRules(config.rules);
    if(config.backend==='local'&&!this.models.state().ready){this.publish({phase:'error',message:'首次使用请在斐墨语音中下载离线模型（约 237 MB）'});return this.state();}
    const session={id:randomUUID(),config,raw:'',started:Date.now(),samples:0,aborted:false,controller:new AbortController(),micReady:false,finishRequest:false};this.session=session;this.generation++;this.pendingText=null;
    this.publish({phase:'starting',id:session.id,message:'准备麦克风…',text:'',elapsed:0,level:0,targetOk:true,warning:'',copied:false});
    try{
      const target=await this.input.capture();if(!target.ok)throw new Error(target.message);
      if(this.session!==session)return this.state();
      const key=await this.getSecret(config.backend==='capswriter'?'voiceCapsApiKey':'voiceAsrApiKey');
      session.asr=this.asrFactory(config,{dir:this.models.dir,key,connectOptions:this.connectOptions,onText:text=>this.recognized(session,text),onError:e=>this.fail(session,e)});
      await session.asr.start();if(this.session!==session)return this.state();
      this.capture({type:'start',id:session.id,deviceId:config.deviceId});
      session.startTimer=setTimeout(()=>this.fail(session,new Error('麦克风未响应，请检查系统麦克风权限')),12000);
      session.guardTimer=setInterval(()=>{if(this.session===session&&Date.now()-session.started>10*60000)void this.finish();},1000);session.guardTimer.unref?.();
    }catch(e){await this.fail(session,e);}return this.state();
  }
  micReady(id){const s=this.session;if(!s||s.id!==id||s.aborted||this.snapshot.phase!=='starting')return;clearTimeout(s.startTimer);s.micReady=true;this.publish({phase:'listening',message:'正在听写'});}
  micError(id,message){const s=this.session;if(s?.id===id)void this.fail(s,new Error(message||'无法使用麦克风，请检查权限与设备'));}
  audio(id,samples,level){const s=this.session;if(!s||s.id!==id||s.aborted||this.snapshot.phase!=='listening')return;
    if(!(samples instanceof Float32Array)||samples.length>8192||samples.length===0||!samples.every(Number.isFinite))return;
    s.samples+=samples.length;if(s.samples>16000*600){void this.finish();return;}
    try{s.asr.accept(samples);this.publish({elapsed:Math.floor(s.samples/16000),level:Math.max(0,Math.min(1,Number(level)||0))});}catch(e){void this.fail(s,e);}
  }
  recognized(s,text){if(this.session!==s||s.aborted||!ACTIVE.has(this.snapshot.phase))return;s.raw=String(text||'').slice(0,16000);const result=correct(s.raw,s.config);this.publish({text:result.text});this.pendingText=result.text;void this.pump(s);}
  async pump(s){if(this.pumping)return;this.pumping=true;try{while(this.pendingText!==null&&this.session===s&&!s.aborted){const text=this.pendingText;this.pendingText=null;if(!this.snapshot.targetOk||!text)continue;const result=await this.input.update(text);if(this.session!==s)break;if(!result.ok)this.publish({targetOk:false,warning:result.message||'输入框已变化，停止写入'});}}catch{if(this.session===s)this.publish({targetOk:false,warning:'无法继续定位输入框，结果会复制到剪贴板'});}finally{this.pumping=false;if(this.session&&this.session!==s&&this.pendingText!==null)void this.pump(this.session);}}
  async settle(s){while(this.pumping&&this.session===s)await new Promise(r=>setTimeout(r,20));if(this.pendingText!==null)await this.pump(s);}
  pause(){const s=this.session;if(!s)return this.state();if(this.snapshot.phase==='listening'){this.capture({type:'pause',id:s.id});this.publish({phase:'paused',message:'已暂停',level:0});}else if(this.snapshot.phase==='paused'){this.capture({type:'resume',id:s.id});this.publish({phase:'listening',message:'正在听写'});}return this.state();}
  async finish(){
    const s=this.session;if(!s||!['listening','paused'].includes(this.snapshot.phase))return this.state();
    this.publish({phase:'finishing',message:'整理听写…',level:0});this.capture({type:'stop',id:s.id});clearTimeout(s.startTimer);clearInterval(s.guardTimer);
    try{
      const raw=await s.asr.finish();if(this.session!==s||s.aborted)return this.state();this.recognized(s,raw);await this.settle(s);
      let final=correct(raw,s.config).text.trim(),warning=this.snapshot.warning||'';
      if(!final){this.publish({phase:'completed',message:'没有听到文字',level:0});return this.state();}
      if(s.config.polish){
        this.publish({phase:'polishing',message:'正在校对文字…'});
        const global=this.settings.get('llm',{}),llmSettings=s.config.useGlobalLlm?global:{baseUrl:s.config.llmUrl,model:s.config.llmModel};
        if(!llmSettings.baseUrl||!llmSettings.model)warning=[warning,'未配置 AI 接口，已保留热词纠正结果'].filter(Boolean).join('；');
        else try{
          const gateway=new LlmGateway({settings:{get:()=>({...llmSettings,systemPrompt:s.config.prompt})},getSecret:()=>this.getSecret(s.config.useGlobalLlm?'llmApiKey':'voiceLlmApiKey'),fetcher:this.fetcher});
          const timeout=AbortSignal.timeout(25000);const signal=AbortSignal.any([s.controller.signal,timeout]);
          const polished=await gateway.complete(`请校对下面的语音听写正文。热词词典：\n${s.config.hotwords.slice(0,5000)}\n<dictation>\n${final}\n</dictation>`,{signal});
          if(this.session!==s||s.aborted)return this.state();
          const cleaned=polished.trim().replace(/^```(?:\w+)?\s*\n?|\n?```$/g,'');
          if(!cleaned||cleaned.length>Math.max(final.length*3,final.length+200))throw new Error('AI 返回内容不适合替换');final=correct(cleaned,s.config).text;
        }catch{if(s.aborted)return this.state();warning=[warning,'AI 校对暂不可用，已保留听写结果'].filter(Boolean).join('；');}
      }
      if(this.session!==s||s.aborted)return this.state();
      if(this.snapshot.targetOk){const result=await this.input.update(final);if(!result.ok){warning=[warning,result.message].filter(Boolean).join('；');this.publish({targetOk:false});}}
      if(this.session!==s||s.aborted)return this.state();
      try{await this.copy(final);try{this.onComplete?.(s.id,final,s.samples/16000);}catch{}this.publish({phase:'completed',text:final,copied:true,message:this.snapshot.targetOk?'文字已校对并复制':'文字已复制，请粘贴到目标输入框',warning,level:0});}catch{this.publish({phase:'error',text:final,copied:false,message:'剪贴板暂时被占用，请在语音模块复制结果',warning,level:0});}
    }catch(e){await this.fail(s,e);}finally{s.asr?.close();s.controller.abort();if(this.session===s){await this.input.release().catch(()=>{});if(this.session===s)this.session=null;}}
    return this.state();
  }
  async fail(s,error){if(this.session!==s||s.aborted)return;s.aborted=true;clearTimeout(s.startTimer);clearInterval(s.guardTimer);this.capture({type:'stop',id:s.id});s.asr?.close();s.controller.abort();this.pendingText=null;this.publish({phase:'error',message:error.message||'语音输入失败',level:0});await this.input.release().catch(()=>{});if(this.session===s)this.session=null;}
  async cancel(){const s=this.session;if(!s)return this.state();s.aborted=true;clearTimeout(s.startTimer);clearInterval(s.guardTimer);this.capture({type:'stop',id:s.id});s.asr?.close();s.controller.abort();this.pendingText=null;await this.input.release().catch(()=>{});this.session=null;this.publish({phase:'idle',message:'听写已取消，已输入的文字保留',level:0});return this.state();}
  close(){this.models.cancel();const s=this.session;if(s){s.aborted=true;clearTimeout(s.startTimer);clearInterval(s.guardTimer);s.asr?.close();s.controller.abort();this.capture({type:'stop',id:s.id});}this.input.close();this.session=null;}
}
module.exports={VoiceService,ACTIVE};
