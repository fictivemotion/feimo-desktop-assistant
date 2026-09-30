'use strict';
// CapsWriter's phonetic candidate search + explicit rules, adapted to JavaScript.
// Source and license: assets/licenses/CapsWriter-Offline-LICENSE.txt.
const {pinyin}=require('pinyin-pro');
function rows(value){return String(value||'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#'));}
function parseWords(value){return rows(value).slice(0,500).map(line=>{const [word,blacklist='']=line.split('~~~');const variants=word.split('|').map(s=>s.trim()).filter(Boolean);return {target:variants[0],variants,blacklist:blacklist.split('|').map(s=>s.trim()).filter(Boolean)};}).filter(w=>w.target&&w.target.length<=64);}
function parseRules(value){return rows(value).map((line,i)=>{const at=line.indexOf('=');if(at<=0)throw new Error(`纠正规则第 ${i+1} 行需要使用 错词=正确词`);const from=line.slice(0,at).trim(),to=line.slice(at+1).trim();if(!from||from.length>128||to.length>256)throw new Error(`纠正规则第 ${i+1} 行过长或为空`);return {from,to};});}
function phonetics(text){return pinyin(text,{toneType:'none',type:'array',nonZh:'consecutive'}).map(s=>s.toLowerCase());}
function phoneticScore(a,b){if(a.length!==b.length)return 0;let score=0;for(let i=0;i<a.length;i++){if(a[i]===b[i]){score++;continue;}const n=s=>s.replace(/^zh/,'z').replace(/^ch/,'c').replace(/^sh/,'s').replace(/ng$/,'n');if(n(a[i])===n(b[i]))score+=.72;}return score/a.length;}
function correct(text,config={}){
  let value=String(text||'');const matches=[];
  for(const {from,to} of parseRules(config.rules)){if(value.includes(from)){value=value.split(from).join(to);matches.push({from,to,kind:'literal'});}}
  const words=parseWords(config.hotwords);
  // Explicit aliases precede fuzzy correction; longest alias first, one pass (no loops).
  const aliases=words.flatMap(w=>w.variants.slice(1).map(from=>({from,to:w.target,blacklist:w.blacklist}))).sort((a,b)=>b.from.length-a.from.length);
  for(const a of aliases){if(a.from===a.to)continue;let pos=0;while((pos=value.indexOf(a.from,pos))>=0){const context=value.slice(Math.max(0,pos-12),pos+a.from.length+12);if(!a.blacklist.some(b=>context.includes(b))){value=value.slice(0,pos)+a.to+value.slice(pos+a.from.length);matches.push({from:a.from,to:a.to,kind:'alias'});pos+=a.to.length;}else pos+=a.from.length;}}
  if(config.fuzzy===false)return {text:value,matches};
  // Conservative Chinese window matching; never cross spaces/punctuation or change numbers/English.
  const spans=[...value.matchAll(/[\u4e00-\u9fff]+/g)].map(m=>({text:m[0],index:m.index,phonetics:phonetics(m[0])}));const candidates=[];
  for(const w of words){if(!/^[\u4e00-\u9fff]{2,16}$/.test(w.target))continue;const wp=phonetics(w.target),n=w.target.length;
    for(const span of spans){const p=span.phonetics;for(let i=0;i<=span.text.length-n;i++){const from=span.text.slice(i,i+n);if(from===w.target)continue;const at=span.index+i;if(w.blacklist.some(b=>value.slice(Math.max(0,at-12),at+n+12).includes(b)))continue;const score=phoneticScore(wp,p.slice(i,i+n));if(score>=(config.threshold||.9))candidates.push({start:at,end:at+n,to:w.target,from,score});}}
  }
  const accepted=[];for(const m of candidates.sort((a,b)=>b.score-a.score||(b.end-b.start)-(a.end-a.start))){if(!accepted.some(a=>a.start<m.end&&a.end>m.start))accepted.push(m);}
  for(const m of accepted.sort((a,b)=>b.start-a.start)){value=value.slice(0,m.start)+m.to+value.slice(m.end);matches.push({from:m.from,to:m.to,kind:'phonetic'});}
  return {text:value,matches};
}
module.exports={correct,parseWords,parseRules,phoneticScore};
