'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{PassThrough,Writable}=require('node:stream');
const {activities,Selection}=require('../renderer/island/compact-state');const {Music}=require('../lib/music');
const snapshot=()=>({voice:{},bridge:{requests:[]},focus:{labels:[],active:{remainingMs:1500000,status:'running'}},music:{available:true,playing:true,title:'测试歌曲'},agents:{sessions:[{status:'running',source:'codex',lastSummary:'修改组件'}]},noise:{playing:true}});
test('countdown text has one stable owner and a manually selected activity survives every poll',()=>{
 const s=snapshot(),picker=new Selection();assert.equal(picker.update(activities(s)).id,'focus');
 assert.equal(picker.next().id,'music');for(let i=0;i<30;i++){s.focus.active.remainingMs-=1000;assert.equal(picker.update(activities(s)).id,'music');}
 assert.equal(picker.next().id,'agent');assert.equal(picker.next().id,'noise');assert.equal(picker.update(activities(s)).id,'noise');
 s.noise.playing=false;assert.equal(picker.update(activities(s)).id,'focus');s.focus.active.status='paused';assert.match(picker.update(activities(s)).line,/已暂停/);
});
test('expired reminders and finished activities are removed; empty and urgent states remain readable',()=>{
 const picker=new Selection(),s={voice:{active:true,message:'正在校对'},bridge:{requests:[{}]},notices:[{id:1,text:'过期'}]};
 assert.deepEqual(activities(s).map(x=>x.id),['voice','attention']);assert.equal(picker.update(activities(s)).line,'正在校对');s.voice.active=false;assert.equal(picker.update(activities(s)).id,'attention');s.bridge.requests=[];assert.equal(picker.update(activities(s)).id,'idle');
});
test('music calibrates fallback lyrics, resets for changed artists, and exposes native failures without losing the song',async t=>{
 let reply={available:true,title:'测试歌曲',artist:'甲',position:12,timelineExact:false,playing:false};let child;
 const m=new Music({settings:{get:()=>({player:'netease'})},fetcher:async()=>{throw Error('offline fixture');},spawnProcess:()=>{child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new Writable({write(buf,enc,done){const request=JSON.parse(buf);setImmediate(()=>child.stdout.write(JSON.stringify({id:request.id,data:reply})+'\n'));done();}});child.kill=()=>child.emit('exit',0);return child;}});t.after(()=>m.stop());
 await m.command('poll');await m.command({command:'lyrics-sync',seconds:50});assert.equal((await m.command('poll')).position,50);
 reply={...reply,artist:'乙',position:0};assert.equal((await m.command('poll')).position,0);
 reply={available:false,error:'播放器未响应'};const failed=await m.command('toggle');assert.equal(failed.title,'测试歌曲');assert.equal(failed.error,'播放器未响应');
 assert.throws(()=>m.command({command:'lyrics-sync',seconds:NaN}),/无效/);
});
