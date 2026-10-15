'use strict';
// Researcher headset accessories share the character transform in every dialogue state.
module.exports=({group,rect,ellipse,line,curve})=>group('researcher',0,0,
  // Boom microphone is an accessory; the character remains mouthless.
  rect('boom-capsule',40,49,28,13,6,'FF464C79',{rotation:-.12})+
  rect('boom-led',39,49,12,2.6,1.3,'FFC3D0FF',{rotation:-.12})+
  curve('boom-arm',[[78,12,0,0,1.8,20],[65,36,-.5,18,2.6,15],[49,46,-.6,10,0,0]],'FF4D547D',5)+
  rect('research-ear-l',-78,-2,24,46,10,'FF4E557F',{rotation:-.12})+
  rect('research-ear-r',78,-2,24,46,10,'FF4E557F',{rotation:.12})+
  curve('research-band',[[-78,-14,0,0,-Math.PI/2,90],[78,-14,-Math.PI/2,90,0,0]],'FF535C8D',10)+
  curve('research-band-highlight',[[-77,-19,0,0,-Math.PI/2,87],[77,-19,-Math.PI/2,87,0,0]],'FF7B86B5',1.5),{opacity:0});
