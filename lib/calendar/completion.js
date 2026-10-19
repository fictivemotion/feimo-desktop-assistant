'use strict';
// Reuse the existing local occurrence marks. Completing a repeated event only
// marks that occurrence and never edits its remote source, schedule or reminder.
const occurrenceKey=item=>JSON.stringify([item.source,String(item.externalId),item.recurrenceInstanceId||'',item.startsAtUtc]);
function decorate(item,store){return {...item,completionKey:occurrenceKey(item),completed:!!store?.isDone(item)};}
function set(calendar,store,value={}){
 if(!store)throw Error('日程完成标记暂未就绪，请稍后重试');
 if(typeof value.key!=='string'||value.key.length>2048||typeof value.done!=='boolean')throw Error('完成标记无效');
 let parts;try{parts=JSON.parse(value.key);}catch{throw Error('完成标记无效');}
 if(!Array.isArray(parts)||parts.length!==4||parts.some(p=>typeof p!=='string')||!parts[0]||!parts[1])throw Error('完成标记无效');
 const start=Date.parse(parts[3]);if(!Number.isFinite(start)||start<Date.UTC(1900,0,1)||start>Date.UTC(2200,0,1))throw Error('完成标记无效');
 const target=calendar.occurrences(start,start+1).find(item=>occurrenceKey(item)===value.key);
 if(!target)throw Error('日程已改变，请刷新后重试');
 store.done(target,value.done);return {key:value.key,completed:store.isDone(target)};
}
module.exports={occurrenceKey,decorate,set};
