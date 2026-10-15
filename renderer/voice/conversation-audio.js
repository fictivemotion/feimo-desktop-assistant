'use strict';
(()=>{
 const api=window.conversationAudio;let current=null,generation=0,queue=Promise.resolve();
 // Stateful linear resampling preserves fractional phase between frames.
 function resampler(from,to){let phase=0,last=0;return input=>{const ratio=from/to,out=[];for(;phase<input.length;phase+=ratio){const i=Math.floor(phase),f=phase-i,a=i<0?last:input[i],b=input[Math.min(input.length-1,i+1)];out.push(a+(b-a)*f);}phase-=input.length;last=input.at(-1)||0;return Float32Array.from(out);};}
 async function release(){const s=current;current=null;if(!s)return;clearInterval(s.resumeTimer);if(s.context)s.context.onstatechange=null;s.stream?.getTracks().forEach(t=>t.stop());s.input?.disconnect();s.mic?.disconnect();s.silence?.disconnect();s.player?.disconnect();if(s.context)await s.context.close().catch(()=>{});}
 async function start(m,epoch){await release();if(epoch!==generation)return;const s={id:m.id};current=s;
  try{s.stream=await FeimoMicrophone.open(navigator.mediaDevices,m.deviceId,{outputMuted:false});if(epoch!==generation||current!==s){s.stream.getTracks().forEach(t=>t.stop());return;}
   s.context=new AudioContext({latencyHint:'interactive'});await s.context.resume();await s.context.audioWorklet.addModule('audio-worklet.js');await s.context.audioWorklet.addModule('conversation-worklet.js');if(epoch!==generation||current!==s){await release();return;}
   s.input=s.context.createMediaStreamSource(s.stream);s.mic=new AudioWorkletNode(s.context,'voice-frames');s.silence=s.context.createGain();s.silence.gain.value=0;s.input.connect(s.mic);s.mic.connect(s.silence).connect(s.context.destination);
   const down=resampler(s.context.sampleRate,16000);s.up=resampler(24000,s.context.sampleRate);s.player=new AudioWorkletNode(s.context,'conversation-pcm',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]});s.player.connect(s.context.destination);
   s.mic.port.onmessage=({data})=>{if(current===s&&epoch===generation)api.audio(s.id,down(data));};s.player.port.onmessage=({data})=>{if(current===s&&epoch===generation)api.report({id:s.id,...data});};
   // A media/device focus change (including music/Bluetooth playback) may
   // suspend the shared audio context. Resume it without restarting the mic or
   // changing any system/player volume. Never run concurrent resume requests.
   const resume=async()=>{if(current!==s||epoch!==generation||s.resuming||s.context.state==='running'||s.context.state==='closed')return;s.resuming=true;try{await s.context.resume();}catch{}finally{s.resuming=false;}};s.context.onstatechange=()=>void resume();s.resumeTimer=setInterval(()=>void resume(),1000);
   s.stream.getAudioTracks()[0].onended=()=>{if(current===s){api.report({id:s.id,type:'error',message:'麦克风已断开'});void release();}};api.report({id:s.id,type:'ready'});
  }catch{if(current===s){api.report({id:s.id,type:'error',message:'无法打开麦克风，请检查系统权限与输入设备'});await release();}}
 }
 api.onCommand(m=>{if(m.type==='start'){const epoch=++generation;queue=queue.then(()=>start(m,epoch)).catch(()=>{});return;}if(m.type==='stop'){generation++;queue=queue.then(async()=>{await release();api.report({id:m.id,type:'stopped'});}).catch(()=>{});return;}const s=current;if(!s?.player||s.id!==m.id)return;
  if(m.type==='flush'){s.up=resampler(24000,s.context.sampleRate);s.player.port.postMessage({type:'flush'});return;}
  if(m.type==='end'){s.player.port.postMessage(m);return;}
  if(m.type==='audio'){try{const bytes=Uint8Array.from(atob(m.audio),c=>c.charCodeAt(0));if(bytes.length%2)throw Error();const view=new DataView(bytes.buffer),pcm=new Float32Array(bytes.length/2);for(let i=0;i<pcm.length;i++)pcm[i]=view.getInt16(i*2,true)/32768;const samples=s.up(pcm);s.player.port.postMessage({type:'audio',responseId:m.responseId,samples},[samples.buffer]);}catch{api.report({id:s.id,type:'error',message:'语音音频格式无效'});}}
 });addEventListener('pagehide',()=>{generation++;void release();});api.ready();
})();
