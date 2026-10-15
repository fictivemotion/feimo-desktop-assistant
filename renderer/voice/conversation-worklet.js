// Bounded PCM24k jitter buffer. Mic and output use one AudioContext so browser
// echo cancellation has a render reference. No second TTS or playback path.
class ConversationPCM extends AudioWorkletProcessor{
  constructor(){super();this.queue=[];this.offset=0;this.length=0;this.started=false;this.done=false;this.responseId='';this.port.onmessage=({data:m})=>{if(m.type==='flush'){this.queue=[];this.offset=0;this.length=0;this.started=false;this.done=false;this.responseId='';return;}if(m.type==='end'){this.done=true;return;}if(m.type==='audio'){if(this.responseId&&m.responseId!==this.responseId)return;this.responseId=m.responseId;if(this.length+m.samples.length>sampleRate*15){this.port.postMessage({type:'overflow'});return;}this.queue.push(m.samples);this.length+=m.samples.length;}};}
  process(inputs,outputs){const out=outputs[0]?.[0];if(!out)return true;if(!this.started&&(this.length>=sampleRate*.08||this.done&&this.length))this.started=true;
    if(this.started)for(let i=0;i<out.length&&this.length;i++){const head=this.queue[0];out[i]=head[this.offset++];this.length--;if(this.offset===head.length){this.queue.shift();this.offset=0;}}
    if(this.done&&!this.length){const responseId=this.responseId;this.done=false;this.started=false;this.responseId='';this.port.postMessage({type:'drained',responseId});}return true;
  }
}
registerProcessor('conversation-pcm',ConversationPCM);
