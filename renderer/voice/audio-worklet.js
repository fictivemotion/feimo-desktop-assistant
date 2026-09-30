class VoiceFrames extends AudioWorkletProcessor {
  constructor(){super();this.buffer=new Float32Array(1024);this.offset=0;}
  process(inputs){const channels=inputs[0];if(!channels?.length)return true;for(let i=0;i<channels[0].length;i++){let sample=0;for(const c of channels)sample+=c[i];this.buffer[this.offset++]=sample/channels.length;if(this.offset===this.buffer.length){this.port.postMessage(this.buffer,[this.buffer.buffer]);this.buffer=new Float32Array(1024);this.offset=0;}}return true;}
}
registerProcessor('voice-frames',VoiceFrames);
