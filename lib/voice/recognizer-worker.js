'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const path = require('node:path');
let recognizer, stream, committed='',last='',finished=false;
function decode(samples,final=false){
  stream.acceptWaveform({sampleRate:16000,samples});
  if(final)stream.inputFinished();
  while(recognizer.isReady(stream))recognizer.decode(stream);
  const segment=recognizer.getResult(stream).text||'';
  const space=/[a-z0-9]$/i.test(committed)&&/^[a-z0-9]/i.test(segment)?' ':'';
  const text=committed+space+segment;
  if(text!==last||final){last=text;parentPort.postMessage({type:final?'final':'text',text});}
  if(!final&&recognizer.isEndpoint(stream)&&segment){committed=text;recognizer.reset(stream);}
}
try{
  const {OnlineRecognizer}=require('sherpa-onnx-node');
  recognizer=new OnlineRecognizer({featConfig:{sampleRate:16000,featureDim:80},modelConfig:{paraformer:{encoder:path.join(workerData.dir,'encoder.int8.onnx'),decoder:path.join(workerData.dir,'decoder.int8.onnx')},tokens:path.join(workerData.dir,'tokens.txt'),numThreads:2,provider:'cpu',debug:0},enableEndpoint:true,rule1MinTrailingSilence:2.4,rule2MinTrailingSilence:1.2,rule3MinUtteranceLength:20});
  stream=recognizer.createStream();parentPort.postMessage({type:'ready'});
}catch{parentPort.postMessage({type:'error',message:'离线语音引擎无法加载，请检查模型和 Windows VC++ 运行库'});}
parentPort.on('message',message=>{
  if(finished||!stream)return;
  try{
    if(message.type==='audio')decode(new Float32Array(message.samples));
    if(message.type==='finish'){finished=true;decode(new Float32Array(16000*.6),true);}
  }catch{finished=true;parentPort.postMessage({type:'error',message:'离线语音识别失败，请重新开始'});}
});
