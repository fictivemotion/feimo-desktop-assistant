'use strict';
(()=>{
 const pinned=new Map(),dismissed=new Set();let latest=[],lastKey='',preferred='',touched=0;
 function rows(state){const c=state.conversation||{};let live=null;
  if(c.active){const key='c'+c.id+':'+(c.replyId||'input'),assistant=c.role==='assistant';
   live={key,kind:'conversation',role:c.role,title:assistant?'斐墨 · 语音回答':c.phase==='thinking'?'斐墨 · 思考中':'斐墨 · 语音对话',text:c.text||'天才斐墨，为您服务🌹',full:assistant?c.answer:'',active:true};
   if(key!==lastKey){lastKey=key;preferred=key;touched=0;}else preferred='';
   if(pinned.has(key)&&assistant)pinned.set(key,{...live});
   if(assistant&&c.replyAt&&Date.now()-Math.max(c.replyAt,touched)>=10000&&!pinned.has(key))live=null;
  }else{lastKey='';preferred='';}
  latest=[...(live&&!dismissed.has(live.key)?[live]:[]),...Array.from(pinned.values()).filter(item=>item.key!==live?.key&&!dismissed.has(item.key)).map(item=>({...item,active:!!c.active}))];return latest;
 }
 window.FeimoConversationCards={rows,preferred:()=>preferred,pin:key=>{const item=latest.find(x=>x.key===key);if(item?.role==='assistant')pinned.set(key,{...item});},close:key=>{pinned.delete(key);dismissed.add(key);if(dismissed.size>100)dismissed.delete(dismissed.values().next().value);},touch:()=>{touched=Date.now();}};
})();
