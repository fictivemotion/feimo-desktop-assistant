'use strict';
/** 日程页：下一项 + 今日时间线（全天置顶）、快速新建、Notion 数据库同步、来源标签。 */
(() => {
  const api = window.api;
  const view = document.getElementById('view-schedule');
  view.innerHTML = `
    <div class="next-card" id="sc-next" style="display:none"></div>

    <div class="card">
      <h3>快速记录</h3>
      <div class="field"><input type="text" id="sc-title" placeholder="日程标题，如：设计评审"/></div>
      <div style="display:flex;gap:8px">
        <div class="field" style="flex:1"><label>开始时间</label><input type="datetime-local" id="sc-start"/></div>
        <div class="field" style="flex:1"><label>提醒</label>
          <select id="sc-remind">
            <option value="0">开始时</option>
            <option value="5">提前 5 分钟</option>
            <option value="15" selected>提前 15 分钟</option>
            <option value="30">提前 30 分钟</option>
            <option value="-1">不提醒</option>
          </select>
        </div>
        <div class="field" style="flex:none;display:flex;align-items:flex-end"><button class="btn primary" id="sc-add">添加</button></div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <h3 style="margin:0">今日日程</h3>
        <button class="btn small" id="sc-sync">同步 Notion</button>
      </div>
      <div class="timeline" id="sc-today"></div>
      <div class="muted" id="sc-sync-status" style="margin-top:8px"></div>
    </div>

    <div class="card">
      <h3>未来 7 天</h3>
      <div class="timeline" id="sc-upcoming"></div>
    </div>`;

  const SRC_LABEL = { local: '本地', notion: 'Notion 数据库', google: 'Google 日历' };
  const SRC_BADGE = { local: 'local', notion: 'done', google: 'inferred' };

  function fmtTime(iso, allDay) {
    if (allDay) return '全天';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function render(v) {
    // 下一项
    const nextCard = view.querySelector('#sc-next');
    const now = Date.now();
    const upcomingTimed = (v.upcoming || []).filter((i) => !i.allDay && new Date(i.startsAtUtc).getTime() > now);
    if (upcomingTimed.length) {
      const n = upcomingTimed[0];
      const mins = Math.round((new Date(n.startsAtUtc).getTime() - now) / 60000);
      const when = mins >= 90 ? n.startsLocal : (mins <= 0 ? '进行中' : `${mins} 分钟后`);
      nextCard.style.display = '';
      nextCard.innerHTML = `<div class="t">${UI.esc(n.title)}</div><div class="when"><span data-icon="Clock" data-size="16"></span> ${UI.esc(when)} · ${UI.esc(n.startsLocal)} · 来源：${SRC_LABEL[n.source] || n.source}</div>`;
    } else {
      nextCard.style.display = 'none';
    }

    // 今日
    const todayEl = view.querySelector('#sc-today');
    todayEl.innerHTML = '';
    const today = v.today || [];
    if (!today.length) {
      todayEl.innerHTML = '<div class="muted" style="padding:4px 0">今天暂无日程</div>';
    } else {
      for (const it of today) todayEl.appendChild(item(it, now));
    }

    // 未来
    const upEl = view.querySelector('#sc-upcoming');
    upEl.innerHTML = '';
    const future = (v.upcoming || []).filter((i) => new Date(i.startsAtUtc).toDateString() !== new Date().toDateString());
    if (!future.length) {
      upEl.innerHTML = '<div class="muted" style="padding:4px 0">未来 7 天暂无日程</div>';
    } else {
      for (const it of future) upEl.appendChild(item(it, now));
    }
  }

  function item(it, now) {
    const start = new Date(it.startsAtUtc).getTime();
    const end = new Date(it.endsAtUtc || it.startsAtUtc).getTime();
    const isNow = start <= now && end >= now;
    const past = end < now;
    const el = document.createElement('div');
    el.className = 'tl-item' + (isNow ? ' now' : past ? ' past' : '');
    el.innerHTML = `
      <div class="row">
        <span class="time">${fmtTime(it.startsAtUtc, it.allDay)}</span>
        <span class="title" title="${UI.esc(it.title)}">${UI.esc(it.title)}</span>
        <span class="badge ${SRC_BADGE[it.source] || ''}">${SRC_LABEL[it.source] || it.source}</span>
        <span class="ops">
          ${it.source === 'local' ? '<button class="btn small danger op-del" title="删除"><span data-icon="CloseCircle" data-size="16"></span></button>' : ''}
          ${it.sourceUrl ? '<button class="btn small op-src" title="在 Notion 中打开"><span data-icon="ArrowUpRight" data-size="16"></span></button>' : ''}
        </span>
      </div>`;
    const del = el.querySelector('.op-del');
    if (del) del.addEventListener('click', async () => {
      await api.calendarRemove(it.source, it.externalId);
      UI.toast('已删除');
    });
    const srcBtn = el.querySelector('.op-src');
    if (srcBtn) srcBtn.addEventListener('click', () => api.openExternal(it.sourceUrl).catch((e) => UI.toast(e.message, true)));
    return el;
  }

  // 新建
  const startInput = view.querySelector('#sc-start');
  function defaultTime() {
    const d = new Date(Date.now() + 3600e3);
    d.setMinutes(0, 0, 0);
    const p = (n) => String(n).padStart(2, '0');
    startInput.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  defaultTime();
  view.querySelector('#sc-add').addEventListener('click', async () => {
    const title = view.querySelector('#sc-title').value.trim();
    const start = startInput.value;
    if (!title) return UI.toast('请填写标题', true);
    if (!start) return UI.toast('请选择时间', true);
    const remindVal = view.querySelector('#sc-remind').value;
    const offsets = remindVal === '-1' ? [] : [parseInt(remindVal, 10)];
    try {
      await api.calendarAdd({ title, startsAtUtc: new Date(start).toISOString(), reminderOffsets: offsets });
      view.querySelector('#sc-title').value = '';
      defaultTime();
      UI.toast('已添加日程');
    } catch (e) {
      UI.toast(e.message, true);
    }
  });

  // Notion 同步
  view.querySelector('#sc-sync').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true; btn.textContent = '同步中…';
    const r = await api.calendarSyncNotion();
    btn.disabled = false; btn.textContent = '同步 Notion';
    if (r.ok) UI.toast(`已同步 ${r.count} 条日程`);
    else if (r.code === 'NOT_CONFIGURED') UI.toast('Notion 未配置：设置 → 日程同步', true);
    else UI.toast(r.error, true);
  });

  function refreshStatus() {
    api.calendarNotionStatus().then((s) => {
      const el = view.querySelector('#sc-sync-status');
      if (s.configured) el.textContent = `Notion 同步：已配置，上次同步 ${s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString('zh-CN') : '进行中…'}（每 30 分钟自动）`;
      else el.textContent = 'Notion 同步：未配置 → 设置 → 日程同步';
    });
  }

  api.calendarView().then(render);
  api.onCalendarChanged(render);
  api.onCalendarSyncResult(() => { refreshStatus(); api.calendarView().then(render); });
  refreshStatus();

  window.TABS.schedule = { onShown: () => { api.calendarView().then(render); refreshStatus(); } };
})();
