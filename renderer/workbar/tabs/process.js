'use strict';
/** AI 清洗：文本显式触发；新图片本地 OCR 后自动调用 DeepSeek。
 * 原文始终保留，流式结果只在成功完成后允许复制，修改或取消会丢弃迟到的结果。
 */
(()=>{
 const api=window.api,view=document.getElementById('view-process'),$=id=>view.querySelector('#'+id);
 view.innerHTML=`
 <div class="subtabs"><button class="subtab active" data-sub="text"><span data-icon="Broom" data-size="16"></span> 文本清洗</button><button class="subtab" data-sub="ocr"><span data-icon="Image" data-size="16"></span> 图片转文字</button></div>
 <p class="muted">DeepSeek V4.1 Flash · 非思考模式 · 原文保留，AI 修复格式与明显错字。</p>
 <div id="proc-text">
  <div class="quick-rules" id="pt-quick-rules"></div>
  <div class="dual"><div class="pane"><div class="pane-head"><span class="t">原文</span><button class="btn small" id="pt-paste">粘贴剪贴板</button></div><textarea id="pt-src" placeholder="粘贴或输入文本，点击 AI 快速清洗…" spellcheck="false"></textarea></div>
   <div class="pane"><div class="pane-head"><span class="t">结果 <span id="pt-stats" class="muted"></span></span><button class="btn small" id="pt-diff">对比模式</button></div><div class="out" id="pt-out"><span class="muted">清洗后在这里显示结果</span></div></div></div>
  <div class="actionbar proc-actions"><button class="btn primary" id="pt-ai"><span data-icon="MagicWand" data-size="16"></span> AI 快速清洗</button><button class="btn" id="pt-copy" disabled>复制结果</button><button class="btn" id="pt-replace" disabled>替换剪贴板</button><button class="btn" id="pt-undo">恢复原文</button></div>
  <p class="muted" id="pt-note" role="status">只在点击清洗时发送正文，不会在打字时自动调用模型。</p>
  <details class="advanced-rules"><summary>校对与排版选项</summary><div class="rules-grid" id="pt-rules"></div></details>
 </div>
 <div id="proc-ocr" style="display:none">
  <div id="ocr-drop">拖入图片，或点击选择文件<br><span class="muted">也可 Ctrl+V 粘贴截图 · 图片本地识别，识别正文发送到 DeepSeek 清洗</span></div>
  <input type="file" id="ocr-file" accept="image/*" style="display:none">
  <div id="ocr-work" style="display:none"><div id="ocr-preview"><img id="ocr-img" alt="识别图片"><div class="boxes" id="ocr-boxes"></div></div>
   <div class="actionbar" style="margin:6px 0 8px"><select id="ocr-lang" class="btn"><option value="auto">语言：自动</option><option value="zh-Hans">简体中文</option><option value="en">English</option></select><button class="btn" id="ocr-rerun">重新识别</button><button class="btn small" id="ocr-order"><span data-icon="SortDownUp" data-size="16"></span> 按阅读顺序重排</button></div>
   <div class="ocr-lines" id="ocr-lines"></div>
   <div class="pane"><div class="pane-head"><span class="t">AI 清洗合并结果</span></div><div class="out" id="ocr-merged" style="min-height:80px"></div></div>
   <div class="actionbar proc-actions"><button class="btn primary" id="ocr-copy" disabled>复制清洗结果</button><button class="btn" id="ocr-proofread">重新 AI 清洗</button><button class="btn" id="ocr-cancel" hidden>停止清洗</button></div>
   <p class="muted" id="ocr-note" role="status">识别后自动修复断行、字间空格和明显错字。</p>
  </div>
 </div>`;
 let sub='text';
 view.querySelectorAll('.subtab').forEach(b=>b.onclick=()=>{sub=b.dataset.sub;view.querySelectorAll('.subtab').forEach(x=>x.classList.toggle('active',x===b));$('proc-text').style.display=sub==='text'?'':'none';$('proc-ocr').style.display=sub==='ocr'?'':'none';});
 const showSub=name=>view.querySelector(`[data-sub="${name}"]`).click();
 const requestId=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
 let enabled=new Set(),optionsReady=false,textJob=null,lastResult='',lastSource='',original='',originalSet=false,diffMode=false;
 const src=$('pt-src'),out=$('pt-out');
 function copyState(){const ready=!!lastResult&&!textJob;$('pt-copy').disabled=!ready;$('pt-replace').disabled=!ready;}
 function textButton(){ $('pt-ai').innerHTML=textJob?'停止清洗':'<span data-icon="MagicWand" data-size="16"></span> AI 快速清洗'; }
 function invalidateText(note='原文已更新，点击 AI 快速清洗'){if(textJob)void api.textCancel(textJob.id);textJob=null;lastResult='';$('pt-stats').textContent='';out.textContent=src.value.trim()?'等待 AI 清洗…':'清洗后在这里显示结果';$('pt-note').textContent=note;copyState();textButton();}
 function renderOut(result,ms,streaming=false){if(diffMode&&lastResult){const d=UI.diffLines(lastSource,result);if(d)out.innerHTML=d.map(l=>l.t==='+'?`<ins>${UI.esc(l.s)}</ins>`:l.t==='-'?`<del>${UI.esc(l.s)}</del>`:UI.esc(l.s)).join('\n');else out.textContent=result;}else out.textContent=result;$('pt-stats').textContent=`${result.length} 字符${streaming?' · 输出中…':ms===undefined?'':` · ${(ms/1000).toFixed(1)}s`}`;}
 async function cleanText(){
  if(textJob){invalidateText('已停止清洗，原文保留');return;}
  const text=src.value;if(!text.trim())return UI.toast('先输入或粘贴文本',true);if(!optionsReady)return UI.toast('清洗选项正在加载',true);
  if(!originalSet){original=text;originalSet=true;}
  const job={id:requestId('text'),text};textJob=job;lastResult='';lastSource=text;out.textContent='正在 AI 清洗…';$('pt-note').textContent='正在修复格式与校对，结果流式显示…';copyState();textButton();
  try{const r=await api.textApply(text,[...enabled],{id:job.id});if(textJob!==job)return;lastResult=r.output;renderOut(r.output,r.ms);$('pt-note').textContent='清洗完成 · 请核对数字、专名和引用后使用。';}
  catch(e){if(textJob!==job)return;lastResult='';out.textContent='清洗失败，原文保留';$('pt-note').textContent=e.message;UI.toast(e.message,true);}
  finally{if(textJob===job){textJob=null;copyState();textButton();}}
 }
 api.onTextDelta(data=>{if(textJob?.id===data.id)renderOut(data.output,undefined,true);else if(mergedJob?.id===data.id)$('ocr-merged').textContent=data.output;});
 (async()=>{try{for(const r of await api.textRules()){if(r.defaultOn)enabled.add(r.id);const item=document.createElement('label');item.className='rule-item';item.innerHTML=`<input type="checkbox" ${r.defaultOn?'checked':''}><div><div class="rn">${UI.esc(r.name)}</div><div class="rd">${UI.esc(r.desc)}</div></div>`;item.querySelector('input').onchange=e=>{if(e.target.checked)enabled.add(r.id);else enabled.delete(r.id);invalidateText('选项已更新，点击 AI 快速清洗');};(['removeAllBlankLines','removeCjkSpaces','reflowParagraphs'].includes(r.id)?$('pt-quick-rules'):$('pt-rules')).append(item);}optionsReady=true;}catch(e){$('pt-note').textContent=e.message;}})();
 src.addEventListener('input',()=>invalidateText());
 $('pt-ai').onclick=cleanText;
 $('pt-paste').onclick=async()=>{const snap=await api.clipboardSnapshot();if(snap.kind==='text')loadText(snap.text);else UI.toast('剪贴板中没有文本',true);};
 $('pt-copy').onclick=()=>{if(lastResult&&!textJob)UI.copyText(lastResult);};
 $('pt-replace').onclick=async()=>{if(!lastResult||textJob)return;await api.clipboardWriteText(lastResult);UI.toast('清洗结果已复制到剪贴板');};
 $('pt-undo').onclick=()=>{if(originalSet){src.value=original;invalidateText('已恢复原文');}else UI.toast('没有可恢复的原文',true);};
 $('pt-diff').onclick=e=>{diffMode=!diffMode;e.target.textContent=diffMode?'纯文本模式':'对比模式';if(lastResult)renderOut(lastResult);};
 function loadText(text){showSub('text');src.value=text;original=text;originalSet=true;invalidateText('原文已载入，点击 AI 快速清洗');}

 const drop=$('ocr-drop'),file=$('ocr-file'),img=$('ocr-img'),lines=$('ocr-lines'),merged=$('ocr-merged');
 let imageUrl=null,ocrResult=null,ocrBusy=false,imageRevision=0,lineOrder='raw',mergedJob=null,mergedReady=false;
 function ocrControls(){ $('ocr-copy').disabled=!mergedReady||!!mergedJob;$('ocr-proofread').disabled=ocrBusy||!!mergedJob||!ocrResult||ocrResult.empty;$('ocr-cancel').hidden=!mergedJob;$('ocr-rerun').disabled=ocrBusy; }
 function invalidateMerged(note='识别正文已调整，点击重新 AI 清洗'){if(mergedJob)void api.textCancel(mergedJob.id);mergedJob=null;mergedReady=false;merged.textContent='等待 AI 清洗…';$('ocr-note').textContent=note;ocrControls();}
 const readFile=f=>{const reader=new FileReader();reader.onload=()=>loadOcrImage(reader.result);reader.readAsDataURL(f);};
 drop.onclick=()=>file.click();file.onchange=()=>{if(file.files?.[0])readFile(file.files[0]);file.value='';};
 for(const event of ['dragover','dragenter'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('over');});
 for(const event of ['dragleave','drop'])drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('over');});
 drop.addEventListener('drop',e=>{const f=e.dataTransfer?.files?.[0];if(f?.type.startsWith('image/'))readFile(f);});
 view.addEventListener('paste',e=>{if(sub!=='ocr')return;for(const item of e.clipboardData?.items||[])if(item.type.startsWith('image/')){e.preventDefault();readFile(item.getAsFile());break;}});
 async function loadOcrImage(url){showSub('ocr');imageRevision++;imageUrl=url;ocrResult=null;invalidateMerged('正在本地识别图片…');$('ocr-work').style.display='';img.src=url;$('ocr-boxes').replaceChildren();await runOcr();}
 async function runOcr(){
  if(!imageUrl)return;
  const revision=++imageRevision;ocrBusy=true;ocrResult=null;invalidateMerged('正在本地识别图片…');lines.textContent='正在本地识别…';ocrControls();
  try{const result=await api.ocrRecognize(imageUrl,$('ocr-lang').value);if(revision!==imageRevision)return;ocrResult=result;renderLines();if(!result.empty)await cleanMerged();}
  catch(e){if(revision!==imageRevision)return;lines.textContent=e.message;$('ocr-note').textContent='识别失败，可重新识别或更换图片';}
  finally{if(revision===imageRevision){ocrBusy=false;ocrControls();}}
 }
 function orderedLines(){if(!ocrResult)return [];if(lineOrder==='raw')return ocrResult.lines;const sorted=ocrResult.lines.slice().sort((a,b)=>a.y-b.y||a.x-b.x),groups=[];for(const l of sorted){const group=groups.at(-1);if(group&&Math.abs(l.y-group.y)<=Math.max(12,l.h*.6))group.items.push(l);else groups.push({y:l.y,items:[l]});}return groups.flatMap(g=>g.items.sort((a,b)=>a.x-b.x));}
 function drawBoxes(){const box=$('ocr-boxes');box.replaceChildren();if(!ocrResult||ocrResult.empty)return;const scale=img.clientWidth/(ocrResult.width||img.naturalWidth);for(const l of ocrResult.lines){const b=document.createElement('div');b.className='bx';Object.assign(b.style,{left:l.x*scale+'px',top:l.y*scale+'px',width:l.w*scale+'px',height:l.h*scale+'px'});box.append(b);}}
 img.onload=drawBoxes;window.addEventListener('resize',drawBoxes);
 function renderLines(){lines.replaceChildren();drawBoxes();if(ocrResult.empty){merged.textContent='';$('ocr-note').textContent='未识别到文字，请换一张更清晰的图片';lines.textContent='未检测到文字';return;}for(const l of orderedLines()){const row=document.createElement('div');row.className='ocr-line';row.innerHTML=`<input type="checkbox" checked><input type="text" value="${UI.esc(l.text)}">`;row.querySelector('input[type=checkbox]').onchange=()=>invalidateMerged();row.querySelector('input[type=text]').oninput=e=>{l.text=e.target.value;invalidateMerged();};lines.append(row);}}
 async function cleanMerged(){
  if(!ocrResult||ocrResult.empty||mergedJob)return;
  const parts=[...lines.querySelectorAll('.ocr-line')].filter(row=>row.querySelector('input[type=checkbox]').checked).map(row=>row.querySelector('input[type=text]').value),raw=parts.join('\n');
  if(!raw.trim()){invalidateMerged('没有选中的文字');return;}
  const job={id:requestId('ocr')};mergedJob=job;mergedReady=false;merged.textContent='正在 AI 清洗识别文字…';$('ocr-note').textContent='正在连接错误断行、清除空格并纠正明显识别错误…';ocrControls();
  try{const r=await api.textApply(raw,undefined,{id:job.id,source:'ocr'});if(mergedJob!==job)return;merged.textContent=r.output;mergedReady=!!r.output;$('ocr-note').textContent=`清洗完成 · ${r.output.length} 字符 · ${(r.ms/1000).toFixed(1)}s`;}
  catch(e){if(mergedJob!==job)return;merged.textContent='AI 清洗失败，逐行原文保留';$('ocr-note').textContent=e.message;UI.toast(e.message,true);}
  finally{if(mergedJob===job){mergedJob=null;ocrControls();}}
 }
 $('ocr-rerun').onclick=runOcr;$('ocr-lang').onchange=runOcr;
 $('ocr-order').onclick=()=>{lineOrder=lineOrder==='raw'?'reading':'raw';invalidateMerged('阅读顺序已更新，点击重新 AI 清洗');$('ocr-order').textContent=lineOrder==='reading'?'阅读顺序（点击还原）':'按阅读顺序重排';if(ocrResult)renderLines();};
 $('ocr-copy').onclick=()=>{if(mergedReady&&!mergedJob)UI.copyText(merged.textContent,'图片文字清洗结果已复制');};
 $('ocr-proofread').onclick=cleanMerged;$('ocr-cancel').onclick=()=>invalidateMerged('已停止 AI 清洗，识别原文保留');
 window.TABS.process={loadText,loadOcrImage,pickImageFile:()=>{showSub('ocr');file.click();},onShown:()=>{}};
})();
