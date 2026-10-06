'use strict';
const api=window.voiceApi,$=id=>document.getElementById(id);let session=null,generation=0,phase='idle',level=0,stopRequested=false;
for(let i=0;i<7;i++)$('wave').appendChild(document.createElement('i'));
window.ReiconFilled.hydrate?.();
function release(){if(!session)return;session.stream?.getTracks().forEach(t=>t.stop());session.node?.disconnect();session.source?.disconnect();session.context?.close().catch(()=>{});session=null;}
async function start(command){
  const token=++generation;release();session={id:command.id,paused:false,sampleIndex:0,nextOutput:0,lastValue:0,output:[],lastReport:0};const current=session;
  try{
    const audio={channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true,...(command.deviceId?{deviceId:{exact:command.deviceId}}:{})};
    const stream=await navigator.mediaDevices.getUserMedia({audio});if(token!==generation){stream.getTracks().forEach(t=>t.stop());return;}current.stream=stream;
    stream.getAudioTracks()[0]?.addEventListener('ended',()=>{if(session===current)api.report(current.id,'error','麦克风已断开，请重新选择设备');});
    const context=new AudioContext({sampleRate:16000});current.context=context;
    await context.audioWorklet.addModule('audio-worklet.js');if(token!==generation)return;
    const source=context.createMediaStreamSource(stream),node=new AudioWorkletNode(context,'voice-frames');current.source=source;current.node=node;
    const mute=context.createGain();mute.gain.value=0;source.connect(node);node.connect(mute);mute.connect(context.destination);
    const ratio=context.sampleRate/16000;
    node.port.onmessage=e=>{
      if(session!==current||current.paused)return;const input=e.data;if(!(input instanceof Float32Array))return;const output=[];
      // Stateful interpolation preserves fractional sample boundaries between worklet frames.
      const startIndex=current.sampleIndex,endIndex=startIndex+input.length;
      while(current.nextOutput<endIndex-1){const local=current.nextOutput-startIndex;const index=Math.floor(local);const frac=local-index;const a=index<0?current.lastValue:input[index],b=input[Math.max(0,index+1)];output.push(a+(b-a)*frac);current.nextOutput+=ratio;}
      current.sampleIndex=endIndex;current.lastValue=input[input.length-1];
      if(output.length){const samples=Float32Array.from(output);let sum=0;for(const x of samples)sum+=x*x;const rms=Math.min(1,Math.sqrt(sum/samples.length)*5);api.audio(current.id,samples,rms);}
    };
    await context.resume();if(token===generation)api.report(command.id,'ready');
  }catch(e){if(token!==generation)return;release();api.report(command.id,'error',e.name==='NotAllowedError'?'麦克风权限未开启，请在 Windows 设置中允许桌面应用访问麦克风':e.name==='NotFoundError'||e.name==='OverconstrainedError'?'未找到所选麦克风，请在斐墨语音中重新选择': '麦克风初始化失败，请检查设备是否被独占');}
}
api.onCommand(command=>{if(command.type==='start')void start(command);else if(session?.id===command.id){if(command.type==='pause')session.paused=true;if(command.type==='resume')session.paused=false;if(command.type==='stop'){generation++;release();}}});
api.onState(state=>{
  if(stopRequested&&['starting','listening','paused'].includes(state.phase))return;
  stopRequested=false;
  phase=state.phase;level=state.level||0;$('capsule').dataset.phase=phase;$('message').textContent=state.message;
  if(state.active)$('capsule').classList.remove('exiting');
  if(state.targetOk===false&&['listening','paused'].includes(phase))$('message').textContent=phase==='paused'?'听写已暂停':'剪贴板听写中';
  $('time').textContent=state.phase==='completed'&&state.copied?'已复制到剪贴板':state.targetOk===false?(state.targetRetryable?'正在确认输入框写入…':'结束后自动校对并复制'):state.warning?'已保留听写原文':`${String(Math.floor((state.elapsed||0)/60)).padStart(2,'0')}:${String((state.elapsed||0)%60).padStart(2,'0')}`;
  $('capsule').title=[state.warning,state.audioWarning,state.outputMuted?'电脑输出已静音':''].filter(Boolean).join('；')||state.message;$('pause').hidden=!['listening','paused'].includes(phase);$('finish').hidden=!['listening','paused'].includes(phase);
  const pauseIcon=phase==='paused'?'Play':'Pause';
  $('pause').setAttribute('aria-label',phase==='paused'?'继续听写':'暂停听写');
  // Audio level updates must not replace the node under a pressed mouse pointer.
  if($('pause').dataset.icon!==pauseIcon){$('pause').dataset.icon=pauseIcon;$('pause').replaceChildren(window.ReiconFilled.create(pauseIcon,16));}
  const bars=[...$('wave').children];bars.forEach((bar,i)=>{const weight=[.35,.7,1,.85,.65,.9,.45][i];bar.style.height=`${phase==='listening'?4+Math.round(level*24*weight):4}px`;});
});
function commandButton(id,action){
  const button=$(id);let pending=false,pressed=null,ignoreClickUntil=0;
  async function run(){if(pending||!['listening','paused'].includes(phase))return;pending=true;try{await action();}catch{ $('time').textContent='操作未完成，请再试一次'; }finally{pending=false;}}
  // Nonactivating floating windows keep the editor focused. Dispatch on press,
  // before state updates or a moved pointer can interrupt the click sequence.
  button.addEventListener('pointerdown',e=>{if(e.button!==0)return;pressed=e.pointerId;ignoreClickUntil=performance.now()+750;e.preventDefault();void run();});
  // Some nonactivating Windows surfaces deliver the release/click without the
  // initial pointerdown. Keep both fallbacks, while consuming an already handled press.
  button.addEventListener('pointerup',e=>{if(e.button!==0)return;if(pressed===e.pointerId){pressed=null;ignoreClickUntil=performance.now()+750;return;}pressed=null;ignoreClickUntil=performance.now()+750;void run();});
  button.addEventListener('pointercancel',()=>{pressed=null;});
  button.addEventListener('click',e=>{if(e.detail!==0&&performance.now()<ignoreClickUntil)return;pressed=null;void run();});
}
commandButton('pause',()=>api.pause());commandButton('finish',()=>{
  // Stop the local audio source on the press, even while the main process is
  // reconciling a target write. Final recognition and polish continue via IPC.
  generation++;release();stopRequested=true;phase='finishing';
  $('capsule').dataset.phase=phase;$('message').textContent='整理听写…';$('time').textContent='正在结束听写';$('pause').hidden=true;$('finish').hidden=true;
  return api.finish().catch(error=>{stopRequested=false;throw error;});
});
api.onExit(()=>{if(phase!=='completed')return;$('capsule').classList.add('exiting');setTimeout(()=>{if(phase==='completed')api.dismiss();},180);});
window.addEventListener('beforeunload',release);api.ready();
