'use strict';
// Pinned official Reicon Duotone Beta SVGs; regeneration uses the website data export.
const fs=require('node:fs'),path=require('node:path');
const shapes=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','icons','reicon','duotone.json'),'utf8'));
fs.writeFileSync(path.join(__dirname,'..','renderer','shared','reicon-duotone.js'),`'use strict';\n/* Reicon Duotone Beta; MIT, assets/icons/reicon/LICENSE */\n(()=>{const shapes=${JSON.stringify(shapes)};window.ReiconDuotone={create(name,size=28){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width',size);svg.setAttribute('height',size);svg.setAttribute('fill','none');svg.setAttribute('aria-hidden','true');svg.classList.add('reicon','reicon-duotone');svg.innerHTML=shapes[name]||shapes['document-text'];return svg;}};})();\n`);
