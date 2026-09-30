'use strict';
// Context only: the existing state priority and other pet appearances stay independent.
function petScene({state,voicePhase,processingMode,focus,soundscape,workbarVisible,workbarTab}={}){
 if(['starting','listening','finishing'].includes(voicePhase))return 'voiceListening';
 if(voicePhase==='paused')return 'voicePaused';
 if(voicePhase==='polishing')return 'thinking';
 if(state==='processing')return processingMode==='streaming'?'replyStreaming':'thinking';
 // A background Coding session must not mask the task the user is doing now.
 // Attention, completion and errors retain their existing precedence.
 if(state&&state!=='idle'&&state!=='agentWorking')return state;
 if(focus?.status==='running')return focus.stage==='break'?'focusBreak':'focusRunning';
 if(focus?.status==='paused')return 'sleeping';
 if(soundscape?.playing)return 'soundscapePlaying';
 if(workbarVisible)return workbarTab==='settings'?'settings':['tools','study'].includes(workbarTab)?'tools':'workbench';
 return state==='agentWorking'?'agentWorking':'idle';
}
module.exports={petScene};
