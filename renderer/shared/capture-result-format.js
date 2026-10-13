'use strict';
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.CaptureResultFormat=api;})(typeof globalThis==='object'?globalThis:this,()=>{
 function latex(text){const source=String(text||'').replace(/^\s*```(?:latex|markdown|math)?\s*\n|\n```\s*$/g,'').trim();const formulas=[...source.matchAll(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\$)\$([^\n$]+)\$(?!\$)/g)].map(m=>(m[1]??m[2]??m[3]??m[4]).trim()).filter(Boolean);return(formulas.length?formulas:[source]).join('\n\n');}
 function formula(text,format){const source=latex(text);return format==='latex'?source:source.split(/\n\s*\n/).filter(Boolean).map(value=>'$$\n'+value+'\n$$').join('\n\n');}
 return {latex,formula};
});
