'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Visibility}=require('../lib/island-visibility');
test('manual capsule hiding survives every activity poll and requires a new edge entry to reveal',()=>{const v=new Visibility();assert.equal(v.update({active:true,edge:true}),false);v.hide();for(let i=0;i<30;i++)assert.equal(v.update({active:true,edge:true}),true);assert.equal(v.update({active:true,edge:false}),true);assert.equal(v.update({active:true,edge:true}),false);});
test('idle capsule collapses immediately on leave; reading cards and busy modes remain visible',()=>{const v=new Visibility();assert.equal(v.update({hover:true}),false);assert.equal(v.update({hover:false}),true);assert.equal(v.update({card:true}),false);assert.equal(v.update({expanded:true}),false);assert.equal(v.update({active:true}),false);v.hide();assert.equal(v.update({expanded:false,active:true,card:true}),true);v.reveal();assert.equal(v.update({active:true}),false);});

test('manual hide ignores stale hover reveals and the edge reached by an upward swipe',()=>{const v=new Visibility();v.update({active:true,edge:false});v.hide();assert.equal(v.reveal(false),false);for(let i=0;i<20;i++)assert.equal(v.update({active:true,edge:true,hover:true,card:true}),true);assert.equal(v.update({active:true,edge:false}),true);assert.equal(v.update({active:true,edge:true}),false);v.hide();assert.equal(v.reveal(true),true);assert.equal(v.update({active:true,edge:true}),false);});

test('a delayed workbench collapse cannot override a manually hidden capsule',()=>{const {IslandHost}=require('../lib/island-host');let polls=0;const host={expanded:false,activity:()=>polls++,visibility:new Visibility()};host.visibility.hide();IslandHost.prototype.expand.call(host,false);assert.equal(host.visibility.manual,true);assert.equal(host.visibility.idle,true);assert.equal(polls,1);});
test('leaving the pill cannot hide a visible notice or reply before reaching its controls',()=>{
 const {IslandHost}=require('../lib/island-host');let hidden=0;const h={expanded:false,reply:null,notices:[{at:Date.now()}],visibility:new Visibility(),persistent:()=>false,hide:()=>hidden++,hasCards:IslandHost.prototype.hasCards};
 IslandHost.prototype.leave.call(h);assert.equal(hidden,0);
 h.notices=[];h.reply={id:'test',pages:['回答']};IslandHost.prototype.leave.call(h);assert.equal(hidden,0);
 h.reply=null;h.notices=[{at:Date.now()-61000}];IslandHost.prototype.leave.call(h);assert.equal(hidden,1);
 h.notices=[];IslandHost.prototype.leave.call(h);assert.equal(hidden,2);
});
