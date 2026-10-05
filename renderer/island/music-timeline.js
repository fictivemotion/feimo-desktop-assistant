'use strict';
((root)=>{
 function position(m,now=Date.now()) {const p=Math.max(0,Number(m?.position)||0)+(m?.playing?Math.max(0,now-(m.sampledAt||now))/1000:0);return m?.duration>0?Math.min(p,m.duration):p;}
 function lineAt(rows,seconds){let low=0,high=rows.length;while(low<high){const mid=(low+high)>>>1;if(rows[mid].time<=seconds)low=mid+1;else high=mid;}return rows[low-1]?.text||'';}
 function clock(seconds){const n=Math.floor(Math.max(0,seconds||0));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
 const api={position,lineAt,clock};if(typeof module==='object')module.exports=api;else root.MusicTimeline=api;
})(typeof window==='object'?window:globalThis);
