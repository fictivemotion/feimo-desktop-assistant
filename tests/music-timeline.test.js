'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {lineAt,position,clock}=require('../renderer/island/music-timeline');
test('lyrics jump directly across distant forward and backward seeks',()=>{
 const rows=Array.from({length:500},(_,i)=>({time:i*4,text:'line '+i}));
 assert.equal(lineAt(rows,1500),'line 375');
 assert.equal(lineAt(rows,9),'line 2');
 assert.equal(lineAt(rows,1999),'line 499');
 assert.equal(lineAt([{time:2,text:'a'},{time:2,text:'b'}],2),'b');
 assert.equal(lineAt(rows,-1),'');assert.equal(lineAt([],0),'');
});
test('paused clocks stay fixed and playing clocks clamp to song duration',()=>{
 assert.equal(position({position:12,playing:false,sampledAt:1000,duration:90},8000),12);
 assert.equal(position({position:12,playing:true,sampledAt:1000,duration:90},8000),19);
 assert.equal(position({position:12,playing:true,sampledAt:1000,duration:15},8000),15);
 assert.equal(clock(125.8),'2:05');
});
