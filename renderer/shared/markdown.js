'use strict';
(()=>{
  const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const installed = new WeakSet();
  function closing(source,delimiter,start){for(let i=start;i<source.length;i++){if(!source.startsWith(delimiter,i))continue;let slashes=0;for(let p=i-1;p>=0&&source[p]==='\\';p--)slashes++;if(slashes%2===0)return i;}return -1;}
  function token(source,block){const leading=block?source.match(/^[ \t]*/)[0].length:0,src=source.slice(leading);let left,right,display;
    if(src.startsWith('$$')){left=right='$$';display=true;}
    else if(src.startsWith('\\[')){left='\\[';right='\\]';display=true;}
    else if(!block&&src.startsWith('\\(')){left='\\(';right='\\)';display=false;}
    else if(!block&&src.startsWith('$')){left=right='$';display=false;}
    else return;
    const end=closing(src,right,left.length);if(end<0)return;const text=src.slice(left.length,end);if(!text.trim()||text.length>16000)return;
    if(left==='$'&&(/^[\s]|[\s]$|\n/.test(text)||/\d/.test(src[end+1]||'')))return;
    const raw=source.slice(0,leading+end+right.length);return {type:block?'feimoMathBlock':'feimoMathInline',raw,text,display};
  }
  function install(marked){if(installed.has(marked)||!marked.use)return;installed.add(marked);const renderer=t=>`<span class="feimo-math ${t.display?'feimo-math-display':'feimo-math-inline'}">${escape(t.text)}</span>`;
    // Tokenize before Markdown consumes TeX backslashes, underscores, matrix
    // line breaks or emphasis. Code spans/fences retain their literal content.
    marked.use({extensions:[{name:'feimoMathBlock',level:'block',start:src=>src.search(/(?:^|\n)[ \t]*(?:\$\$|\\\[)/),tokenizer:src=>token(src,true),renderer},{name:'feimoMathInline',level:'inline',start:src=>src.search(/\$|\\[([]/),tokenizer:src=>token(src,false),renderer}]});
  }
window.SafeMarkdown = {
  render(text) {
    const element = document.createElement('div');
    element.className = 'md';
    if (!window.marked?.parse || !window.DOMPurify?.sanitize) {
      element.textContent = String(text || '');
      return element;
    }
    install(window.marked);
    const html = window.marked.parse(String(text || ''), { gfm: true, breaks: true });
    element.innerHTML = window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','strong','em','del','s','code','pre','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','th','td','hr','a','span'],
      ALLOWED_ATTR: ['href','title','class'], ALLOW_DATA_ATTR: false,
    });
    for(const node of element.querySelectorAll('.feimo-math')){
      const source=node.textContent,display=node.classList.contains('feimo-math-display');
      if(!window.katex?.renderToString)continue;
      try{node.innerHTML=window.katex.renderToString(source,{displayMode:display,throwOnError:true,trust:false,strict:'ignore',maxExpand:1000,maxSize:20});}
      catch{node.textContent=source;node.classList.add('feimo-math-fallback');node.title='公式暂不支持，保留原始表达式';}
    }
    return element;
  },
};
})();
