'use strict';
// Scene scheduling around the untouched upstream engine. Times are seconds.
((root,factory)=>{const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.BloubScenes=value;})(typeof globalThis==='object'?globalThis:this,()=>{
 const scene=(state,priority,seconds=0)=>({state,priority,seconds});
 const SCENES={
  idle:scene('idle',0),thinking:scene('thinking',70),processing:scene('thinking',70),
  listening:scene('wide',35),voiceListening:scene('wide',80),voicePaused:scene('sleep',80),
  replyStreaming:scene('wide',70),sleeping:scene('sleep',10),docked:scene('sleep',10),
  workbench:scene('hexagon',15),settings:scene('hexagon',15),tools:scene('hexagon',15),
  focusRunning:scene('hexagon',25),focusBreak:scene('sleep',25),
  agentWorking:{...scene('orbit',50),cycle:[['orbit',3.4],['idle',.7]]},
  soundscapePlaying:{...scene('play',20),cycle:[['play',2.4],['idle',5]]},
  attention:scene('exclaim',65),needsInput:scene('exclaim',65),
  failed:scene('alert',90,2.6),completed:scene('burst',75,2.8),
  greeting:scene('wink',55,2.2),interaction:scene('play',60,2.4),
  startup:scene('egg',18,1.8),wake:scene('egg',18,1.8),
  workbenchOpen:scene('swirl',66,1.3),toolsOpen:scene('swirl',66,1.3),settingsOpen:scene('swirl',66,1.3),
  notification:scene('notify',55,2.2),reminder:scene('exclaim',90,2.2),
  'dragging-left':{...scene('comet',100),cycle:[['comet',2.5],['idle',.5]]},
  'dragging-right':{...scene('comet',100),cycle:[['comet',2.5],['idle',.5]]},
 };
 const MINIMUM={alert:2,burst:2.4,comet:2.4,orbit:2.5,swirl:1.3};
 function gazeFor(animation,pointer,pitch){
  // The companion usually lives on the right edge, facing the workspace.
  // Orbit keeps its original full eye revolution; its motion is the animation.
  if(animation==='orbit')return null;
  const follow=['idle','swirl'].includes(animation)&&Number.isFinite(pointer?.x);
  return {yaw:follow?-28+Math.max(-1,Math.min(1,pointer.x))*18:-28,pitch:Number.isFinite(pitch)?pitch:0,mix:.92,spin:0,wander:follow?0:.25};
 }
 class ScenePlayer{
  constructor(now=0){this.base='idle';this.baseAt=now;this.pulseScene=null;this.pulseUntil=0;this.current=null;this.holdUntil=0;}
  set(scene,now){scene=SCENES[scene]?scene:'idle';if(scene===this.base)return;const keepDragClock=this.base.startsWith('dragging-')&&scene.startsWith('dragging-');this.base=scene;if(!keepDragClock)this.baseAt=now;}
  pulse(scene,now){const def=SCENES[scene];if(!def?.seconds||def.priority<SCENES[this.base].priority)return false;if(this.pulseScene&&now<this.pulseUntil&&(scene===this.pulseScene||def.priority<SCENES[this.pulseScene].priority))return false;this.pulseScene=scene;this.pulseUntil=now+def.seconds;return true;}
  sample(now){
   let name=this.base,at=this.baseAt;if(this.pulseScene&&now<this.pulseUntil&&SCENES[this.pulseScene].priority>=SCENES[this.base].priority){name=this.pulseScene;at=this.pulseUntil-SCENES[name].seconds;}
   else this.pulseScene=null;
   const def=SCENES[name];let state=def.state;
   if(def.cycle){let local=Math.max(0,now-at)%def.cycle.reduce((sum,row)=>sum+row[1],0);for(const row of def.cycle){if(local<row[1]){state=row[0];break;}local-=row[1];}}
   if(name==='idle'&&now-at>=32){const rest=(now-at-32)%64;state=rest<10?'sleep':rest<11.8?'egg':'idle';}
   // Never cut reassembly short for a lower-priority background scene. Urgent input wins.
   if(this.current&&state!==this.current.state&&now<this.holdUntil&&def.priority<this.current.priority)return {...this.current,changed:false};
   const changed=state!==this.current?.state;
   if(changed)this.holdUntil=now+(MINIMUM[state]||0);
   this.current={state,scene:name,priority:def.priority};return {...this.current,changed};
  }
 }
 return {SCENES,MINIMUM,ScenePlayer,gazeFor};
});
