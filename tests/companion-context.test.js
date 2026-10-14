'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Controller,modeFor}=require('../assets/pets/feimo-rive/scenes');
const {lifeLines}=require('../lib/ambient-companion');
const {normalize}=require('../lib/bubble-appearance');
test('coffee, water, sleepy prompts have distinct authored scenes',()=>{
 const afternoon=lifeLines(new Date(2026,9,13,13,30));assert.equal(afternoon.find(r=>r.text.includes('咖啡')).scene,'coffee');assert.equal(afternoon.find(r=>r.text.includes('好困')).scene,'sleepy');assert.equal(lifeLines(new Date(2026,9,13,7,30)).find(r=>r.text.includes('喝口水')).scene,'water');
 for(const scene of ['coffee','water','sleepy','farewell','music-spin'])assert.notEqual(modeFor(scene),0);
});
test('music turns occasionally, repeated playback updates do not reset it; voice interrupts',()=>{
 let now=0;const c=new Controller(()=>now,()=>0);c.set('musicPlaying');now=24900;assert.equal(c.value(),modeFor('music'));now=25100;assert.equal(c.value(),modeFor('music-spin'));c.set('musicPlaying');assert.equal(c.value(),modeFor('music-spin'));now=30000;assert.equal(c.value(),modeFor('music'));now=55100;assert.equal(c.value(),modeFor('music-spin'));c.set('voiceListening');assert.equal(c.value(),modeFor('typing'));
 const reduced=new Controller(()=>now,()=>0,{ambient:false});reduced.set('musicPlaying');now+=100000;assert.equal(reduced.value(),modeFor('music'));
});
test('appearance settings preserve transparent backgrounds independently from text',()=>{
 assert.deepEqual(normalize({backgroundOpacity:0,textOpacity:1,night:true,textColor:'#aBc123'}),{night:true,backgroundOpacity:0,textColor:'#aBc123'});assert.equal(normalize({textColor:'url(https://invalid)',textOpacity:Infinity}).textColor,null);assert.equal(normalize({textOpacity:.1}).textOpacity,undefined);assert.equal(normalize({backgroundOpacity:3}).backgroundOpacity,1);
});
test('spin projects headphones and notes with the head and returns all parts to the front',()=>{
 const noop=()=>'',spin=require('../scripts/feimo-music-spin.cjs')({id:n=>n,tag:noop,group:noop,rect:noop,ellipse:noop,line:noop,ink:'FF303B59',gold:'FFF1B964'}),tracks={};spin.animate((n,p,v)=>{(tracks[n]||={})[p]=v;});
 const at=(n,p,f)=>tracks[n][p].find(k=>k[0]===f)[1];
 for(const name of ['ear-front-1','ear-front--1','orbit-front-0','orbit-front-1'])for(const property of ['x','y'])assert.equal(at(name,property,0),at(name,property,240));
 assert.ok(at('ear-front-1','x',108)<-70);assert.ok(at('orbit-front-0','x',108)<-100);assert.equal(at('eyeL','opacity',108),0);assert.equal(at('eyeL','opacity',240),1);assert.equal(tracks.headphones.opacity,0);
 for(const frame of [0,54,108,156,240])assert.ok(Math.abs(at('ear-front-1','opacity',frame)+at('ear-back-1','opacity',frame)-1)<.001);
 assert.equal(at('trail-front-0-0-0','opacity',0),0);assert.equal(at('trail-front-0-0-0','opacity',240),0);
});
