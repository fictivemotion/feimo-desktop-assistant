'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {WidgetStore}=require('../lib/desktop-widgets'),{geometryFor}=require('../lib/widget-composition');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-radius-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'widgets.json');}
test('radius edits apply atomically to hidden, docked and expanded cards and survive stale layout batches and restart',t=>{
 const file=fixture(t),store=new WidgetStore(file),cards=['calendar','todo','files','notes'].map(kind=>store.create(kind));store.update(cards[1].id,{visible:false});store.update(cards[2].id,{collapsed:true,dockSide:'right'});const stale=store.view().widgets;
 store.update(cards[2].id,{radius:48});assert.ok(store.view().widgets.every(w=>w.radius===48));store.batch(stale);assert.ok(store.view().widgets.every(w=>w.radius===48));assert.equal(store.create('notes').radius,48);
 const restarted=new WidgetStore(file);assert.deepEqual(restarted.view(),store.view());restarted.update(cards[0].id,{radius:0});assert.ok(restarted.view().widgets.every(w=>w.radius===0));assert.equal(new WidgetStore(file).create('files').radius,0);
});
test('radius migration prefers a visible expanded card and saved shared radius takes precedence',t=>{
 const file=fixture(t);fs.writeFileSync(file,JSON.stringify({layoutV2:true,widgets:[{id:'a',kind:'todo',radius:12,collapsed:true},{id:'b',kind:'notes',radius:48},{id:'c',kind:'files',radius:24,visible:false}]}));const store=new WidgetStore(file);assert.ok(store.view().widgets.every(w=>w.radius===48));store.update('c',{radius:22});assert.equal(store.store.get('sharedRadius'),22);assert.ok(new WidgetStore(file).view().widgets.every(w=>w.radius===22));
});
test('failed radius persistence restores the shared preference and every card, and malformed edits cannot reset it',t=>{
 const file=fixture(t),store=new WidgetStore(file),a=store.create('notes');store.create('calendar');store.update(a.id,{radius:40});const before=store.view(),save=store.store.save;store.store.save=()=>{throw Error('Disk full');};assert.throws(()=>store.update(a.id,{radius:2}),/Disk full/);assert.deepEqual(store.view(),before);assert.equal(store.store.get('sharedRadius'),40);store.store.save=save;for(const radius of [null,'2',NaN,Infinity])store.update(a.id,{radius});assert.ok(store.view().widgets.every(w=>w.radius===40));
});
test('native brush geometry matches CSS radii across DPI and clamps capsule curves to half height',()=>{
 for(const dpi of [96,120,144,192])for(const radius of [0,8,24,48]){const scale=dpi/96;assert.equal(geometryFor(800*scale,600*scale,dpi,radius).radius,radius*scale);assert.equal(geometryFor(260*scale,52*scale,dpi,radius).radius,Math.min(radius,26)*scale);}
});
