'use strict';
// A single, sticky selection for the capsule. Background polls must not reset it.
((root) => {
  const clock = ms => {const n=Math.ceil(Math.max(0,ms||0)/1000);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
  function activities(s,now=Date.now()) {
    const rows=[],v=s.voice||{},f=s.focus?.active,m=s.music||{},requests=s.bridge?.requests||[];
    if(v.active)rows.push({id:'voice',name:'斐墨语音',line:v.message||'正在听写'});
    if(requests.length)rows.push({id:'attention',name:'等待你的决定',line:`${requests.length} 项工具操作 / 问题`});
    if(f)rows.push({id:'focus',name:s.focus.labels?.find(l=>l.id===f.labelId)?.name||'专注计时',line:clock(f.remainingMs)+(f.status==='paused'?' · 已暂停':' · 专注中')});
    if(m.available&&m.playing)rows.push({id:'music',name:'Music',line:m.title||'音乐播放'});
    const live=s.agents?.sessions?.find(a=>a.status==='needs_input')||s.agents?.sessions?.find(a=>a.status==='running');
    if(live)rows.push({id:'agent',name:({codex:'Codex',claude:'Claude Code',zcode:'ZCode',workbuddy:'WorkBuddy'})[live.source]||live.source,line:live.lastSummary||live.title||'正在工作'});
    if(s.noise?.playing)rows.push({id:'noise',name:'白噪音',line:'留一段安静给自己'});
    if(m.available&&!m.playing)rows.push({id:'music',name:'Music',line:m.title||'音乐播放'});
    const notice=s.notices?.find(n=>now-n.id<60000);
    if(notice)rows.push({id:'notice',name:'斐墨提醒',line:notice.text});
    return rows;
  }
  class Selection {
    update(rows){this.rows=rows;if(!this.manual||!rows.some(r=>r.id===this.id)){this.manual=false;this.id=rows[0]?.id||'idle';}return this.current();}
    current(){return this.rows?.find(r=>r.id===this.id)||{id:'idle',name:'斐墨',line:'你的顶部工作台'};}
    next(){this.manual=true;const rows=this.rows||[];if(rows.length)this.id=rows[(rows.findIndex(r=>r.id===this.id)+1)%rows.length].id;return this.current();}
  }
  const api={activities,Selection};if(typeof module==='object')module.exports=api;else root.CompactState=api;
})(typeof window==='object'?window:globalThis);
