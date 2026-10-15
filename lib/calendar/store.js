'use strict';
const {randomUUID}=require('node:crypto');const {JsonStore}=require('../store');const model=require('./model');
function normalizeItem(raw){const category=model.CATEGORIES.some(x=>x[0]===raw.category)?raw.category:'other';return {source:raw.source,externalId:String(raw.externalId),recurrenceInstanceId:raw.recurrenceInstanceId||null,title:raw.title||'（无标题）',startsAtUtc:raw.startsAtUtc,endsAtUtc:raw.endsAtUtc||null,allDay:!!raw.allDay,sourceUrl:raw.sourceUrl||null,updatedAt:raw.updatedAt||new Date().toISOString(),reminderOffsets:Array.isArray(raw.reminderOffsets)?raw.reminderOffsets:[15],syncStatus:raw.syncStatus||'ok',category,color:model.color(category,raw.color),notes:String(raw.notes||''),timeZone:raw.timeZone||model.zone(),recurrence:raw.recurrence||null};}
const dedupKey=i=>`${i.source}:${i.externalId}:${i.recurrenceInstanceId||''}`,seriesKey=i=>`${i.source}:${i.externalId}`;
class CalendarStore{
 constructor(file){this.store=new JsonStore(file,{items:[],overrides:{},hidden:[],revision:0});}
 revision(){return this.store.get('revision',0);}
 commit(patch){const previous=structuredClone(this.store.data);try{this.store.set({...patch,revision:this.revision()+1});}catch(error){this.store.data=previous;throw error;}}
 all(){const hidden=new Set(this.store.get('hidden',[])),overrides=this.store.get('overrides',{});return this.store.get('items',[]).map(normalizeItem).filter(i=>!hidden.has(seriesKey(i))).map(i=>({...i,...overrides[seriesKey(i)]}));}
 upsert(items){const map=new Map(this.store.get('items',[]).map(i=>[dedupKey(i),i]));let changed=0;for(const raw of items){const item=normalizeItem(raw),key=dedupKey(item);if(!map.has(key))changed++;map.set(key,item);}this.commit({items:[...map.values()]});return changed;}
 replaceSource(source,items){this.commit({items:[...this.store.get('items',[]).filter(i=>i.source!==source),...items.map(normalizeItem)]});}
 remove(source,externalId,options={}){return this.applyOperations([{op:'delete',source,externalId,...options}]);}
 create(item){return this.applyOperations([{op:'create',item}]).items[0];}
 update(source,externalId,item,options={}){return this.applyOperations([{op:'update',source,externalId,item,...options}]);}
 applyOperations(operations,{expectedRevision}={}){
  if(expectedRevision!==undefined&&expectedRevision!==this.revision())throw Error('日程刚刚发生变化，请重新规划');if(!Array.isArray(operations)||operations.length>100)throw Error('一次最多管理 100 项日程');
  const data=structuredClone(this.store.data),items=data.items||[],overrides=data.overrides||{},hidden=new Set(data.hidden||[]),changed=[],counts={created:0,updated:0,deleted:0};
  for(const action of operations){if(action?.scope&&!['series','occurrence'].includes(action.scope))throw Error('日程修改范围无效');if(!action||!['create','update','delete'].includes(action.op))throw Error('日程操作无效');
   if(action.op==='create'){const normalized=model.validate(action.item),item={...normalized,source:'local',externalId:'local-'+randomUUID(),recurrenceInstanceId:null,sourceUrl:null,syncStatus:'ok'};items.push(item);changed.push(item);counts.created++;continue;}
   const index=items.findIndex(i=>i.source===action.source&&String(i.externalId)===String(action.externalId)&&!hidden.has(seriesKey(i)));if(index<0)throw Error('目标日程不存在或已删除');const original=normalizeItem(items[index]),key=seriesKey(original),base={...original,...overrides[key]},single=action.scope==='occurrence'&&base.recurrence;
   if(single){const instance=String(action.recurrenceInstanceId||'');if(!Number.isFinite(Date.parse(instance)))throw Error('请选择具体的重复日程');const at=Date.parse(instance),match=model.expand(base,at,at+1).find(i=>i.recurrenceInstanceId===instance);if(!match)throw Error('重复日程实例无效');const instanceKey=key+':'+instance;if(action.op==='delete'){overrides[instanceKey]={deleted:true};counts.deleted++;continue;}if(action.item?.recurrence!==undefined&&action.item.recurrence!==null)throw Error('本次日程不能单独设置重复规则');const current={...match,...overrides[instanceKey]},next=model.validate({...action.item,recurrence:null},current);overrides[instanceKey]={...next,recurrenceInstanceId:instance};changed.push({...base,...next,recurrenceInstanceId:instance});counts.updated++;continue;}
   if(action.op==='delete'){if(original.source==='local')items.splice(index,1);else hidden.add(key);for(const k of Object.keys(overrides))if(k===key||k.startsWith(key+':'))delete overrides[k];counts.deleted++;continue;}
   const next=model.validate(action.item,base);if(original.source==='local')items[index]={...base,...next};else overrides[key]=next;
   if(next.startsAtUtc!==base.startsAtUtc||JSON.stringify(next.recurrence)!==JSON.stringify(base.recurrence))for(const k of Object.keys(overrides))if(k.startsWith(key+':'))delete overrides[k];changed.push({...base,...next});counts.updated++;
  }
  this.commit({items,overrides,hidden:[...hidden]});return {...counts,items:changed,revision:this.revision()};
 }
 occurrences(from,to){const overrides=this.store.get('overrides',{}),out=[];for(const item of this.all()){const key=seriesKey(item),seen=new Set();for(const occurrence of model.expand(item,from,to)){const k=key+':'+(occurrence.recurrenceInstanceId||''),patch=overrides[k];seen.add(k);if(patch?.deleted)continue;const current={...occurrence,...patch};if(model.intersects(current,from,to))out.push(current);}if(item.recurrence)for(const [k,patch]of Object.entries(overrides)){if(!k.startsWith(key+':')||seen.has(k)||patch.deleted||!patch.recurrenceInstanceId)continue;const current={...item,...patch,seriesStartsAtUtc:item.startsAtUtc,seriesEndsAtUtc:item.endsAtUtc};if(model.intersects(current,from,to))out.push(current);}}return out.sort((a,b)=>Date.parse(a.startsAtUtc)-Date.parse(b.startsAtUtc)||a.title.localeCompare(b.title));}
 upcoming(fromMs=Date.now()){return this.occurrences(fromMs-86400000,fromMs+90*86400000);}
 today(){const d=new Date();d.setHours(0,0,0,0);const end=new Date(d);end.setDate(end.getDate()+1);return this.occurrences(+d,+end).sort((a,b)=>a.allDay===b.allDay?Date.parse(a.startsAtUtc)-Date.parse(b.startsAtUtc):a.allDay?-1:1);}
}
module.exports={CalendarStore,normalizeItem,dedupKey,seriesKey};
