'use strict';
// Shared scene contract. Rive owns interpolation; the host only selects a state.
(function(root,factory){const value=factory();if(typeof module==='object')module.exports=value;else root.FeimoScenes=value;})(typeof globalThis==='object'?globalThis:this,()=>{
 const modes=['idle','music','focus','thinking','attention','completed','failed','sleeping','listening','streaming','greeting','dragging','break','workbench'];
 const aliases={processing:'thinking',agentWorking:'thinking',voiceListening:'listening',voicePaused:'sleeping',replyStreaming:'streaming',docked:'sleeping',settings:'workbench',tools:'workbench',focusRunning:'focus',focusBreak:'break',soundscapePlaying:'music',musicPlaying:'music',needsInput:'attention',interaction:'greeting',startup:'greeting',wake:'greeting',workbenchOpen:'workbench',toolsOpen:'workbench',settingsOpen:'workbench',notification:'attention',reminder:'attention','dragging-left':'dragging','dragging-right':'dragging',jumping:'greeting'};
 const modeFor=scene=>modes.indexOf(aliases[scene]||scene)>=0?modes.indexOf(aliases[scene]||scene):0;
 class Controller{
  constructor(now=()=>performance.now()){this.now=now;this.base='idle';this.pulse=null;}
  set(scene){this.base=scene;if(['voiceListening','listening','dragging-left','dragging-right'].includes(scene))this.pulse=null;return this.value();}
  event(scene){if(['voiceListening','listening','dragging-left','dragging-right'].includes(this.base))return this.value();const priority=['failed','reminder','needsInput'].includes(scene)?3:['completed','notification'].includes(scene)?2:1;if(!this.pulse||this.pulse.until<=this.now()||priority>=this.pulse.priority)this.pulse={scene,priority,until:this.now()+(priority>1?3600:1600)};return this.value();}
  value(){if(this.pulse&&this.pulse.until<=this.now())this.pulse=null;return modeFor(this.pulse?.scene||this.base);}
 }
 return {modes,aliases,modeFor,Controller};
});
