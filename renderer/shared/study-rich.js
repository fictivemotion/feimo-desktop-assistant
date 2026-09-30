'use strict';
window.StudyRich={render(content){
  const root=document.createElement('div');root.className='md study-rich';
  if(/<\/?(?:p|div|span|table|h[1-6]|ul|ol|strong|blockquote)\b/i.test(String(content||'')) && window.DOMPurify){
    root.innerHTML=window.DOMPurify.sanitize(String(content||''),{ALLOWED_TAGS:['p','div','span','br','strong','em','s','u','code','pre','blockquote','ul','ol','li','h1','h2','h3','h4','table','thead','tbody','tr','th','td','hr'],ALLOWED_ATTR:['class','data-latex','data-type'],ALLOW_DATA_ATTR:false});
  }else root.append(window.SafeMarkdown.render(content));
  if(window.katex){for(const node of root.querySelectorAll('[data-latex]')){try{window.katex.render(node.getAttribute('data-latex'),node,{throwOnError:false,displayMode:node.getAttribute('data-type')==='block-math',trust:false})}catch{node.textContent=node.getAttribute('data-latex')}}}
  if(window.renderMathInElement)window.renderMathInElement(root,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'$',right:'$',display:false}],throwOnError:false,trust:false});
  return root;
}};
