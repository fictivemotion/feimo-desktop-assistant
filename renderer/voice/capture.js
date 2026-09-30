'use strict';
const api=window.voiceApi,$=id=>document.getElementById(id);let session=null,generation=0,phase='idle',level=0;
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
  phase=state.phase;level=state.level||0;$('capsule').dataset.phase=phase;$('message').textContent=state.message;
  $('time').textContent=state.targetOk===false?'已停止写入 · 结果会保留':state.warning?'已保留听写原文':`${String(Math.floor((state.elapsed||0)/60)).padStart(2,'0')}:${String((state.elapsed||0)%60).padStart(2,'0')}`;
  $('capsule').title=state.warning||state.message;$('pause').hidden=!['listening','paused'].includes(phase);$('finish').hidden=!['listening','paused'].includes(phase);
  $('close').title=state.active?'取消听写，保留已输入的文字':'收起提示';$('pause').replaceChildren(window.ReiconFilled.create(phase==='paused'?'Play':'Pause',16));
  const bars=[...$('wave').children];bars.forEach((bar,i)=>{const weight=[.35,.7,1,.85,.65,.9,.45][i];bar.style.height=`${phase==='listening'?4+Math.round(level*24*weight):4}px`;});
});
$('pause').onclick=()=>api.pause();$('finish').onclick=()=>api.finish();$('close').onclick=()=>['starting','listening','paused','finishing','polishing'].includes(phase)?api.cancel():api.dismiss();
window.addEventListener('beforeunload',release);api.ready();
