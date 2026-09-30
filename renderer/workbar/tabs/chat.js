'use strict';
/** 问答页：流式回答、Markdown 安全渲染、逐块复制、停止/重试、最近会话。 */
(() => {
  const api = window.api;
  const view = document.getElementById('view-chat');

  view.innerHTML = `
    <div class="chat-scroll" id="chat-scroll">
      <div id="chat-list"></div>
    </div>`;

  const list = view.querySelector('#chat-list');
  const scroll = view.querySelector('#chat-scroll');
  let busy = false;
  let curAssistant = null;
  let curText = '';
  let lastQuestion = null;
  let renderTimer = null;
  let generation=0;

  function atBottom() {
    return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 60;
  }
  function scrollIfStick() { if (atBottom()) scroll.scrollTop = scroll.scrollHeight; }

  function addUser(text) {
    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = `<div class="who">我</div><div class="bubble"></div>`;
    div.querySelector('.bubble').textContent = text;
    list.appendChild(div);
    scroll.scrollTop = scroll.scrollHeight;
  }

  function startAssistant() {
    const div = document.createElement('div');
    div.className = 'msg assistant';
    div.innerHTML = `
      <div class="who">助手 <span class="badge local" id="chat-provider"></span></div>
      <div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>
      <div class="actions">
        <button class="btn small act-stop">停止</button>
      </div>`;
    list.appendChild(div);
    const bubble = div.querySelector('.bubble');
    bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    div.querySelector('.act-stop').onclick = () => api.chatStop();
    curAssistant = { div, bubble };
    curText = '';
    scroll.scrollTop = scroll.scrollHeight;
    return curAssistant;
  }

  function renderCurrent() {
    if (!curAssistant) return;
    const stick = atBottom();
    curAssistant.bubble.innerHTML = '';
    curAssistant.bubble.appendChild(UI.renderMarkdown(curText));
    if (stick) scroll.scrollTop = scroll.scrollHeight;
  }

  function finishAssistant(finalText, ok) {
    if (!curAssistant) return;
    if (renderTimer) cancelAnimationFrame(renderTimer);
    renderTimer = null;
    curText = finalText || curText;
    renderCurrent();
    const text = curText, bubble = curAssistant.bubble, question = lastQuestion;
    const actions = curAssistant.div.querySelector('.actions');
    actions.innerHTML = '';
    const bCopy = document.createElement('button');
    bCopy.className = 'btn small';
    bCopy.textContent = '复制全文';
    bCopy.onclick = () => UI.copyText(text, '回答已复制（Markdown 原文）');
    const bCopyPlain = document.createElement('button');
    bCopyPlain.className = 'btn small';
    bCopyPlain.textContent = '复制纯文本';
    bCopyPlain.onclick = () => UI.copyText(bubble.innerText, '已复制纯文本');
    const bRetry = document.createElement('button');
    bRetry.className = 'btn small';
    bRetry.textContent = '重试';
    bRetry.onclick = () => { if (question) send(question, true); };
    actions.append(bCopy, bCopyPlain, bRetry);
    curAssistant = null;
    scrollIfStick();
  }

  async function send(text, isRetry = false) {
    if (busy) { UI.toast('正在回答中…', true); return; }
    const turn=generation;
    list.querySelector('.empty')?.remove();
    if (!isRetry) addUser(text);
    lastQuestion = text;
    startAssistant();
    busy = true;
    window.switchTab('chat');
    try {
      const r = await api.chatSend(text);
      if(turn!==generation)return;
      if (r.ok) {
        finishAssistant(r.reply, true);
      } else if (r.aborted) {
        finishAssistant(curText + '\n\n*（已停止）*', false);
      }
    } catch (e) {
      if(turn!==generation)return;
      if (curAssistant) {
        curAssistant.bubble.innerHTML = `<span style="color:var(--error)">${UI.esc(e.message)}</span>`;
        curAssistant.div.querySelector('.actions').innerHTML = '';
        const retry = document.createElement('button');
        retry.className = 'btn small';
        retry.textContent = '重试';
        retry.onclick = () => send(text, true);
        curAssistant.div.querySelector('.actions').appendChild(retry);
        curAssistant = null;
      }
      UI.toast(e.message, true);
    } finally {
      if(turn===generation)busy = false;
    }
  }

  // 流式增量
  api.onChatDelta((d) => {
    if (!curAssistant) return;
    curText = d.full ?? (curText + d.delta);
    if (!renderTimer) renderTimer = requestAnimationFrame(() => { renderTimer = null; renderCurrent(); });
  });

  // 历史加载 + 空状态
  async function build() {
    if (busy) return;
    const token=generation;
    const hist = await api.chatHistory();
    const configured = await api.llmConfigured();
    if (busy||token!==generation) return;
    list.innerHTML = '';
    if (!hist.length) {
      if (!configured) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.innerHTML = `<span class="big" data-icon="ChatDots" data-size="24"></span>
          还没有配置模型服务<br/>
          在 <b>设置 → 模型服务</b> 填入 OpenAI 兼容接口地址与密钥后即可提问<br/>
          <span class="muted">凭据保存在本机（Windows 凭据加密），仅在你发送时调用</span>`;
        list.appendChild(empty);
        const btn = document.createElement('button');
        btn.className = 'btn primary';
        btn.style.cssText = 'display:block;margin:10px auto 0';
        btn.textContent = '去设置';
        btn.onclick = () => window.switchTab('settings');
        empty.appendChild(btn);
      } else {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.innerHTML = `<span class="big" data-icon="ChatDots" data-size="24"></span><h2>今天，想做点什么？</h2><p class="muted">问一个问题，整理一个想法。<br/>Enter 发送 · Shift+Enter 换行</p><div class="chat-starters"></div>`;
        for (const prompt of ['帮我梳理一个想法', '解释一段代码', '整理今天的任务']) {
          const button = document.createElement('button'); button.className = 'btn'; button.textContent = prompt;
          button.addEventListener('click', () => { const input = document.getElementById('input'); input.value = prompt + '：'; input.focus(); });
          empty.querySelector('.chat-starters').appendChild(button);
        }
        list.appendChild(empty);
      }
      return;
    }
    for (const m of hist.slice(-20)) {
      if (m.role === 'user') { lastQuestion = m.content; addUser(m.content); }
      else {
        startAssistant();
        curText = m.content;
        finishAssistant(m.content, true);
      }
    }
  }

  async function newConversation(){
    const button=document.getElementById('page-new-chat');button.disabled=true;
    try{
      // Invalidate pending rendering before aborting the network request.
      generation++;await api.chatClear();
      if(renderTimer)cancelAnimationFrame(renderTimer);renderTimer=null;
      busy=false;curAssistant=null;curText='';lastQuestion=null;list.replaceChildren();
      const input=document.getElementById('input');input.value='';input.style.height='auto';
      await build();input.focus();UI.toast('新对话已开始');
    }catch(e){busy=false;curAssistant=null;UI.toast(e.message,true);}finally{button.disabled=false;}
  }
  window.TABS.chat = { build, send, newConversation, isBusy: () => busy, onShown: () => scrollIfStick() };
  build();
})();
