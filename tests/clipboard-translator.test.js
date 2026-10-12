'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ClipboardTranslator}=require('../lib/clipboard-translator');
test('translation ignores existing text and its own output, latest copy wins, exit aborts pending writes',async t=>{
 let clipboard='original',calls=0;const notices=[],jobs=[];
 const translator=new ClipboardTranslator({read:async()=>clipboard,write:async value=>{clipboard=value;},notice:text=>notices.push(text),translate:(text,signal)=>{calls++;return new Promise(resolve=>jobs.push({text,signal,resolve}));}});t.after(()=>translator.dispose());
 await translator.start();clearInterval(translator.timer);await translator.poll();assert.equal(calls,0);
 clipboard='first';const first=translator.poll();await new Promise(setImmediate);
 clipboard='second';const second=translator.poll();await new Promise(setImmediate);assert.equal(jobs[0].signal.aborted,true);
 jobs[0].resolve('old result');await first;assert.equal(clipboard,'second');jobs[1].resolve('译文');await second;assert.equal(clipboard,'译文');await translator.poll();assert.equal(calls,2);
 clipboard='third';const third=translator.poll();await new Promise(setImmediate);translator.stop();jobs[2].resolve('too late');await third;assert.equal(clipboard,'third');assert.equal(translator.state().enabled,false);assert.match(notices.at(-1),/下班/);
});
test('a copy after the last poll is preserved when an older translation completes',async t=>{
 let clipboard='before',resolve;const translator=new ClipboardTranslator({read:async()=>clipboard,write:async v=>{clipboard=v;},notice:()=>{},translate:()=>new Promise(r=>resolve=r)});t.after(()=>translator.dispose());await translator.start();clearInterval(translator.timer);clipboard='source';const job=translator.poll();await new Promise(setImmediate);clipboard='newer';resolve('output');await job;assert.equal(clipboard,'newer');
});
