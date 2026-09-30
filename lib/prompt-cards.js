'use strict';
/** Quota values come from observed Codex logs, never from token cost estimates. */
function quotaCard(limits, now = Date.now()) {
  const observed = Date.parse(limits?.observedAt);
  if (!Number.isFinite(observed) || now - observed > 86400000) return null;
  const windows = ['primary','secondary'].flatMap(key => {
    const v = limits?.[key];
    if (!v || typeof v.usedPercent !== 'number' || !Number.isFinite(v.usedPercent)) return [];
    const resetsAt = Number(v.resetsAt) * 1000;
    if (Number.isFinite(resetsAt) && resetsAt > 0 && resetsAt <= now) return [];
    const minutes = Number(v.windowMinutes);
    const label = minutes >= 1440 ? `${Math.round(minutes/1440)} 天窗口` : minutes > 0 ? `${minutes / 60} 小时窗口` : key === 'primary' ? '短期窗口' : '长期窗口';
    return [{ key, label, usedPercent: Math.max(0, Math.min(100, v.usedPercent)), resetsAt: Number.isFinite(resetsAt) && resetsAt > 0 ? new Date(resetsAt).toISOString() : null }];
  });
  return windows.length ? { kind:'quota', icon:'ChartBar', title:'Codex 额度', subtitle:limits.source==='api'?'来自 Codex 账户查询':'来自最近的会话记录', windows, action:'usage', actionLabel:'查看用量与额度', observedAt:limits.observedAt } : null;
}
class QuotaAlerts {
  constructor() { this.seen = new Map(); }
  next(limits, now = Date.now()) {
    const card=quotaCard(limits,now); if(!card) return null;
    let warn=false;
    for(const w of card.windows) {
      const key=`${w.key}:${w.resetsAt || new Date(now).toISOString().slice(0,10)}`;
      const level=w.usedPercent>=95?95:w.usedPercent>=80?80:0;
      if(level>(this.seen.get(key)||0)) warn=true;
      this.seen.set(key,Math.max(level,this.seen.get(key)||0));
    }
    if (this.seen.size>30) this.seen=new Map([...this.seen].slice(-20));
    return warn ? {...card, subtitle:'额度接近上限，留意剩余用量'} : null;
  }
}
function noticeCard(n) {
  const schedule=n.kind==='reminder';
  return { kind:schedule?'schedule':'agent', icon:schedule?'CalendarDays':n.kind==='failed'?'Warning':'CodeSquare', title:n.title||'Coding 会话', subtitle:schedule?'日程提醒':({needs_input:'等待你的输入',completed:'任务已完成',failed:'任务遇到问题'})[n.kind]||'会话有更新', text:String(n.summary||'').slice(0,180), action:schedule?'schedule':'agents', actionLabel:schedule?'查看日程':'查看会话' };
}
module.exports={quotaCard,QuotaAlerts,noticeCard};
