'use strict';
(() => {
  const api = window.speechApi;
  const greeting = document.getElementById('speech'), stack = document.getElementById('reply-stack');
  let state = null, selected = 0, follow = true, lastLayout = '', frame = null, cards = [], noticeTimer;
  let promptState = null, inlinePrompt = null;
  const prompt = document.getElementById('prompt-card');
  function button(name, title, action) {
    const b = document.createElement('button'); b.type = 'button'; b.title = title;
    b.setAttribute('aria-label', title); b.append(window.ReiconFilled.create(name, 16)); b.onclick = action; return b;
  }
  function roundRect(r, radius = 18) {
    // A transparent halo preserves rounded-edge antialiasing in the native shape.
    const x = Math.floor(r.x - 3), y = Math.floor(r.y - 3), w = Math.ceil(r.width + 6), h = Math.ceil(r.height + 6), corner = Math.min(radius + 3, w / 2, h / 2);
    return Array.from({ length: h }, (_, row) => {
      const d = Math.max(0, corner - Math.min(row + .5, h - row - .5));
      const inset = Math.ceil(corner - Math.sqrt(Math.max(0, corner * corner - d * d)));
      return { x: x + inset, y: y + row, width: Math.max(1, w - inset * 2), height: 1 };
    });
  }
  function measure() {
    frame = null;
    if (promptState && !prompt.hidden) {
      const side=document.body.dataset.placement||'top', bottom=prompt.offsetTop+prompt.offsetHeight, width=252, height=Math.min(340,bottom+20);
      let dot=document.getElementById('reply-dot');if(!dot){dot=document.createElement('i');dot.id='reply-dot';document.body.append(dot);}else if(dot.parentElement!==document.body)document.body.append(dot);
      const anchor=parseInt(document.body.style.getPropertyValue('--dot-anchor'),10)||126;
      dot.style.left=side==='right'?'2px':side==='left'?`${width-10}px`:`${Math.max(20,Math.min(width-20,anchor))-4}px`;
      dot.style.top=side==='top'?`${bottom+6}px`:side==='bottom'?'2px':`${Math.max(20,Math.min(height-16,anchor))-4}px`;
      const rects=[...roundRect({x:prompt.offsetLeft,y:prompt.offsetTop-8,width:prompt.offsetWidth,height:prompt.offsetHeight+16}),...roundRect({x:dot.offsetLeft,y:dot.offsetTop,width:8,height:8},4)];
      const signature=JSON.stringify({id:promptState.id,width,height,rects});if(signature!==lastLayout){lastLayout=signature;api.layout(JSON.parse(signature));}return;
    }
    if (!state || stack.hidden) return;
    const visible = cards.filter(c => !c.hidden);
    const bottom = Math.max(60, ...visible.map(c => c.offsetTop + c.offsetHeight));
    const side = document.body.dataset.placement || 'top';
    const width = state.pages.length ? 240 : 180;
    const height = Math.min(340, Math.ceil(bottom + (side === 'top' ? 20 : 15)));
    const rects = visible.flatMap(c => roundRect({ x: c.offsetLeft, y: c.offsetTop - 8, width: c.offsetWidth, height: c.offsetHeight + 16 }));
    const dot = document.getElementById('reply-dot');
    const anchor = parseInt(document.body.style.getPropertyValue('--dot-anchor'), 10) || 120;
    dot.style.left = side === 'right' ? '2px' : side === 'left' ? `${width - 10}px` : `${Math.max(20, Math.min(width - 20, anchor)) - 4}px`;
    dot.style.top = side === 'top' ? `${bottom + 6}px` : side === 'bottom' ? '2px' : `${Math.max(20, Math.min(height - 16, anchor)) - 4}px`;
    rects.push(...roundRect({ x: dot.offsetLeft, y: dot.offsetTop, width: 8, height: 8 }, 4));
    const signature = JSON.stringify({ id: state.id, width, height, rects });
    if (signature !== lastLayout) { lastLayout = signature; api.layout(JSON.parse(signature)); }
  }
  function scheduleMeasure() { if (!frame) frame = requestAnimationFrame(measure); }
  function select(index, manual = false) {
    if (!state?.pages.length) return;
    if (manual) follow = false;
    selected = (index + state.pages.length) % state.pages.length;
    arrange(true);
  }
  function arrange(animate = false) {
    const status = !state.pages.length, count = Math.min(3, cards.length), order = [selected];
    for (let distance = 1; order.length < count; distance++) order.push((selected - distance + cards.length) % cards.length);
    const band = (count - 1) * 18;
    cards.forEach((card, index) => {
      const depth = order.indexOf(index); card.hidden = depth < 0;
      if (depth < 0) return;
      const front = depth === 0;
      card.classList.toggle('front', front); card.style.zIndex = String(10 - depth);
      card.style.left = `${10 + depth * 4}px`; card.style.width = `${(status ? 160 : 220) - depth * 8}px`;
      card.style.top = `${(document.body.dataset.placement === 'bottom' ? 22 : 12) + band - depth * 18}px`;
      card.setAttribute('aria-label', status ? '正在回答' : `第 ${index + 1} 段回复${front ? '，当前显示' : '，点击查看'}`);
      card.tabIndex = front ? -1 : 0;
      card.querySelector('.card-count').textContent = status ? '斐墨' : `${index + 1}/${cards.length}${state.phase === 'streaming' && index === cards.length - 1 ? ' · 回答中' : ''}`;
      card.querySelector('.card-body').hidden = !front;
      card.querySelector('.card-controls').hidden = !front;
      card.querySelector('.back-preview').hidden = front;
      if(front && inlinePrompt)card.querySelector('.card-body').prepend(inlinePrompt);
      if (animate && front && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        card.getAnimations().forEach(a => a.cancel());
        card.animate([{ opacity: .4, transform: 'translateY(8px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    });
    scheduleMeasure();
  }
  function makeCard(index) {
    const card = document.createElement('section'); card.className = 'reply-card';
    const head = document.createElement('header');
    const label = document.createElement('span'); label.className = 'card-count';
    const controls = document.createElement('div'); controls.className = 'card-controls';
    controls.append(
      button('ArrowLeft', '上一段', e => { e.stopPropagation(); select(selected - 1, true); }),
      button('ArrowRight', '下一段', e => { e.stopPropagation(); select(selected + 1, true); }),
      button('Pause', '停止回答', e => { e.stopPropagation(); api.stop(); }),
      button('Copy', '复制完整回答', async e => {
        e.stopPropagation(); const b = e.currentTarget;
        try { await api.copy(); b.title = '已复制完整回答'; b.setAttribute('aria-label', b.title); }
        catch { b.title = '复制失败，请重试'; }
      }),
      button('CloseCircle', '关闭回复气泡', e => { e.stopPropagation(); api.close(); }),
    );
    const preview = document.createElement('span'); preview.className = 'back-preview';
    const body = document.createElement('div'); body.className = 'card-body';
    head.append(label, preview, controls); card.append(head, body);
    card.addEventListener('click', () => { if (!card.classList.contains('front')) select(index, true); });
    card.addEventListener('keydown', e => { if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(index, true); } });
    body.addEventListener('click', e => { if (e.target.closest('a')) e.preventDefault(); });
    stack.appendChild(card); return card;
  }
  function update(value) {
    const fresh = state?.id !== value.id, oldCount = state?.pages.length || 0;
    state = value;
    promptState=null;prompt.hidden=true;
    document.body.classList.remove('leaving','prompt-mode'); document.body.classList.add('reply-mode');
    greeting.hidden = true; stack.hidden = false;
    if (fresh) { stack.replaceChildren(); cards = []; selected = 0; follow = true; lastLayout = '';inlinePrompt=null; }
    else if (oldCount === 0 && state.pages.length) {
      const old = cards[0]; cards = [];
      if (old) { old.classList.add('outgoing'); setTimeout(() => { old.remove(); scheduleMeasure(); }, 180); }
    }
    const pages = state.pages.length ? state.pages : ['让我想想喔 💭'];
    if (follow) selected = pages.length - 1;
    selected = Math.min(selected, pages.length - 1);
    pages.forEach((text, index) => {
      if (!cards[index]) cards[index] = makeCard(index);
      const card = cards[index];
      if (card._text !== text) {
        const body = card.querySelector('.card-body'), stick = body.scrollHeight - body.scrollTop - body.clientHeight < 24;
        body.replaceChildren(window.SafeMarkdown.render(text));
        if (stick) body.scrollTop = body.scrollHeight;
        card.querySelector('.back-preview').textContent = body.textContent.trim(); card._text = text;
      }
      const buttons = card.querySelectorAll('.card-controls button');
      buttons[0].hidden = buttons[1].hidden = pages.length <= 1;
      buttons[2].hidden = !['thinking', 'streaming'].includes(state.phase);
      buttons[3].disabled = !state.full;
    });
    if (!document.getElementById('reply-dot')) { const dot = document.createElement('i'); dot.id = 'reply-dot'; stack.appendChild(dot); }
    else if(document.getElementById('reply-dot').parentElement!==stack)stack.appendChild(document.getElementById('reply-dot'));
    arrange(fresh || pages.length > oldCount);
  }
  api.onReply(update);
  function fillPrompt(root, value, inline=false) {
    root.replaceChildren();
    const head=document.createElement('header'),title=document.createElement('strong');title.textContent=value.title;
    head.append(window.ReiconFilled.create(value.icon||'Bell',16),title,button('CloseCircle','关闭提示',()=>{if(inline){inlinePrompt=null;root.remove();scheduleMeasure();}else api.cardClose();}));root.append(head);
    const subtitle=document.createElement('p');subtitle.textContent=value.subtitle;root.append(subtitle);
    if(value.text){const body=document.createElement('div');body.className='prompt-text';body.textContent=value.text;root.append(body);}
    for(const w of value.windows||[]){
      const row=document.createElement('div');row.className='quota-window';const label=document.createElement('span');label.textContent=w.label;const remaining=document.createElement('b');remaining.textContent=`剩余 ${Math.round(100-w.usedPercent)}%`;
      const meter=document.createElement('div');meter.className='quota-meter';const bar=document.createElement('i');bar.style.width=`${w.usedPercent}%`;if(w.usedPercent>=95)bar.style.background='#b58080';meter.append(bar);
      const reset=document.createElement('small');reset.textContent=w.resetsAt?`${new Date(w.resetsAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 重置`:'重置时间未知';row.append(label,remaining,meter,reset);root.append(row);
    }
    if(value.observedAt){const at=document.createElement('p');at.textContent='更新于 '+new Date(value.observedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});root.append(at);}
    if(value.action){const open=document.createElement('button');open.className='prompt-action';open.textContent=value.actionLabel||'打开工作台';open.onclick=()=>api.cardOpen(value.action);root.append(open);}
  }
  api.onCard?.(value=>{
    if(value.inline && state){inlinePrompt?.remove();inlinePrompt=document.createElement('aside');inlinePrompt.className='prompt-inline';fillPrompt(inlinePrompt,value,true);arrange(true);return;}
    promptState=value;state=null;cards=[];lastLayout='';stack.hidden=true;greeting.hidden=true;prompt.hidden=false;
    document.body.classList.remove('leaving','reply-mode');document.body.classList.add('prompt-mode');fillPrompt(prompt,value);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)prompt.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:220,easing:'ease-out'});
    scheduleMeasure();
  });
  api.onNotice(text => {
    const body = cards[selected]?.querySelector('.card-body');
    if (!body || !state) return;
    body.querySelector('.reply-notice')?.remove();
    const notice = document.createElement('div'); notice.className = 'reply-notice'; notice.textContent = text;
    body.prepend(notice); scheduleMeasure(); clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.remove(); scheduleMeasure(); }, 6500);
  });
  api.onMessage(text => {
    state = null; promptState=null;prompt.hidden=true;document.getElementById('reply-dot')?.remove();cards = []; lastLayout = ''; document.body.classList.remove('reply-mode', 'leaving','prompt-mode');
    stack.hidden = true; greeting.hidden = false;
    greeting.getAnimations().forEach(a => a.cancel()); document.getElementById('message').textContent = text;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) greeting.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
  });
  api.onDismiss(() => { state = null;promptState=null; document.body.classList.add('leaving'); });
  api.onPlacement(placement => {
    document.body.dataset.placement = placement.side; document.body.style.setProperty('--dot-anchor', `${placement.anchor}px`);
    if (state) arrange();
    if(promptState){prompt.style.top=placement.side==='bottom'?'22px':'12px';scheduleMeasure();}
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {if(promptState)api.cardClose();else api.close();}
    if (state && e.key === 'ArrowLeft') select(selected - 1, true);
    if (state && e.key === 'ArrowRight') select(selected + 1, true);
  });
})();
