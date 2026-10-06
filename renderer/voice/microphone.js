'use strict';
// Only media-input tracks are accepted. Explicit loopback devices are not speech
// microphones; output-device mute does not make their source a microphone.
(function(root){
 const loopback=label=>/stereo\s*mix|立体声混音|what\s*u\s*hear|您听到的声音|wave\s*out|loopback|回环|回放录音|cable\s*(?:output|out)|system\s*audio/i.test(String(label||''));
 async function open(media,deviceId){
  const constraints=id=>({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true,latency:{ideal:.01},...(id?{deviceId:{exact:id}}:{})},video:false});
  let stream=await media.getUserMedia(constraints(deviceId));const track=stream.getAudioTracks()[0];
  if(loopback(track?.label)){
   stream.getTracks().forEach(t=>t.stop());
   if(deviceId)throw new Error('所选设备是电脑播放录音源，请在斐墨语音中选择麦克风');
   const devices=(await media.enumerateDevices()).filter(d=>d.kind==='audioinput'&&!['default','communications'].includes(d.deviceId)&&!loopback(d.label)&&/microphone|麦克风|话筒|mic\b/i.test(d.label));
   if(!devices.length)throw new Error('默认录音源是电脑播放声音，请在斐墨语音中选择麦克风');
   stream=await media.getUserMedia(constraints(devices[0].deviceId));
   if(loopback(stream.getAudioTracks()[0]?.label)){stream.getTracks().forEach(t=>t.stop());throw new Error('录音源仍是电脑播放声音，请重新选择麦克风');}
  }
  return stream;
 }
 const api={loopback,open};if(typeof module==='object')module.exports=api;else root.FeimoMicrophone=api;
})(typeof window==='object'?window:globalThis);
