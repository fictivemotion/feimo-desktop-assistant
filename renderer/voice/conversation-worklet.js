// The server can generate PCM much faster than real-time playback. Queue time
// measures generated speech, not network latency; a normal answer can exceed
// 15 seconds even on a healthy sound device. Keep a bounded three-minute queue
// and report consumption so a long answer does not trip the network watchdog.
class ConversationPCM extends AudioWorkletProcessor{
  constructor(){super();this.reset();this.port.onmessage=({data:m})=>{if(m.type==='flush'){this.reset();return;}if(m.type==='end'){if(!m.responseId||m.responseId===this.responseId)this.done=true;return;}if(m.type==='audio'){if(this.responseId&&m.responseId!==this.responseId)return;this.responseId=m.responseId;if(this.discarding)return;if(this.length+m.samples.length>sampleRate*180){this.queue=[];this.offset=0;this.length=0;this.started=false;this.discarding=true;this.port.postMessage({type:'limited',responseId:this.responseId});return;}this.queue.push(m.samples);this.length+=m.samples.length;}};}
  reset(){this.queue=[];this.offset=0;this.length=0;this.started=false;this.done=false;this.discarding=false;this.responseId='';this.consumed=0;}
  process(inputs,outputs){const out=outputs[0]?.[0];if(!out)return true;if(!this.started&&(this.length>=sampleRate*.08||this.done&&this.length))this.started=true;
    if(this.started){for(let i=0;i<out.length&&this.length;i++){const head=this.queue[0];out[i]=head[this.offset++];this.length--;this.consumed++;if(this.offset===head.length){this.queue.shift();this.offset=0;}}if(this.consumed>=sampleRate){this.consumed%=sampleRate;this.port.postMessage({type:'progress',responseId:this.responseId,remaining:this.length/sampleRate});}}
    if(this.done&&!this.length){const responseId=this.responseId;this.reset();this.port.postMessage({type:'drained',responseId});}return true;
  }
}
registerProcessor('conversation-pcm',ConversationPCM);
