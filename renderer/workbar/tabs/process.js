'use strict';
/** 快捷处理页：两个子页 —— 文本规则清洗（双栏） / 图片转文字（OCR）。
 *  文本：勾选规则实时预览、撤销、复制、替换剪贴板；代码块/表格/引用结构保护。
 *  OCR：拖入/粘贴/选择图片 → 本地识别 → 逐行编辑、阅读顺序重排、AI 校对（显式触发）。
 */
(() => {
  const api = window.api;
  const view = document.getElementById('view-process');

  view.innerHTML = `
    <div class="subtabs">
      <button class="subtab active" data-sub="text"><span data-icon="Broom" data-size="16"></span> 文本清洗</button>
      <button class="subtab" data-sub="ocr"><span data-icon="Image" data-size="16"></span> 图片转文字</button>
    </div>
    <div id="proc-text">
      <div class="quick-rules" id="pt-quick-rules"></div>
      <div class="dual">
        <div class="pane">
          <div class="pane-head"><span class="t">原文</span>
            <div><button class="btn small" id="pt-paste">粘贴剪贴板</button></div>
          </div>
          <textarea id="pt-src" placeholder="粘贴或输入文本…（代码块、表格、引用会被保护）" spellcheck="false"></textarea>
        </div>
        <div class="pane">
          <div class="pane-head"><span class="t">结果 <span id="pt-stats" class="muted"></span></span>
            <button class="btn small" id="pt-diff">对比模式</button>
          </div>
          <div class="out" id="pt-out"><span class="muted">结果预览…</span></div>
        </div>
      </div>
      <div class="actionbar proc-actions">
        <button class="btn primary" id="pt-copy">复制结果</button>
        <button class="btn" id="pt-replace">替换剪贴板</button>
        <button class="btn" id="pt-undo">撤销全部修改</button>
        <button class="btn" id="pt-ai"><span data-icon="MagicWand" data-size="16"></span> AI 润色（可选）</button>
      </div>
      <details class="advanced-rules"><summary>更多格式清理选项</summary><div class="rules-grid" id="pt-rules"></div></details>
    </div>
    <div id="proc-ocr" style="display:none">
      <div id="ocr-drop">
        拖入图片，或点击选择文件<br/>
        <span class="muted">也可以直接 Ctrl+V 粘贴截图 · 全程本地识别，不上传</span>
      </div>
      <input type="file" id="ocr-file" accept="image/*" style="display:none" />
      <div id="ocr-work" style="display:none">
        <div id="ocr-preview"><img id="ocr-img" alt=""/><div class="boxes" id="ocr-boxes"></div></div>
        <div class="actionbar" style="margin:6px 0 8px">
          <select id="ocr-lang" class="btn" style="padding:5px 8px">
            <option value="auto">语言：自动</option>
            <option value="zh-Hans">简体中文</option>
            <option value="en">English</option>
          </select>
          <button class="btn" id="ocr-rerun">重新识别</button>
          <button class="btn small" id="ocr-order"><span data-icon="SortDownUp" data-size="16"></span> 按阅读顺序重排</button>
          <button class="btn small" id="ocr-proofread"><span data-icon="MagicWand" data-size="16"></span> AI 校对</button>
        </div>
        <div class="ocr-lines" id="ocr-lines"></div>
        <div class="actionbar">
          <button class="btn primary" id="ocr-copy">复制合并文本</button>
          <button class="btn" id="ocr-copy-lines">仅复制勾选行</button>
        </div>
        <div class="pane"><div class="pane-head"><span class="t">合并结果 · 已自动合并错误换行、清理空行与字间空格</span></div><div class="out" id="ocr-merged" style="min-height:80px"></div></div>
      </div>
    </div>`;

  // ---------- 子页切换 ----------
  const subBtns = view.querySelectorAll('.subtab');
  const textPane = view.querySelector('#proc-text');
  const ocrPane = view.querySelector('#proc-ocr');
  let sub = 'text';
  subBtns.forEach((b) => b.addEventListener('click', () => {
    sub = b.dataset.sub;
    subBtns.forEach((x) => x.classList.toggle('active', x === b));
    textPane.style.display = sub === 'text' ? '' : 'none';
    ocrPane.style.display = sub === 'ocr' ? '' : 'none';
  }));
  function showSub(s) { subBtns.forEach((x) => { if (x.dataset.sub === s) x.click(); }); }

  // ================= 文本清洗 =================
  const src = view.querySelector('#pt-src');
  const out = view.querySelector('#pt-out');
  const statsEl = view.querySelector('#pt-stats');
  const rulesBox = view.querySelector('#pt-rules');
  const quickRulesBox = view.querySelector('#pt-quick-rules');
  let rules = [];
  let enabled = new Set();
  let original = '';
  let originalSet = false;
  let diffMode = false;
  let lastResult = '';
  let aiBusy = false;
  let applyRevision = 0;

  (async () => {
    rules = await api.textRules();
    for (const r of rules) {
      if (r.defaultOn) enabled.add(r.id);
      const item = document.createElement('label');
      item.className = 'rule-item';
      item.title = r.desc;
      item.innerHTML = `<input type="checkbox" ${r.defaultOn ? 'checked' : ''}/><div><div class="rn">${UI.esc(r.name)}</div><div class="rd">${UI.esc(r.desc)}</div></div>`;
      item.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) enabled.add(r.id); else enabled.delete(r.id);
        scheduleApply();
      });
      if (r.id === 'removeAllBlankLines' || r.id === 'removeCjkSpaces' || r.id === 'reflowParagraphs') quickRulesBox.appendChild(item);
      else rulesBox.appendChild(item);
    }
    scheduleApply();
  })();

  let applyTimer = null;
  function scheduleApply() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(applyNow, 180);
  }
  async function applyNow() {
    const revision = ++applyRevision;
    const text = src.value;
    if (!text.trim()) { out.innerHTML = '<span class="muted">结果预览…</span>'; lastResult = ''; return; }
    const { output, ms } = await api.textApply(text, [...enabled]);
    if (revision !== applyRevision) return;
    lastResult = output;
    renderOut(text, output, ms);
  }
  function renderOut(source, result, ms) {
    if (diffMode) {
      const d = UI.diffLines(source, result);
      if (d) {
        out.innerHTML = d.map((l) => l.t === '+' ? `<ins>${UI.esc(l.s)}</ins>` : l.t === '-' ? `<del>${UI.esc(l.s)}</del>` : UI.esc(l.s)).join('\n');
      } else {
        out.textContent = result;
      }
    } else {
      out.textContent = result;
    }
    const chars = result.length;
    statsEl.textContent = `${ms}ms · ${chars} 字符`;
  }

  src.addEventListener('beforeinput', () => {
    if (!originalSet) { original = src.value; originalSet = true; }
  });
  src.addEventListener('input', scheduleApply);
  view.querySelector('#pt-paste').addEventListener('click', async () => {
    const snap = await api.clipboardSnapshot();
    if (snap.kind === 'text') { loadText(snap.text); UI.toast('已读取剪贴板'); }
    else UI.toast('剪贴板中没有文本', true);
  });
  view.querySelector('#pt-copy').addEventListener('click', () => {
    if (!lastResult) return UI.toast('没有可复制的结果', true);
    UI.copyText(lastResult);
  });
  view.querySelector('#pt-replace').addEventListener('click', async () => {
    if (!lastResult) return UI.toast('没有结果可替换', true);
    await api.clipboardWriteText(lastResult);
    UI.toast('剪贴板已替换为结果');
  });
  view.querySelector('#pt-undo').addEventListener('click', () => {
    if (originalSet) { src.value = original; scheduleApply(); UI.toast('已恢复原文'); }
    else UI.toast('没有可撤销的修改', true);
  });
  view.querySelector('#pt-diff').addEventListener('click', (e) => {
    diffMode = !diffMode;
    e.target.textContent = diffMode ? '纯文本模式' : '对比模式';
    scheduleApply();
  });
  view.querySelector('#pt-ai').addEventListener('click', async (e) => {
    const text = lastResult || src.value;
    if (!text.trim()) return UI.toast('先输入或粘贴文本', true);
    if (aiBusy) return;
    if (!(await api.llmConfigured())) {
      UI.toast('请先配置模型服务，再使用 AI 润色', true);
      window.switchTab('settings');
      return;
    }
    aiBusy = true;
    e_busy(e.target, '润色中…');
    try {
      const r = await api.llmProofread('请润色优化以下文本的表达与排版，保持原意与格式（Markdown 结构不变），直接输出结果：\n\n' + text);
      src.value = r.text;
      if (!originalSet) { original = text; originalSet = true; }
      scheduleApply();
      UI.toast('AI 润色完成');
    } catch (err) {
      UI.toast('AI 润色失败：' + err.message, true);
    } finally {
      aiBusy = false;
      e.target.innerHTML = '<span data-icon="MagicWand" data-size="16"></span> AI 润色（可选）';
      e.target.disabled = false;
    }
  });
  function e_busy(btn, label) { btn.disabled = true; btn.textContent = label; }

  function loadText(text) {
    showSub('text');
    original = text;
    originalSet = true;
    src.value = text;
    scheduleApply();
  }

  // ================= OCR =================
  const drop = view.querySelector('#ocr-drop');
  const fileInput = view.querySelector('#ocr-file');
  const work = view.querySelector('#ocr-work');
  const imgEl = view.querySelector('#ocr-img');
  const boxesEl = view.querySelector('#ocr-boxes');
  const linesEl = view.querySelector('#ocr-lines');
  const mergedEl = view.querySelector('#ocr-merged');
  const langSel = view.querySelector('#ocr-lang');
  let ocrResult = null;
  let ocrBusy = false;
  let lineOrder = 'raw';
  let currentDataUrl = null;
  const OCR_AUTO_RULES = ['removeZeroWidth', 'stripControlChars', 'trimTrailingSpaces', 'removeAllBlankLines', 'removeCjkSpaces', 'dedupeSpaces', 'reflowParagraphs'];
  let mergedRevision = 0;
  let mergedPending = Promise.resolve();

  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.[0]) readFile(fileInput.files[0]);
    fileInput.value = '';
  });
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f && f.type.startsWith('image/')) readFile(f);
  });
  view.addEventListener('paste', (e) => {
    if (sub !== 'ocr') return;
    for (const it of e.clipboardData?.items || []) {
      if (it.type.startsWith('image/')) {
        e.preventDefault();
        readFile(it.getAsFile());
        return;
      }
    }
  });

  function readFile(file) {
    const r = new FileReader();
    r.onload = () => loadOcrImage(r.result);
    r.readAsDataURL(file);
  }

  async function loadOcrImage(dataUrl) {
    showSub('ocr');
    mergedRevision++;
    mergedPending = Promise.resolve();
    currentDataUrl = dataUrl;
    work.style.display = '';
    imgEl.src = dataUrl;
    boxesEl.innerHTML = '';
    linesEl.innerHTML = '<div class="muted" style="padding:12px 0;text-align:center">本地识别中…（不联网）</div>';
    mergedEl.innerHTML = '';
    await runOcr();
  }

  async function runOcr() {
    if (!currentDataUrl || ocrBusy) return;
    ocrBusy = true;
    try {
      ocrResult = await api.ocrRecognize(currentDataUrl, langSel.value);
      renderOcrResult();
    } catch (e) {
      linesEl.innerHTML = `<div class="empty"><span class="big" data-icon="Warning" data-size="24"></span>${UI.esc(e.message)}</div>`;
    } finally {
      ocrBusy = false;
    }
  }

  function renderOcrResult() {
    if (ocrResult.empty) {
      mergedRevision++;
      mergedPending = Promise.resolve();
      linesEl.innerHTML = `<div class="empty"><span class="big" data-icon="InfoCircle" data-size="24"></span>未检测到文字<br/><span class="muted">换一张更清晰的图片，或检查语言选择</span></div>`;
      mergedEl.textContent = '';
      return;
    }
    // 识别区域框
    boxesEl.innerHTML = '';
    const list = orderedLines();
    imgEl.onload = null;
    const scale = () => imgEl.clientWidth / (ocrResult.width || imgEl.naturalWidth);
    const drawBoxes = () => {
      boxesEl.innerHTML = '';
      const s = scale();
      for (const l of ocrResult.lines) {
        const b = document.createElement('div');
        b.className = 'bx';
        b.style.left = l.x * s + 'px'; b.style.top = l.y * s + 'px';
        b.style.width = l.w * s + 'px'; b.style.height = l.h * s + 'px';
        boxesEl.appendChild(b);
      }
    };
    drawBoxes();
    window.addEventListener('resize', drawBoxes);

    // 逐行编辑
    linesEl.innerHTML = '';
    for (const l of list) {
      const row = document.createElement('div');
      row.className = 'ocr-line';
      row.innerHTML = `<input type="checkbox" checked/><input type="text" value="${UI.esc(l.text)}"/>`;
      const cb = row.querySelector('input[type=checkbox]');
      const tx = row.querySelector('input[type=text]');
      cb.addEventListener('change', updateMerged);
      tx.addEventListener('input', () => { l.text = tx.value; updateMerged(); });
      linesEl.appendChild(row);
    }
    updateMerged();
  }

  function orderedLines() {
    if (!ocrResult) return [];
    if (lineOrder === 'reading') {
      // 按阅读顺序：先按 y 分组再按 x
      const sorted = ocrResult.lines.slice().sort((a, b) => a.y - b.y || a.x - b.x);
      const groups = [];
      for (const l of sorted) {
        const g = groups.at(-1);
        if (g && Math.abs(l.y - g.baseY) <= Math.max(12, l.h * 0.6)) g.items.push(l);
        else groups.push({ baseY: l.y, items: [l] });
      }
      return groups.flatMap((g) => g.items.sort((a, b) => a.x - b.x));
    }
    return ocrResult.lines;
  }

  async function updateMerged() {
    const revision = ++mergedRevision;
    const checks = linesEl.querySelectorAll('input[type=checkbox]');
    const texts = linesEl.querySelectorAll('input[type=text]');
    const parts = [];
    for (let i = 0; i < checks.length; i++) {
      if (checks[i].checked) parts.push(texts[i].value);
    }
    const raw = parts.join('\n');
    if (!raw.trim()) { mergedEl.textContent = ''; mergedPending = Promise.resolve(); return; }
    mergedEl.textContent = '正在整理识别文字…';
    mergedPending = api.textApply(raw, OCR_AUTO_RULES);
    try {
      const { output } = await mergedPending;
      if (revision === mergedRevision) mergedEl.textContent = output.trim();
    } catch (err) {
      if (revision === mergedRevision) {
        mergedEl.textContent = raw;
        UI.toast('文字清理失败：' + err.message, true);
      }
    }
  }

  view.querySelector('#ocr-rerun').addEventListener('click', runOcr);
  langSel.addEventListener('change', runOcr);
  view.querySelector('#ocr-order').addEventListener('click', (e) => {
    lineOrder = lineOrder === 'raw' ? 'reading' : 'raw';
    e.target.innerHTML = `<span data-icon="SortDownUp" data-size="16"></span> ${lineOrder === 'reading' ? '阅读顺序（点击还原）' : '按阅读顺序重排'}`;
    renderOcrResult();
  });
  view.querySelector('#ocr-copy').addEventListener('click', async () => {
    try { await mergedPending; } catch { /* updateMerged 已处理并显示原文 */ }
    UI.copyText(mergedEl.textContent, '识别文本已复制');
  });
  view.querySelector('#ocr-copy-lines').addEventListener('click', async () => {
    const checks = linesEl.querySelectorAll('input[type=checkbox]');
    const texts = linesEl.querySelectorAll('input[type=text]');
    const parts = [];
    for (let i = 0; i < checks.length; i++) if (checks[i].checked) parts.push(texts[i].value);
    try {
      const { output } = await api.textApply(parts.join('\n'), OCR_AUTO_RULES);
      UI.copyText(output.trim(), '已复制勾选行');
    } catch (err) { UI.toast('文字清理失败：' + err.message, true); }
  });
  view.querySelector('#ocr-proofread').addEventListener('click', async (e) => {
    try { await mergedPending; } catch { /* updateMerged 已处理并显示原文 */ }
    const text = mergedEl.textContent?.trim();
    if (!text) return UI.toast('没有可校对的文本', true);
    if (!(await api.llmConfigured())) return UI.toast('AI 校对需先配置模型服务（会发送识别文本）', true);
    if (!confirm2(e.target)) return;
    e_busy(e.target, '校对中…');
    try {
      const r = await api.llmProofread('请校对以下 OCR 识别文本，修正错别字与断句，直接输出修正后的文本，不要解释：\n\n' + text);
      mergedEl.textContent = r.text;
      UI.toast('AI 校对完成');
    } catch (err) {
      UI.toast('校对失败：' + err.message, true);
    } finally {
      e.target.disabled = false;
      e.target.innerHTML = '<span data-icon="MagicWand" data-size="16"></span> AI 校对';
    }
  });
  let lastConfirm = 0;
  function confirm2(btn) {
    // 显式触发：第一次点击提示将发送内容，2.5 秒内再点确认
    const now = Date.now();
    if (now - lastConfirm > 2500) {
      lastConfirm = now;
      UI.toast('将把识别文本发送给已配置的模型服务，再次点击确认');
      return false;
    }
    return true;
  }

  function pickImageFile() { showSub('ocr'); fileInput.click(); }

  window.TABS.process = { loadText, loadOcrImage, pickImageFile, onShown: () => {} };
})();
