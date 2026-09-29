'use strict';
/** 用量页：今日/7日/30日、工具堆叠、输入/输出/缓存细分、限额、来源可信度、CSV 导出。
 *  信息层级参照 Token Monitor：首页精简，可下钻分组。数字必须能溯源。
 */
(() => {
  const api = window.api;
  const view = document.getElementById('view-usage');
  view.innerHTML = `
    <div class="usage-hero">
      <div class="stat"><div class="v" id="u-today-in">—</div><div class="l">今日输入</div></div>
      <div class="stat"><div class="v" id="u-today-out">—</div><div class="l">今日输出</div></div>
      <div class="stat sub"><div class="v" id="u-today-cost">—</div><div class="l">今日费用(估)</div></div>
    </div>

    <div class="card">
      <h3>近 7 日趋势 <span class="chart-hint">点击柱形查看每日明细</span></h3>
      <div class="usage-detail" id="u-chart-detail" aria-live="polite">将鼠标移到柱形上查看用量</div>
      <div class="usage-bars" id="u-chart"></div>
      <div class="legend" id="u-legend"></div>
    </div>

    <div class="card usage-heatmap-card">
      <div class="usage-section-head"><h3>活跃热力图</h3><div class="usage-range" role="group" aria-label="热力图时间范围"><button class="active" data-days="90">3 月</button><button data-days="180">6 月</button><button data-days="365">1 年</button></div></div>
      <div class="usage-detail" id="u-heatmap-detail" aria-live="polite">选择日期查看当天记录</div>
      <div class="usage-heatmap-scroll"><div class="usage-months" id="u-months"></div><div class="usage-heatmap" id="u-heatmap" role="grid" aria-label="每日 Token 使用热力图"></div></div>
      <div class="usage-heatmap-legend"><span>少</span><i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><i data-level="4"></i><span>多</span></div>
    </div>

    <div class="card">
      <h3>按工具（30 日）</h3>
      <div id="u-tools"></div>
    </div>

    <div class="card">
      <h3>按模型 · 前 8（30 日）</h3>
      <div id="u-models"></div>
      <div class="muted" style="margin-top:6px">费用为按公开定价表的<b>估算值</b>（${''}priceVersion 见导出），未知模型不计费</div>
    </div>

    <div class="card" id="u-limits-card" style="display:none">
      <h3>账户限额（Codex 接口上报）</h3>
      <div id="u-limits"></div>
      <div class="muted" style="margin-top:4px">限额与本地用量分开统计，不互相换算</div>
    </div>

    <div class="actionbar">
      <button class="btn" id="u-export">导出 CSV</button>
      <span class="muted" id="u-fresh"></span>
    </div>`;

  const TOOL_COLORS = { codex: '#6EF2CF', zcode: '#756BFF', workbuddy: '#FF91D8' };
  const TOOL_NAMES = { codex: 'Codex', zcode: 'ZCode', workbuddy: 'WorkBuddy' };
  let heatmapDays = [];
  let rangeDays = 90;
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function describeDay(d) {
    return `${d.key} · 输入 ${UI.fmtTokens(d.input)} · 输出 ${UI.fmtTokens(d.output)} · ${d.requests} 次请求 · ${UI.fmtCost(d.cost)}（估）`;
  }

  function renderHeatmap() {
    const byDate = new Map(heatmapDays.map((d) => [d.key, d]));
    const grid = view.querySelector('#u-heatmap');
    const months = view.querySelector('#u-months');
    grid.innerHTML = '';
    months.innerHTML = '';
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(start.getDate() - rangeDays + 1);
    const first = new Date(start); first.setDate(first.getDate() - first.getDay());
    const counts = heatmapDays.map((d) => d.input + d.output).filter(Boolean).sort((a, b) => a - b);
    const high = counts[Math.floor(counts.length * .8)] || 1;
    let col = 0;
    let lastMonth = null;
    for (let day = new Date(first); day <= end; day.setDate(day.getDate() + 1)) {
      const key = dayKey(day);
      const d = byDate.get(key) || { key, input: 0, output: 0, requests: 0, cost: 0 };
      const n = d.input + d.output;
      const level = !n ? 0 : Math.min(4, Math.max(1, Math.ceil(n / high * 3)));
      const cell = document.createElement('button');
      cell.type = 'button'; cell.className = 'usage-day'; cell.dataset.level = String(level);
      cell.dataset.date = key; cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', describeDay(d)); cell.title = describeDay(d);
      if (day < start) { cell.classList.add('outside'); cell.tabIndex = -1; }
      else {
        const detail = () => { view.querySelector('#u-heatmap-detail').textContent = describeDay(d); };
        cell.addEventListener('mouseenter', detail);
        cell.addEventListener('focus', detail);
        cell.addEventListener('click', () => {
          grid.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
          cell.classList.add('selected'); detail();
        });
      }
      grid.appendChild(cell);
      if (day.getDay() === 0) {
        const labelDate = day < start ? start : day;
        const month = labelDate.getMonth();
        if ((day.getDate() <= 7 || col === 0) && month !== lastMonth) {
          const m = document.createElement('span'); m.textContent = `${month + 1}月`;
          m.style.left = `${col * 11}px`; months.appendChild(m);
          lastMonth = month;
        }
        col++;
      }
    }
    grid.style.setProperty('--weeks', String(col));
    months.style.setProperty('--weeks', String(col));
  }

  view.querySelectorAll('.usage-range button').forEach((btn) => btn.addEventListener('click', () => {
    rangeDays = Number(btn.dataset.days);
    view.querySelectorAll('.usage-range button').forEach((b) => b.classList.toggle('active', b === btn));
    renderHeatmap();
  }));

  function render(u) {
    heatmapDays = u?.heatmapDays || [];
    renderHeatmap();
    if (!u || !u.totalFacts) {
      view.querySelector('.usage-hero').innerHTML = `<div class="stat" style="flex:1"><div class="v">—</div><div class="l">暂无可靠统计</div></div>`;
      view.querySelector('#u-chart').closest('.card').style.display = 'none';
      view.querySelector('#u-tools').closest('.card').style.display = 'none';
      view.querySelector('#u-models').closest('.card').style.display = 'none';
      view.querySelector('#u-fresh').textContent = '启动 Agent 会话后自动采集（只读解析本机日志）';
      return;
    }

    view.querySelector('#u-today-in').textContent = UI.fmtTokens(u.today.input);
    view.querySelector('#u-today-out').textContent = UI.fmtTokens(u.today.output);
    view.querySelector('#u-today-cost').textContent = UI.fmtCost(u.today.cost);

    // 7 日趋势：每一天均可鼠标、键盘查看并固定明细。
    const byDate = new Map(u.perDay.map((d) => [d.key, d]));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(today); dt.setDate(dt.getDate() - 6 + i);
      const key = dayKey(dt);
      return byDate.get(key) || { key, input: 0, output: 0, requests: 0, cost: 0 };
    });
    const chart = view.querySelector('#u-chart');
    chart.closest('.card').style.display = '';
    view.querySelector('#u-tools').closest('.card').style.display = '';
    view.querySelector('#u-models').closest('.card').style.display = '';
    if (days.length) {
      const max = Math.max(...days.map((d) => d.input + d.output), 1);
      chart.innerHTML = '';
      for (const d of days) {
        const bar = document.createElement('button');
        bar.type = 'button'; bar.className = 'usage-bar'; bar.title = describeDay(d);
        bar.setAttribute('aria-label', describeDay(d));
        const inPct = Math.max(0, d.input / max * 100);
        const outPct = Math.max(0, d.output / max * 100);
        bar.innerHTML = `<span class="usage-bar-stack"><i class="out" style="height:${outPct}%"></i><i class="in" style="height:${inPct}%"></i></span><span class="usage-bar-date">${d.key.slice(5).replace('-', '/')}</span>`;
        const detail = () => { view.querySelector('#u-chart-detail').textContent = describeDay(d); };
        bar.addEventListener('mouseenter', detail); bar.addEventListener('focus', detail);
        bar.addEventListener('click', () => { chart.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected')); bar.classList.add('selected'); detail(); });
        chart.appendChild(bar);
      }
    }
    view.querySelector('#u-legend').innerHTML = `
      <span class="it"><span class="sw" style="background:#6EF2CF"></span>输入（含缓存计为输入口径）</span>
      <span class="it"><span class="sw" style="background:#756BFF"></span>输出</span>`;

    // 按工具
    const toolsEl = view.querySelector('#u-tools');
    toolsEl.innerHTML = '';
    const maxTool = Math.max(...u.perTool.map((t) => t.input + t.output), 1);
    for (const t of u.perTool) {
      const row = document.createElement('div');
      row.className = 'usage-row';
      const pct = ((t.input + t.output) / maxTool) * 100;
      row.innerHTML = `
        <span class="nm">${TOOL_NAMES[t.key] || t.key}</span>
        <div style="flex:1.4;height:7px;border-radius:4px;background:var(--surface-2);overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${TOOL_COLORS[t.key] || '#AAB3C4'}"></div>
        </div>
        <span class="val">入 ${UI.fmtTokens(t.input)} / 出 ${UI.fmtTokens(t.output)}</span>
        <span class="val" title="估算费用">${UI.fmtCost(t.cost)}</span>`;
      toolsEl.appendChild(row);
    }
    if (!u.perTool.length) toolsEl.innerHTML = '<div class="muted">暂无数据</div>';

    // 按模型
    const modelsEl = view.querySelector('#u-models');
    modelsEl.innerHTML = '';
    for (const m of u.perModel.slice(0, 8)) {
      const row = document.createElement('div');
      row.className = 'usage-row';
      row.innerHTML = `
        <span class="nm mono" title="${UI.esc(m.key)}">${UI.esc(m.key)}</span>
        <span class="val">入 ${UI.fmtTokens(m.input)} · 出 ${UI.fmtTokens(m.output)} · 缓存读 ${UI.fmtTokens(m.cacheRead)}</span>
        <span class="val">${m.key.includes('unknown') ? '不计费' : UI.fmtCost(m.cost)}</span>`;
      modelsEl.appendChild(row);
    }

    view.querySelector('#u-fresh').textContent =
      `数据新鲜度：${u.freshness != null ? UI.ago(new Date(Date.now() - u.freshness * 1000).toISOString()) : '无数据'} · ${u.totalFacts} 条记录 · 报告值口径`;
  }

  function renderLimits(snap) {
    const card = view.querySelector('#u-limits-card');
    const el = view.querySelector('#u-limits');
    const limits = snap?.limits || {};
    const entries = Object.entries(limits);
    if (!entries.length) { card.style.display = 'none'; return; }
    card.style.display = '';
    el.innerHTML = '';
    for (const [provider, l] of entries) {
      for (const [k, scope] of [['primary', '主限额'], ['secondary', '周限额']]) {
        const x = l[k];
        if (!x) continue;
        const resets = x.resetsAt ? new Date(x.resetsAt * 1000).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        const row = document.createElement('div');
        row.style.marginBottom = '8px';
        row.innerHTML = `
          <div style="display:flex;justify-content:space-between;font-size:12px">
            <span>${TOOL_NAMES[provider] || provider} · ${scope}</span>
            <span class="mono">${x.usedPercent}% · 重置 ${resets}</span>
          </div>
          <div class="limit-bar"><div style="width:${Math.min(100, x.usedPercent)}%"></div></div>`;
        el.appendChild(row);
      }
    }
  }

  view.querySelector('#u-export').addEventListener('click', async () => {
    const r = await api.usageExport();
    if (r.ok) UI.toast('已导出：' + r.path);
  });

  api.usageAggregate().then(render);
  api.onUsageUpdated(render);
  api.onAgentsSnapshot((snap) => { renderLimits(snap); if (snap.detected) { /* noop */ } });
  api.agentsSnapshot().then((snap) => renderLimits(snap));

  window.TABS.usage = { onShown: () => api.usageAggregate().then(render) };
})();
