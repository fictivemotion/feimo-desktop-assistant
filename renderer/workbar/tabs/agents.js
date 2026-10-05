'use strict';
/** Agents 页：会话卡片（等待输入置顶）、来源检测状态、可信度标注、返回原位置。 */
(() => {
  const api = window.api;
  const view = document.getElementById('view-agents');
  view.innerHTML = `
    <div id="ag-requests"></div><div class="source-status" id="ag-sources"></div>
    <div id="ag-list"></div>
    <div class="actionbar">
      <button class="btn small" id="ag-refresh">刷新</button>
      <span class="muted" id="ag-updated"></span>
    </div>`;

  const listEl = view.querySelector('#ag-list');
  const srcEl = view.querySelector('#ag-sources');
  const updatedEl = view.querySelector('#ag-updated');

  const STATUS = {
    needs_input: { label: '等待输入', cls: 'wait' },
    running: { label: '运行中', cls: 'run' },
    completed: { label: '已完成', cls: 'done' },
    failed: { label: '失败/中止', cls: 'fail' },
    stale: { label: '状态未更新', cls: 'stale' },
    idle: { label: '空闲', cls: 'stale' },
    unknown: { label: '未知', cls: 'stale' },
  };
  const SRC_NAMES = { codex: 'Codex', zcode: 'ZCode', workbuddy: 'WorkBuddy' };
  const CONF = { log: '日志', inferred: '推断', low: '低可信度' };

  let lastSnap = null;

  function render(snap) {
    lastSnap = snap;
    // 来源状态条
    srcEl.innerHTML = '';
    for (const d of snap.detected || []) {
      const b = document.createElement('span');
      b.className = 'badge ' + (d.installed ? 'done' : 'stale');
      b.textContent = `${SRC_NAMES[d.source] || d.source}：${d.installed ? '观察中' : '未检测到'}`;
      b.title = d.note || '';
      srcEl.appendChild(b);
    }

    listEl.innerHTML = '';
    if (!snap.sessions.length) {
      listEl.innerHTML = `<div class="empty"><span class="big" data-icon="CodeSquare" data-size="24"></span>
        暂无观察到的 Agent 会话<br/>
        <span class="muted">Codex / ZCode / WorkBuddy 运行新任务后会自动出现<br/>（只读观察，不写入 Agent 配置）</span></div>`;
    } else {
      for (const s of snap.sessions) {
        listEl.appendChild(renderCard(s));
      }
    }
    updatedEl.textContent = `更新于 ${new Date(snap.updatedAt).toLocaleTimeString('zh-CN')}`;
  }

  function renderCard(s) {
    const st = STATUS[s.status] || STATUS.unknown;
    const card = document.createElement('div');
    card.className = 'agent-card ' + (s.status === 'needs_input' ? 'wait' : s.status === 'failed' ? 'fail' : '');
    const projectName = s.project ? s.project.split(/[\\/]/).pop() : '';
    card.innerHTML = `
      <div class="row1">
        <span class="src ${s.source}">${SRC_NAMES[s.source] || s.source}</span>
        <span class="badge ${st.cls}">${st.label}</span>
        <span class="title" title="${UI.esc(s.project || s.title)}">${UI.esc(s.title)}</span>
      </div>
      <div class="summary">${UI.esc(s.lastSummary)}</div>
      <div class="meta">
        ${projectName ? `<span><span data-icon="Folder" data-size="16"></span> ${UI.esc(projectName)}</span>` : ''}
        <span>可信度：${CONF[s.confidence] || s.confidence}</span>
        ${s.staleNote ? `<span style="color:var(--amber)"><span data-icon="Stopwatch" data-size="16"></span> ${UI.esc(s.staleNote)}</span>` : ''}
        <span class="ago">${UI.ago(s.lastSeenAt)}</span>
      </div>`;
    const jump=document.createElement('button');jump.className='btn small';jump.textContent='跳转终端';jump.onclick=()=>IslandWidgets.safe(()=>api.agentTerminal(s.source+':'+s.sessionId));card.append(jump);
    return card;
  }

  view.querySelector('#ag-refresh').addEventListener('click', async () => {
    render(await api.agentsSnapshot());
  });

  let bridgeSignature='';
  const renderBridge=state=>{const next=JSON.stringify(state.bridge.requests);if(next===bridgeSignature)return;bridgeSignature=next;const box=view.querySelector('#ag-requests');box.replaceChildren();for(const r of state.bridge.requests){const child=document.createElement('div');IslandWidgets.requestCard(child,r);box.append(child);}};
  api.onIslandChanged(renderBridge);api.islandState().then(renderBridge).catch(()=>{});
  api.onAgentsSnapshot(render);
  api.agentsSnapshot().then(render);

  window.TABS.agents = {
    onShown: () => api.agentsSnapshot().then(render),
  };
})();
