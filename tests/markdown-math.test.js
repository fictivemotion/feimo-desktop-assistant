'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),createPurify=require('dompurify'),{Marked}=require('marked'),katex=require('katex');
function fixture(t){const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());w.marked=new Marked();w.DOMPurify=createPurify(w);w.katex=katex;w.eval(fs.readFileSync(path.join(__dirname,'../renderer/shared/markdown.js'),'utf8'));return text=>w.SafeMarkdown.render(text);}
test('voice Markdown retains TeX delimiters, indices, fractions and multiline matrices before parsing',t=>{const render=fixture(t),node=render(String.raw`行内 \(x_i^2+\frac{a}{b}\) 与 $E=mc^2$。

\[
\begin{pmatrix}a & b \\ c & d\end{pmatrix}
\]

$$\int_0^1 x^2\,dx=\frac13$$`);assert.equal(node.querySelectorAll('.feimo-math').length,4);assert.equal(node.querySelectorAll('.katex').length,4);assert.equal(node.querySelectorAll('.katex-error,.feimo-math-fallback').length,0);assert.equal(node.querySelectorAll('.feimo-math-display').length,2);assert.match(node.querySelector('annotation').textContent,/x_i\^2/);});
test('list, table, code and currency text remain intact alongside mathematics',t=>{const render=fixture(t),node=render(String.raw`- 公式 \(a_1+b_2\)

| 类型 | 结果 |
| --- | --- |
| 实验 | $\sqrt{x}$ |

代码 \`\(x_i\)\`，金额 $5 和 $10。

\`\`\`js
const literal = "\\(x_i\\)";
\`\`\``.replaceAll('\\`','`'));assert.equal(node.querySelectorAll('.katex').length,2);assert.equal(node.querySelectorAll('table').length,1);assert.equal(node.querySelectorAll('pre code').length,1);assert.match(node.textContent,/金额 \$5 和 \$10/);assert.match(node.querySelector('p code').textContent,/\\\(x_i\\\)/);});
test('streamed incomplete expressions recover on completion and unsupported TeX keeps readable source',t=>{const render=fixture(t);assert.equal(render(String.raw`思考 \(\frac{a}`).querySelectorAll('.katex').length,0);assert.equal(render(String.raw`思考 \(\frac{a}{b}\)`).querySelectorAll('.katex').length,1);const bad=render(String.raw`\(\unknownFormula{x}\)`);assert.equal(bad.querySelectorAll('.feimo-math-fallback').length,1);assert.match(bad.textContent,/unknownFormula/);assert.equal(render('$x$').querySelectorAll('.katex').length,1);});
test('math parsing retains HTML sanitization and cannot enable TeX trusted HTML or links',t=>{const render=fixture(t),node=render(String.raw`<img src=x onerror=alert(1)><script>alert(1)</script> \(\href{javascript:alert(1)}{bad}\) \(\htmlClass{bad}{x}\)`);assert.equal(node.querySelectorAll('script,img,[onerror],a[href^="javascript:"]').length,0);assert.equal(node.querySelectorAll('.bad').length,0);});
