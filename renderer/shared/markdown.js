'use strict';
window.SafeMarkdown = {
  render(text) {
    const element = document.createElement('div');
    element.className = 'md';
    if (!window.marked?.parse || !window.DOMPurify?.sanitize) {
      element.textContent = String(text || '');
      return element;
    }
    const html = window.marked.parse(String(text || ''), { gfm: true, breaks: true });
    element.innerHTML = window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','strong','em','del','s','code','pre','blockquote','ul','ol','li','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','th','td','hr','a','span'],
      ALLOWED_ATTR: ['href','title','class'], ALLOW_DATA_ATTR: false,
    });
    return element;
  },
};
