'use strict';
/** 设置页（齿轮入口，非页签）：模型服务、宠物形象、热键、Agent 监控、日程同步、隐私。 */
(() => {
  const api = window.api;
  const view = document.getElementById('view-settings');
  let settings = null;
  let pets = [];

  async function build() {
    settings = await api.getSettings();
    pets = await api.getPets();
    const hasKey = await api.hasSecret('llmApiKey');
    const clean = await api.textCleanStatus();
    const hasNotion = await api.hasSecret('notionToken');
    const hk = settings.hotkeys || {};
    const ag = settings.agents || {};
    const llm = settings.llm || {};
    const notion = settings.notion || {};
    const cal = settings.calendar || {};
    const pet = settings.pet || {};
    const system = await api.systemState();

    view.innerHTML = `
      <div class="settings-top" style="align-items:center;justify-content:space-between;margin-bottom:12px">
        <h3><span data-icon="Setting" data-size="20"></span> 设置</h3>
        <button class="btn small" id="st-back">返回（Esc）</button>
      </div>

      <div class="settings-section">
        <h4><span data-icon="Widget" data-size="16"></span> Windows 启动</h4>
        <div class="card">
          <div class="switch"><span class="lbl">开机自启动<span class="sub">登录 Windows 后，让斐墨在桌面陪着你</span></span>
            <label class="toggle"><input type="checkbox" id="st-startup" ${system.openAtLogin ? 'checked' : ''}/><span class="track"></span><span class="knob"></span></label></div>
          <button class="btn" id="st-shortcut">创建桌面快捷方式</button>
          <button class="btn" id="st-connections">顶部模式 · 会话桥接 · 服务连接</button>
        </div>
      </div>

      <div class="settings-section">
        <h4><span data-icon="Cpu" data-size="16"></span> 模型服务（问答）</h4>
        <div class="card">
          <div class="field"><label>接口地址（OpenAI 兼容 /chat/completions）</label>
            <input type="text" id="st-baseurl" placeholder="https://api.openai.com/v1" value="${UI.esc(llm.baseUrl || '')}"/>
          </div>
          <div class="field"><label>模型名</label>
            <input type="text" id="st-model" placeholder="例如 gpt-5-mini / glm-5 / deepseek-chat" value="${UI.esc(llm.model || '')}"/>
          </div>
          <div class="field"><label>API 密钥 <span class="badge ${hasKey ? 'done' : ''}" id="st-key-state">${hasKey ? '本机已保存' : '未设置'}</span></label>
            <input type="password" id="st-key" autocomplete="new-password" placeholder="${hasKey ? '••••••••（输入新密钥才会替换）' : '填写 API 密钥'}"/>
            <div class="hint" id="st-key-hint">${hasKey ? '密钥已加密保存在本机，重启后仍可使用；为安全起见，这里不显示原文。' : '保存后加密存放在本机，重启后继续使用。'}</div>
          </div>
          <div class="field"><label>系统提示词（可选）</label>
            <input type="text" id="st-sys" placeholder="例：你是简洁的桌面助手，回答不超过 200 字" value="${UI.esc(llm.systemPrompt || '')}"/>
          </div>
          <button class="btn primary" id="st-save-llm">保存模型配置</button>
          <button class="btn" id="st-test-llm">测试连接</button>
        </div>
      </div>

      <div class="settings-section">
        <h4><span data-icon="Broom" data-size="16"></span> AI 文字清洗</h4>
        <div class="card">
          <p>DeepSeek V4.1 Flash · 非思考模式。文字快捷清洗、OCR 后清洗与工作台共用此服务。</p>
          <p class="muted">图片仍在本地识别；待清洗的正文发送到 DeepSeek。清洗失败保留原文，不覆盖剪贴板。</p>
          <div class="field"><label>DeepSeek API 密钥 <span class="badge ${clean.configured?'done':''}" id="st-clean-state">${clean.configured?'可用':'未设置'}</span></label>
            <input type="password" id="st-clean-key" autocomplete="new-password" placeholder="填写专用密钥；留空保留当前配置">
            <div class="hint" id="st-clean-hint">${UI.esc(clean.credentialLabel)} · 密钥仅在本机加密保存，不随开源版本分发。</div>
          </div>
          <div class="actionbar"><button class="btn primary" id="st-save-clean">保存清洗密钥</button><button class="btn" id="st-test-clean">测试清洗</button></div>
          <details style="margin-top:12px"><summary>查看规范化清洗提示词</summary><div class="field" style="margin-top:10px"><textarea readonly rows="8" aria-label="文字清洗提示词">${UI.esc(clean.prompt)}</textarea></div></details>
        </div>
      </div>

      <div class="settings-section">
        <h4><span data-icon="Paw" data-size="16"></span> 宠物形象</h4>
        <div class="card">
          <div class="pet-grid" id="st-pets"></div>
          <div style="margin-top:10px;display:flex;align-items:center;gap:10px">
            <span class="muted">尺寸</span>
            <select id="st-size" class="btn" style="padding:5px 8px">
              <option value="56" ${pet.size == 56 ? 'selected' : ''}>小 (56)</option>
              <option value="72" ${pet.size == 72 ? 'selected' : ''}>标准 (72)</option>
              <option value="96" ${pet.size == 96 ? 'selected' : ''}>大 (96)</option>
            </select>
            <div class="switch" style="flex:1"><span class="lbl">始终置顶</span>
              <label class="toggle"><input type="checkbox" id="st-top" ${pet.alwaysOnTop !== false ? 'checked' : ''}/><span class="track"></span><span class="knob"></span></label>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h4><span data-icon="ChatDots" data-size="16"></span> 小助手的声音</h4>
        <div class="card">
          <div class="switch"><span class="lbl">悬浮对话<span class="sub">靠近宠物时打招呼，日程和 Coding 更新时主动说话</span></span>
            <label class="toggle"><input type="checkbox" id="st-speech" ${settings.ui?.companionSpeech !== false ? 'checked' : ''}/><span class="track"></span><span class="knob"></span></label></div>
          <div class="switch"><span class="lbl">偶尔问候与休息提示<span class="sub">仅在白天且你正在使用电脑时出现</span></span>
            <label class="toggle"><input type="checkbox" id="st-ambient" ${settings.ui?.ambientSpeech !== false ? 'checked' : ''}/><span class="track"></span><span class="knob"></span></label></div>
        </div>
      </div>

      <div class="settings-section">
        <h4><span data-icon="Keyboard" data-size="16"></span> 全局热键</h4>
        <div class="card">
          <div class="hotkey-row"><span class="lbl">唤起 / 收起工作栏</span><input type="text" id="st-hk1" value="${UI.esc(hk.show || '')}"/></div>
          <div class="hotkey-row"><span class="lbl">文本清洗并复制结果</span><input type="text" id="st-hk2" value="${UI.esc(hk.processClipboard || 'Alt+Shift+O')}"/></div>
          <div class="hotkey-row"><span class="lbl">图片提字并复制结果</span><input type="text" id="st-hk3" value="${UI.esc(hk.ocrClipboard || 'Alt+Shift+T')}"/></div>
          <div class="hint" style="margin-top:6px">格式：Alt+Shift+P / Ctrl+Alt+T 等；保存后立即生效，冲突时注册失败不提示覆盖</div>
          <button class="btn primary" id="st-save-hk" style="margin-top:8px">保存热键</button>
        </div>
      </div>

      <div class="settings-section">
        <h4><span data-icon="CodeSquare" data-size="16"></span> Agent 监控</h4>
        <div class="card">
          <div class="switch"><span class="lbl">Codex（~/.codex/sessions）</span>
            <label class="toggle"><input type="checkbox" class="st-src" data-src="codex" ${ag.sources?.codex !== false ? 'checked' : ''}/><span class="track"></span><span class="knob"></span></label></div>
          <div class="switch"><span class="lbl">ZCode（~/.zcode/cli/rollout）</span>
            <label class="toggle"><input type="checkbox" class="st-src" data-src="zcode" ${ag.sources?.zcode !== false ? 'checked' : ''}/><span class="track"></span><span class="knob"></span></label></div>
          <div class="switch"><span class="lbl">WorkBuddy（~/.workbuddy）</span>
            <label class="toggle"><input type="checkbox" class="st-src" data-src="workbuddy" ${ag.sources?.workbuddy !== false ? 'checked' : ''}/><span class="track"></span><span class="knob"></span></label></div>
          <div class="switch"><span class="lbl">事件通知<span class="sub">完成/等待输入/失败时弹系统通知</span></span>
            <label class="toggle"><input type="checkbox" id="st-mute" ${!ag.muteNotifications ? 'checked' : ''}/><span class="track"></span><span class="knob"></span></label></div>
          <div class="hint">只读观察，不会修改任何 Agent 的配置或写入 hooks；重启应用后生效</div>
        </div>
      </div>

      <div class="settings-section schedule-settings">
        <h4><span data-icon="CalendarDays" data-size="16"></span> 日程同步</h4>
        <div class="card">
          <div class="schedule-settings-head"><div><strong>连接 Notion 日历</strong><span>从你的数据库读取日程，提醒会由小伙伴主动说出</span></div><span class="badge ${hasNotion && notion.databaseId ? 'done' : ''}">${hasNotion && notion.databaseId ? '已连接' : '待连接'}</span></div>
          <div class="schedule-step"><span class="schedule-step-no">1</span><div><b>授权数据库</b><p>在 Notion 创建 Integration，并将它添加到日程数据库的连接中。</p></div></div>
          <div class="schedule-step"><span class="schedule-step-no">2</span><div><b>填写连接信息</b><p>Token 只保存在本机；日程同步为只读。</p></div></div>
          <div class="field"><label>Integration Token ${hasNotion ? '<span class="badge done">已保存</span>' : ''}</label>
            <input type="password" id="st-ntoken" placeholder="${hasNotion ? '留空保持现有 Token' : 'ntn_…'}"/></div>
          <div class="field"><label>数据库链接或 ID</label>
            <input type="text" id="st-ndb" placeholder="粘贴 Notion 数据库链接" value="${UI.esc(notion.databaseId || '')}"/></div>
          <details class="schedule-advanced"><summary>属性映射 <span>数据库字段名不同时展开设置</span></summary>
            <div class="schedule-fields"><div class="field"><label>标题属性</label><input type="text" id="st-ntitle" placeholder="Name" value="${UI.esc(notion.titleProperty || 'Name')}"/></div>
            <div class="field"><label>日期属性</label><input type="text" id="st-ndate" placeholder="Date / 日期" value="${UI.esc(notion.dateProperty || '')}"/></div></div>
          </details>
          <div class="switch schedule-auto"><span class="lbl">自动同步<span class="sub">每 30 分钟检查新日程</span></span>
            <label class="toggle"><input type="checkbox" id="st-nauto" ${cal.notionAutoSync !== false ? 'checked' : ''}/><span class="track"></span><span class="knob"></span></label></div>
          <button class="btn primary schedule-connect" id="st-save-notion">保存并测试连接</button>
        </div>
      </div>

      <div class="settings-section">
        <h4><span data-icon="ShieldLock" data-size="16"></span> 隐私</h4>
        <div class="card">
          <div class="switch"><span class="lbl">保存问答历史<span class="sub">仅保存在本机；关闭后重启清空</span></span>
            <label class="toggle"><input type="checkbox" id="st-hist" ${settings.privacy?.saveChatHistory !== false ? 'checked' : ''}/><span class="track"></span><span class="knob"></span></label></div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn small danger" id="st-clear-chat">清空问答历史</button>
            <button class="btn small danger" id="st-clear-usage">清理 1 年前用量数据</button>
          </div>
          <div class="hint" style="margin-top:8px">
            本地优先：剪贴板仅在点击/热键时读取；OCR 本地运行；密钥存于 Windows 凭据（DPAPI）；
            用量统计不记录 prompt 与回复内容。
          </div>
        </div>
      </div>

      <div class="settings-section support-section">
        <h4><span data-icon="Heart" data-size="16"></span> 支持开发者</h4>
        <div class="card support-card"><span class="support-kicker">THANK YOU FOR BEING HERE</span><h2>朕心甚悦，赏！</h2><p class="muted">如果斐墨帮你省下了一点时间，欢迎请开发者喝杯茶。自愿赞赏，金额随心。</p>
          <div class="support-codes"><figure><a href="../../assets/support/alipay.jpg" data-support-code="支付宝"><img src="../../assets/support/alipay.jpg" alt="开发者支付宝收款码" loading="lazy"></a><figcaption>支付宝</figcaption></figure><figure><a href="../../assets/support/wechat.png" data-support-code="微信支付"><img src="../../assets/support/wechat.png" alt="开发者微信收款码" loading="lazy"></a><figcaption>微信支付</figcaption></figure></div>
          <p class="support-note">点击收款码查看大图 · 感谢每一份支持</p>
        </div>
      </div>
      <div class="settings-section">
        <h4><span data-icon="InfoCircle" data-size="16"></span> 关于</h4>
        <div class="card muted">
          斐墨 v${UI.esc(system.version)} · Opal Desk<br/>
            形象：伊埃斯、Bloub、Forest Flow、Iridescent Opal；形象许可见项目文档<br/>
          参考：Ping Island 状态优先级思路 · Token Monitor 用量信息层级（Apache-2.0 / MIT，未复制代码）
        </div>
      </div>`;

    // ---------- 事件 ----------
    view.querySelectorAll('[data-support-code]').forEach(link=>link.addEventListener('click',event=>{
      event.preventDefault();document.querySelector('.support-preview')?.remove();
      const preview=document.createElement('dialog');preview.className='support-preview';preview.setAttribute('aria-label',link.dataset.supportCode+'收款码');
      const image=document.createElement('img');image.src=link.href;image.alt=link.dataset.supportCode+'收款码';
      const close=document.createElement('button');close.type='button';close.className='btn';close.textContent='关闭大图';close.onclick=()=>preview.close();
      preview.append(image,close);document.body.append(preview);preview.addEventListener('close',()=>preview.remove());preview.addEventListener('click',e=>{if(e.target===preview)preview.close()});preview.showModal();
    }));
    const categories = [['general','常规'],['model','模型'],['shortcuts','快捷键'],['connections','连接'],['privacy','隐私'],['support','赞赏']];
    const nav = document.createElement('nav'); nav.className = 'settings-nav'; nav.setAttribute('aria-label', '设置分类');
    const sections = [...view.querySelectorAll('.settings-section')];
    sections.forEach(section => {
      const title = section.querySelector('h4').textContent;
      section.dataset.group = /支持开发者/.test(title) ? 'support' : /模型|AI 文字清洗/.test(title) ? 'model' : /全局热键/.test(title) ? 'shortcuts' : /Agent|Notion|日程同步/.test(title) ? 'connections' : /隐私/.test(title) ? 'privacy' : 'general';
    });
    function showGroup(group) {
      sections.forEach(section => { section.hidden = section.dataset.group !== group; });
      nav.querySelectorAll('button').forEach(button => { button.classList.toggle('active', button.dataset.settingsGroup === group); button.setAttribute('aria-pressed', button.dataset.settingsGroup === group); });
      view.scrollTop = 0;
    }
    for (const [id,label] of categories) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.settingsGroup = id; button.textContent = label;
      button.addEventListener('click', () => showGroup(id)); nav.appendChild(button);
    }
    view.prepend(nav); showGroup('general');
    view.querySelector('#st-back').addEventListener('click', () => window.switchTab('chat'));

    // 宠物选择
    const petGrid = view.querySelector('#st-pets');
    for (const p of pets) {
      const c = document.createElement('div');
      c.className = 'pet-card' + (pet.style === p.id ? ' sel' : '');
      c.innerHTML = `<div class="pet-preview"></div><div class="nm">${UI.esc(p.name)}</div>`;
      const preview = c.querySelector('.pet-preview');
      if (p.type === 'orb') {
        const frame = document.createElement('iframe');
          frame.src = `../../${p.orb}${p.id==='bloub'?'?preview=1':''}`;
        frame.title = p.name;
        frame.tabIndex = -1;
        preview.appendChild(frame);
      } else preview.appendChild(window.PetAvatar.eous(72));
      c.title = p.description;
      c.addEventListener('click', async () => {
        petGrid.querySelectorAll('.pet-card').forEach((x) => x.classList.remove('sel'));
        c.classList.add('sel');
        settings = await api.setSettings({ pet: { ...petRef(), style: p.id } });
        UI.toast(`已切换为「${p.name}」`);
      });
      petGrid.appendChild(c);
    }
    view.querySelector('#st-size').addEventListener('change', async (e) => {
      settings = await api.setSettings({ pet: { ...petRef(), size: parseInt(e.target.value, 10) } });
    });
    view.querySelector('#st-top').addEventListener('change', async (e) => {
      settings = await api.setSettings({ pet: { ...petRef(), alwaysOnTop: e.target.checked } });
    });
    function petRef() { return { ...(settings.pet || {}) }; }

    for (const [id, key] of [['#st-speech', 'companionSpeech'], ['#st-ambient', 'ambientSpeech']]) {
      view.querySelector(id).addEventListener('change', async (e) => {
        settings = await api.setSettings({ ui: { ...(settings.ui || {}), [key]: e.target.checked } });
        UI.toast(e.target.checked ? '已开启' : '已关闭');
      });
    }

    // 模型服务
    view.querySelector('#st-startup').addEventListener('change', async e => {
      try { settings = await api.setSettings({ system: { openAtLogin: e.target.checked } }); UI.toast(e.target.checked ? '已开启开机自启动' : '已关闭开机自启动'); }
      catch (error) { e.target.checked = !e.target.checked; UI.toast(error.message, true); }
    });
    view.querySelector('#st-connections').onclick=()=>window.switchTab('connections');
    view.querySelector('#st-shortcut').addEventListener('click', async () => {
      try { await api.createDesktopShortcut(); UI.toast('已添加到桌面'); }
      catch (error) { UI.toast(error.message, true); }
    });
    view.querySelector('#st-save-llm').addEventListener('click', async () => {
      const key = view.querySelector('#st-key').value.trim();
      try {
        if (key) await api.setSecret('llmApiKey', key);
        settings = await api.setSettings({
          llm: {
            baseUrl: view.querySelector('#st-baseurl').value.trim(),
            model: view.querySelector('#st-model').value.trim(),
            systemPrompt: view.querySelector('#st-sys').value.trim(),
          },
        });
        const persisted = await api.hasSecret('llmApiKey');
        view.querySelector('#st-key').value = '';
        view.querySelector('#st-key').placeholder = persisted ? '••••••••（输入新密钥才会替换）' : '填写 API 密钥';
        view.querySelector('#st-key-state').textContent = persisted ? '本机已保存' : '未设置';
        view.querySelector('#st-key-state').classList.toggle('done', persisted);
        view.querySelector('#st-key-hint').textContent = persisted ? '密钥已加密保存在本机，重启后仍可使用；为安全起见，这里不显示原文。' : '保存后加密存放在本机，重启后继续使用。';
        UI.toast('模型配置已保存');
        window.TABS.chat?.build?.();
      } catch (err) { UI.toast('保存失败：' + err.message, true); }
    });
    view.querySelector('#st-test-llm').addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = '测试中…';
      const r = await api.llmTest();
      e.target.disabled = false; e.target.textContent = '测试连接';
      UI.toast(r.message, !r.ok);
    });
    view.querySelector('#st-save-clean').addEventListener('click', async()=>{
      try{
        const key=view.querySelector('#st-clean-key').value.trim();if(key)await api.setSecret('textCleanApiKey',key);
        const status=await api.textCleanStatus();view.querySelector('#st-clean-key').value='';
        view.querySelector('#st-clean-state').textContent=status.configured?'可用':'未设置';view.querySelector('#st-clean-state').classList.toggle('done',status.configured);
        view.querySelector('#st-clean-hint').textContent=status.credentialLabel+' · 密钥仅在本机加密保存，不随开源版本分发。';
        UI.toast(status.configured?'清洗配置已保存':'请填写 DeepSeek 密钥',!status.configured);
      }catch(e){UI.toast('保存失败：'+e.message,true);}
    });
    view.querySelector('#st-test-clean').addEventListener('click', async e=>{
      const button=e.currentTarget;button.disabled=true;button.textContent='清洗中…';
      try{const r=await api.textApply('斐 墨 帮 我整理错\n误换行。');UI.toast('连接成功：'+r.output);}
      catch(error){UI.toast(error.message,true);}finally{button.disabled=false;button.textContent='测试清洗';}
    });

    // 热键
    view.querySelector('#st-save-hk').addEventListener('click', async () => {
      settings = await api.setSettings({
        hotkeys: {
          show: view.querySelector('#st-hk1').value.trim() || 'Alt+Shift+P',
          processClipboard: view.querySelector('#st-hk2').value.trim() || 'Alt+Shift+O',
          ocrClipboard: view.querySelector('#st-hk3').value.trim() || 'Alt+Shift+T',
        },
      });
      const registered = await api.hotkeyStatus();
      const failed = Object.entries(registered).filter(([, ok]) => !ok).map(([key]) => key);
      UI.toast(failed.length ? `热键冲突或无效：${failed.join('、')}` : '热键已保存并注册', failed.length > 0);
    });

    // Agent 监控
    for (const cb of view.querySelectorAll('.st-src')) {
      cb.addEventListener('change', async () => {
        const sources = {};
        for (const c of view.querySelectorAll('.st-src')) sources[c.dataset.src] = c.checked;
        await api.setSettings({ agents: { ...(settings.agents || {}), sources } });
        UI.toast('已保存，重启应用后生效');
      });
    }
    view.querySelector('#st-mute').addEventListener('change', async (e) => {
      await api.setSettings({ agents: { ...(settings.agents || {}), muteNotifications: !e.target.checked } });
      UI.toast(e.target.checked ? '已开启事件通知' : '已静音事件通知');
    });

    // Notion
    view.querySelector('#st-save-notion').addEventListener('click', async (e) => {
      const token = view.querySelector('#st-ntoken').value.trim();
      if (token) await api.setSecret('notionToken', token);
      const dbRaw = view.querySelector('#st-ndb').value.trim();
      const dbId = extractNotionId(dbRaw);
      await api.setSettings({
        notion: {
          databaseId: dbId,
          dataSourceId: dbId === notion.databaseId ? notion.dataSourceId : undefined,
          titleProperty: view.querySelector('#st-ntitle').value.trim() || 'Name',
          dateProperty: view.querySelector('#st-ndate').value.trim(),
        },
        calendar: { ...(settings.calendar || {}), notionAutoSync: view.querySelector('#st-nauto').checked },
      });
      if (!dbId) { UI.toast('已保存；数据源 ID 未识别，日程同步暂不可用', true); return; }
      e.target.disabled = true; e.target.textContent = '测试中…';
      const r = await api.calendarSyncNotion();
      e.target.disabled = false; e.target.textContent = '保存并测试连接';
      if (r.ok) UI.toast(`连接成功，已同步 ${r.count} 条日程`);
      else UI.toast(r.error || '连接失败', true);
    });

    // 隐私
    view.querySelector('#st-hist').addEventListener('change', async (e) => {
      await api.setSettings({ privacy: { saveChatHistory: e.target.checked } });
      UI.toast(e.target.checked ? '已开启历史保存' : '已关闭（重启后清空）');
    });
    view.querySelector('#st-clear-chat').addEventListener('click', async () => {
      await api.chatClear();
      UI.toast('问答历史已清空');
      window.TABS.chat?.build?.();
    });
    view.querySelector('#st-clear-usage').addEventListener('click', async () => {
      const r = await api.usagePrune();
      UI.toast(r.ok ? '已清理 1 年前的用量记录' : '清理失败', !r.ok);
    });
  }

  function extractNotionId(s) {
    if (!s) return '';
    const m = s.match(/([0-9a-f]{32})/i);
    if (m) return m[1].replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    const m2 = s.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    return m2 ? m2[1] : s;
  }

  window.TABS.settings = { build, onShown: () => { if (!view.innerHTML) build(); } };
})();
