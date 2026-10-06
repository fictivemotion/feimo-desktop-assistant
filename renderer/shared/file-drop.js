'use strict';
((root)=>{
 function urlsFrom(text){return [...String(text||'').matchAll(/https?:\/\/[^\s<>"'\x00]+/gi)].map(m=>m[0].replace(/[，。；）)\]}]+$/g,''));}
 function payload(transfer,api){const files=[...transfer.files].map(f=>{try{return api.filePath(f);}catch{return '';}}).filter(Boolean),urls=[];const add=text=>{urls.push(...urlsFrom(text));if(!urls.length&&/%3A%2F%2F/i.test(text))try{urls.push(...urlsFrom(decodeURIComponent(text)));}catch{}};const html=transfer.getData('text/html');if(html){const doc=new DOMParser().parseFromString(html,'text/html');for(const a of doc.querySelectorAll('a[href]'))add(a.getAttribute('href'));}for(const type of transfer.types||[])if(type!=='Files'&&!type.includes('html'))add(transfer.getData(type));return {paths:[...new Set(files)],urls:[...new Set(urls)].slice(0,31)};}
 async function importTransfer(transfer,api){const data=payload(transfer,api);if(!data.paths.length&&!data.urls.length)throw Error('未识别到文件或网址，请拖入真实文件或网页链接');return api.fileImportDrop(data);}
 const api={payload,urlsFrom,importTransfer};if(typeof module==='object')module.exports=api;else root.FileDrop=api;
})(typeof window==='object'?window:globalThis);
