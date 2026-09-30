'use strict';
(() => {
  const api=window.api, view=document.getElementById('view-tools'), esc=UI.esc, $=id=>view.querySelector('#'+id);
  let data={clips:[],notes:[],palettes:[],autoCapture:false}, section='clipboard', editingId=null, request=0, dirty=false;
  let palette={name:'雾林',colors:window.FeimoColors.curated[0].colors};
  view.innerHTML=`
    <div class="subtabs tool-tabs"><button class="subtab active" data-tool="clipboard"><span data-icon="ClipboardText" data-size="16"></span>剪贴板</button><button class="subtab" data-tool="notes"><span data-icon="NoteText" data-size="16"></span>速记</button><button class="subtab" data-tool="palette"><span data-icon="Palette" data-size="16"></span>配色</button></div>
    <div id="tb-error" class="tool-error" hidden></div>
    <section id="tb-clipboard"><div class="card toolbox-intro"><h2>随时找回刚复制的内容</h2><p>本机加密保存，最多 80 条；常见密钥不会进入历史。</p><div class="tool-actions"><button class="btn primary" id="tb-capture">收录当前剪贴板</button><button class="btn small" id="tb-clear">清除未固定记录</button></div><label class="tool-opt"><input type="checkbox" id="tb-auto">自动记录剪贴板<span>仅开启后在后台读取文字和图片</span></label></div><input class="tool-search" id="tb-clip-search" placeholder="搜索剪贴板文字…" aria-label="搜索剪贴板"><div id="tb-clips"></div></section>
    <section id="tb-notes" hidden><div class="tool-actions"><button class="btn primary" id="tb-new-note"><span data-icon="Add" data-size="16"></span>新速记</button><button class="btn" id="tb-export-notes">导出 Markdown</button></div><div id="tb-note-editor" class="card" hidden><input id="tb-note-title" maxlength="80" placeholder="标题（可选）" aria-label="速记标题"><textarea id="tb-note-text" maxlength="30000" placeholder="记下灵感、待办或一段文字…" aria-label="速记正文"></textarea><div class="tool-actions"><button class="btn primary" id="tb-save-note">保存速记</button><button class="btn" id="tb-cancel-note">返回列表</button><span id="tb-note-hint" class="muted">支持 Markdown</span></div></div><input class="tool-search" id="tb-note-search" placeholder="搜索速记…" aria-label="搜索速记"><div id="tb-note-list"></div></section>
    <section id="tb-palette" hidden><div class="card palette-control"><h2>为下一份创作找一组颜色</h2><p class="muted">点击色块复制 HEX；从主色生成协调的五色搭配。</p><div class="palette-inputs"><input type="color" id="tb-color" value="#789A87" aria-label="选择主色"><input id="tb-hex" value="#789A87" maxlength="7" aria-label="主色 HEX"><select id="tb-harmony" aria-label="搭配方式"><option value="analogous">邻近色</option><option value="complementary">互补色</option><option value="triadic">三角色</option></select><button class="btn" id="tb-generate">生成</button></div><div id="tb-palette-preview"></div><div class="tool-actions"><button class="btn primary" id="tb-copy-palette">复制整组</button><button class="btn" id="tb-save-palette">收藏色卡</button></div></div><h3 class="tool-section-title">精选搭配</h3><div id="tb-curated" class="palette-grid"></div><h3 class="tool-section-title">我的色卡</h3><div id="tb-palettes" class="palette-grid"></div></section>`;
  function error(e){const box=$('tb-error');box.hidden=false;box.textContent=e?.message||String(e);}
  async function run(fn){try{$('tb-error').hidden=true;return await fn();}catch(e){error(e);}}
  function empty(text){const el=document.createElement('div');el.className='tool-empty';el.textContent=text;return el;}
  function action(text,fn,icon){const b=document.createElement('button');b.className='btn small';b.type='button';b.textContent=text;if(icon)b.prepend(window.ReiconFilled.create(icon,16));b.onclick=()=>run(fn);return b;}
  function renderClips(){
    $('tb-auto').checked=data.autoCapture;
    const root=$('tb-clips'),query=$('tb-clip-search').value.toLowerCase();root.replaceChildren();
    const list=data.clips.filter(c=>!query||c.kind==='text'&&c.value.toLowerCase().includes(query)).sort((a,b)=>Number(b.pinned)-Number(a.pinned));
    if(!list.length)root.append(empty(query?'没有找到相符记录':'先收录一条复制的内容吧。'));
    list.forEach(c=>{const card=document.createElement('article');card.className='card clip-card';
      const meta=document.createElement('div');meta.className='tool-meta';meta.textContent=`${c.pinned?'已固定 · ':''}${c.kind==='image'?'图片':'文字'} · ${new Date(c.at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
      const body=document.createElement(c.kind==='image'?'img':'pre');body.className='clip-content';if(c.kind==='image'){body.src=c.value;body.alt='剪贴板图片';}else body.textContent=c.value;
      const actions=document.createElement('div');actions.className='tool-actions';actions.append(action('复制',()=>api.toolboxCopyClip(c.id).then(()=>UI.toast('已复制到剪贴板')),'Copy'),action(c.pinned?'取消固定':'固定',()=>api.toolboxClipEdit(c.id,'pin')),action('删除',()=>api.toolboxClipEdit(c.id,'delete')));
      card.append(meta,body,actions);root.append(card);
    });
  }
  function renderNotes(){
    const root=$('tb-note-list'),query=$('tb-note-search').value.toLowerCase();root.replaceChildren();
    const list=data.notes.filter(n=>(n.title+' '+n.text).toLowerCase().includes(query));
    if(!list.length)root.append(empty(query?'没有找到相符速记':'灵感来时，写下第一条速记。'));
    list.forEach(n=>{const card=document.createElement('article');card.className='card note-card';const title=document.createElement('h2');title.textContent=n.title;
      const meta=document.createElement('small');meta.className='tool-meta';meta.textContent=new Date(n.at).toLocaleString('zh-CN');const body=window.SafeMarkdown.render(n.text);body.classList.add('note-preview');
      // Route links through the existing confirmed external-link flow.
      body.addEventListener('click',e=>{const a=e.target.closest('a');if(a){e.preventDefault();UI.confirmLink?.(a.href);}});
      const actions=document.createElement('div');actions.className='tool-actions';actions.append(action('编辑',()=>editNote(n)),action('复制',()=>api.clipboardWriteText(n.text).then(()=>UI.toast('已复制速记')),'Copy'),action('删除',()=>api.toolboxDeleteNote(n.id)));
      card.append(title,meta,body,actions);root.append(card);
    });
  }
  function editNote(n){
    if(dirty && !confirm('当前速记尚未保存，要放弃这些修改吗？'))return;
    editingId=n?.id||null;$('tb-note-editor').hidden=false;$('tb-note-title').value=n?.title||'';$('tb-note-text').value=n?.text||'';dirty=false;$('tb-note-hint').textContent='支持 Markdown';$('tb-note-text').focus();
  }
  function renderPalette(){
    const root=$('tb-palette-preview');root.replaceChildren();const name=document.createElement('h3');name.textContent=palette.name;root.append(name);
    const colors=document.createElement('div');colors.className='palette-swatches';
    palette.colors.forEach(hex=>{const c=document.createElement('button');c.style.background=hex;const ink=window.FeimoColors.contrast(hex,'#FFFFFF')>=window.FeimoColors.contrast(hex,'#1B242D')?'#FFFFFF':'#1B242D';c.style.color=ink;c.textContent=hex;c.title=`RGB ${window.FeimoColors.rgb(hex).join(', ')} · 文字对比度 ${window.FeimoColors.contrast(hex,ink).toFixed(1)}:1`;c.onclick=()=>run(()=>api.clipboardWriteText(hex).then(()=>UI.toast('已复制 '+hex)));colors.append(c);});root.append(colors);
    const detail=document.createElement('p');detail.className='tool-meta';detail.textContent='悬停查看 RGB 与文字对比度；色值可直接用于设计与代码。';root.append(detail);
  }
  function renderPaletteList(root,items,saved=false){root.replaceChildren();if(!items.length)root.append(empty('喜欢的搭配，可以先收藏。'));items.forEach(p=>{const card=document.createElement('article');card.className='palette-mini';const button=document.createElement('button');button.className='palette-choice';button.setAttribute('aria-label','使用 '+p.name);const swatches=document.createElement('span');swatches.className='mini-swatches';p.colors.forEach(color=>{const s=document.createElement('i');s.style.background=color;swatches.append(s);});const title=document.createElement('span');title.textContent=p.name;button.append(swatches,title);button.onclick=()=>{palette={name:p.name,colors:p.colors};renderPalette();$('tb-palette').scrollIntoView({block:'start',behavior:'smooth'});};card.append(button);if(saved)card.append(action('移除',()=>api.toolboxDeletePalette(p.id)));root.append(card);});}
  function render(){renderClips();renderNotes();renderPaletteList($('tb-palettes'),data.palettes,true);}
  async function refresh(){const id=++request;await run(async()=>{const value=await api.toolboxState();if(id===request){data=value;render();}});}
  function show(name){if(!['clipboard','notes','palette'].includes(name))return;section=name;view.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===name));for(const n of ['clipboard','notes','palette'])$('tb-'+n).hidden=n!==name;}
  view.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>show(b.dataset.tool));
  $('tb-capture').onclick=()=>run(async()=>{const r=await api.toolboxCapture();const msg={saved:'已收录',sensitive:'检测到疑似密钥，不加入历史',empty:'剪贴板为空',large:'内容过大，未加入历史'};UI.toast(msg[r.status]||'已收录');});
  $('tb-auto').onchange=()=>run(async()=>{await api.setSettings({toolbox:{autoCapture:$('tb-auto').checked}});await refresh();});
  $('tb-clear').onclick=()=>{if(confirm('清除所有未固定的剪贴板记录？'))run(()=>api.toolboxClearClips());};
  $('tb-clip-search').oninput=renderClips;$('tb-note-search').oninput=renderNotes;
  $('tb-new-note').onclick=()=>editNote();$('tb-cancel-note').onclick=()=>{if(dirty&&!confirm('速记尚未保存，放弃修改吗？'))return;$('tb-note-editor').hidden=true;dirty=false;};
  for(const id of ['tb-note-title','tb-note-text'])$(id).oninput=()=>{dirty=true;$('tb-note-hint').textContent='尚未保存';};
  $('tb-save-note').onclick=()=>run(async()=>{await api.toolboxSaveNote({id:editingId,title:$('tb-note-title').value,text:$('tb-note-text').value});dirty=false;$('tb-note-editor').hidden=true;UI.toast('速记已保存');});
  $('tb-export-notes').onclick=()=>run(async()=>{if(await api.toolboxExportNotes())UI.toast('已导出速记');});
  $('tb-color').oninput=()=>{$('tb-hex').value=$('tb-color').value.toUpperCase();};
  $('tb-generate').onclick=()=>run(()=>{const base=$('tb-hex').value.trim();const colors=window.FeimoColors.harmony(base,$('tb-harmony').value);$('tb-color').value=base;palette={name:$('tb-harmony').selectedOptions[0].text+' · '+base.toUpperCase(),colors};renderPalette();});
  $('tb-copy-palette').onclick=()=>run(()=>api.clipboardWriteText(palette.colors.join(', ')).then(()=>UI.toast('已复制整组色值')));
  $('tb-save-palette').onclick=()=>run(()=>api.toolboxSavePalette(palette).then(()=>UI.toast('色卡已收藏')));
  api.onToolboxChanged?.(v=>{request++;data=v;render();});
  renderPalette();renderPaletteList($('tb-curated'),window.FeimoColors.curated);
  window.TABS.tools={show,onShown:refresh};
})();
