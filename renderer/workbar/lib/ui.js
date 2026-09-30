'use strict';
/** 工作栏共享工具：Markdown 安全渲染（DOMPurify）、逐块复制、链接确认、Toast。 */
window.UI = (() => {
  window.TABS = window.TABS || {}; // 页签模块注册表（先于各 tab 脚本初始化）
  const md = window.marked?.setOptions ? window.marked : null;
  if (md) {
    window.marked.setOptions({ gfm: true, breaks: true });
  }

  function toast(msg, isErr = false) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.toggle('err', isErr);
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  async function copyText(text, label = '已复制') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast(label);
    } catch {
      // 回退：textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast(label);
    }
  }

  /** 链接确认条（§P0-2：外链点击前显示目标） */
  function ensureLinkConfirm() {
    let bar = document.getElementById('link-confirm');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'link-confirm';
      bar.innerHTML = `<span class="url"></span><button class="btn small primary">打开</button><button class="btn small">取消</button>`;
      document.body.appendChild(bar);
      bar.querySelector('.btn:not(.primary)').onclick = () => bar.classList.remove('show');
      bar._url = bar.querySelector('.url');
      bar._open = bar.querySelector('.primary');
    }
    return bar;
  }
  function confirmLink(url) {
    const bar = ensureLinkConfirm();
    bar._url.textContent = url;
    bar.classList.add('show');
    bar._open.onclick = () => {
      bar.classList.remove('show');
      window.api.openExternal(url).catch((e) => toast(e.message, true));
    };
    clearTimeout(bar._t);
    bar._t = setTimeout(() => bar.classList.remove('show'), 6000);
  }

  /** 渲染 Markdown → 安全 HTML 节点；代码块加复制按钮；链接走确认 */
  function renderMarkdown(text) {
    const wrap = window.SafeMarkdown.render(text);

    // 代码块：包裹头部（语言名 + 复制）
    wrap.querySelectorAll('pre > code').forEach((codeEl) => {
      const pre = codeEl.parentElement;
      const m = (codeEl.className || '').match(/language-([\w+-]+)/);
      const lang = m ? m[1] : 'text';
      const box = document.createElement('div');
      box.className = 'codeblock';
      const head = document.createElement('div');
      head.className = 'cb-head';
      head.innerHTML = `<span class="lang">${esc(lang)}</span>`;
      const btn = document.createElement('button');
      btn.className = 'cb-copy';
      btn.textContent = '复制';
      btn.onclick = () => copyText(codeEl.textContent, '代码已复制（保留缩进）');
      head.appendChild(btn);
      pre.replaceWith(box);
      box.appendChild(head);
      box.appendChild(pre);
    });

    // 链接：确认后打开
    wrap.querySelectorAll('a[href]').forEach((a) => {
      a.title = a.href; // 悬停显示目标
      a.addEventListener('click', (e) => {
        e.preventDefault();
        confirmLink(a.href);
      });
    });
    return wrap;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtTokens(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.round(n));
  }
  function ago(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60e3) return '刚刚';
    if (ms < 3600e3) return Math.floor(ms / 60e3) + ' 分钟前';
    if (ms < 86400e3) return Math.floor(ms / 3600e3) + ' 小时前';
    return Math.floor(ms / 86400e3) + ' 天前';
  }
  function fmtCost(usd) {
    if (usd == null) return '—';
    if (usd === 0) return '$0';
    if (usd < 0.01) return '$' + usd.toFixed(4);
    return '$' + usd.toFixed(2);
  }

  /** 简易行级 diff：在输出窗格标记删除/插入（用于双栏预览强化，结果窗格仍显示纯结果） */
  function diffLines(a, b) {
    const A = a.split('\n'), B = b.split('\n');
    const n = A.length, m = B.length;
    // LCS（限制规模避免大文本卡顿）
    if (n * m > 250000) return null;
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.push({ t: ' ', s: B[j] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: '-', s: A[i] }); i++; }
      else { out.push({ t: '+', s: B[j] }); j++; }
    }
    while (i < n) { out.push({ t: '-', s: A[i++] }); }
    while (j < m) { out.push({ t: '+', s: B[j++] }); }
    return out;
  }

  return { toast, copyText, renderMarkdown, esc, fmtTokens, ago, fmtCost, diffLines, confirmLink };
})();
