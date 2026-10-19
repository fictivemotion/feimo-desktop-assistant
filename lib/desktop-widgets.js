'use strict';
const {randomUUID}=require('node:crypto'),path=require('node:path');
const {JsonStore}=require('./store');
const materials=require('./widget-materials'),layout=require('./widget-layout');
const TYPES={calendar:{title:'日历日程',width:520,height:560},todo:{title:'重要事项',width:370,height:510},files:{title:'文件库',width:420,height:510},notes:{title:'速记',width:370,height:480}};
const number=(value,min,max,fallback)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
function normalize(raw,base={}){
 const kind=raw.kind??base.kind;if(!Object.hasOwn(TYPES,kind))throw Error('不支持的桌面卡片');
 const value={...base,...raw},defaults=TYPES[kind],bounds=value.bounds||{};
 return {id:base.id||randomUUID(),kind,title:String(value.title??defaults.title).trim().slice(0,40)||defaults.title,visible:value.visible!==false,collapsed:!!value.collapsed,locked:!!value.locked,alwaysOnTop:!!value.alwaysOnTop,snap:value.snap!==false,opacity:number(value.opacity,0,1,.5),material:materials.MATERIALS.some(([id])=>id===value.material)?value.material:'transparent',materialIntensity:number(value.materialIntensity,0,1,.65),theme:['light','dark','auto'].includes(value.theme)?value.theme:'light',fontSize:Math.round(number(value.fontSize,12,20,14)),radius:Math.round(number(value.radius,0,48,32)),collapseBehavior:value.collapseBehavior==='smart'?'smart':'manual',collapseDelay:Math.round(number(value.collapseDelay,200,10000,1200)),capsuleWidthMode:value.capsuleWidthMode==='aligned'?'aligned':'independent',capsuleWidth:Math.round(number(value.capsuleWidth,220,500,260)),dockEnabled:value.dockEnabled!==false,dockSide:['left','right'].includes(value.dockSide)?value.dockSide:'',folderIconSize:Math.round(number(value.folderIconSize,32,200,140)),folderIconStyle:value.folderIconStyle==='compact'?'compact':'gallery',autoGroup:value.autoGroup!==false,groupId:typeof value.groupId==='string'?value.groupId.slice(0,80):'',groupAxis:value.groupAxis==='row'?'row':'column',calendarView:['month','week','day'].includes(value.calendarView)?value.calendarView:'month',days:[1,7,30,90].includes(value.days)?value.days:30,projectId:String(value.projectId||'').slice(0,100),bounds:{x:Math.round(number(bounds.x,-50000,50000,80)),y:Math.round(number(bounds.y,-50000,50000,120)),width:Math.round(number(bounds.width,320,1400,defaults.width)),height:Math.round(number(bounds.height,260,1600,defaults.height))}};
}
// A completed calendar occurrence is shared by all to-do cards, and stays
// separate from remote calendar sources and reminder delivery.
const occurrenceKey=item=>JSON.stringify([item.source,String(item.externalId),item.recurrenceInstanceId||'',item.startsAtUtc]);
function fitBounds(bounds,displays){
 const areas=displays.map(d=>d.workArea).filter(a=>a.width>0&&a.height>0);if(!areas.length)return bounds;
 const area=areas.reduce((best,a)=>{const overlap=r=>Math.max(0,Math.min(bounds.x+bounds.width,r.x+r.width)-Math.max(bounds.x,r.x))*Math.max(0,Math.min(bounds.y+bounds.height,r.y+r.height)-Math.max(bounds.y,r.y));return overlap(a)>overlap(best)?a:best;},areas[0]);
 const width=Math.min(bounds.width,area.width),height=Math.min(bounds.height,area.height);
 return {x:Math.round(Math.max(area.x,Math.min(bounds.x,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(bounds.y,area.y+area.height-height))),width,height};
}
function snapBounds(bounds,area,others=[],gap=12){
 const value={...bounds},distance=14,candidatesX=[area.x+gap,area.x+area.width-gap-bounds.width],candidatesY=[area.y+gap,area.y+area.height-gap-bounds.height];
 for(const r of others){if(bounds.y<r.y+r.height+gap&&bounds.y+bounds.height>r.y-gap)candidatesX.push(r.x+r.width+gap,r.x-gap-bounds.width);if(bounds.x<r.x+r.width+gap&&bounds.x+bounds.width>r.x-gap)candidatesY.push(r.y+r.height+gap,r.y-gap-bounds.height);}
 for(const r of others){if(Math.min(Math.abs(bounds.y-r.y-r.height-gap),Math.abs(bounds.y+bounds.height+gap-r.y))<=distance)candidatesX.push(r.x,r.x+r.width-bounds.width);if(Math.min(Math.abs(bounds.x-r.x-r.width-gap),Math.abs(bounds.x+bounds.width+gap-r.x))<=distance)candidatesY.push(r.y,r.y+r.height-bounds.height);}
 for(const [key,list]of [['x',candidatesX],['y',candidatesY]]){const nearest=list.sort((a,b)=>Math.abs(a-bounds[key])-Math.abs(b-bounds[key]))[0];if(Math.abs(nearest-bounds[key])<=distance)value[key]=nearest;}
 return value;
}
function placeBounds(bounds,area,others=[]){
 for(const [rawWidth,rawHeight]of [[bounds.width,bounds.height],[Math.min(bounds.width,360),Math.min(bounds.height,320)],[320,260]]){
  const width=Math.min(rawWidth,area.width-24),height=Math.min(rawHeight,area.height-24),xs=[area.x+12,...others.flatMap(r=>[r.x+r.width+12,r.x-width-12])],ys=[area.y+12,...others.flatMap(r=>[r.y+r.height+12,r.y-height-12])];
  for(const y of ys)for(const x of xs){if(x<area.x||y<area.y||x+width>area.x+area.width||y+height>area.y+area.height)continue;if(others.some(r=>x<r.x+r.width+8&&x+width+8>r.x&&y<r.y+r.height+8&&y+height+8>r.y))continue;return {x,y,width,height};}
 }
 return fitBounds(bounds,[{workArea:area}]);
}
class WidgetStore{
 constructor(file){this.store=new JsonStore(file,{widgets:[],completed:{},hidden:false});const widgets=[];for(const raw of this.store.get('widgets',[]).slice(0,16)){try{if(typeof raw.id!=='string'||widgets.some(w=>w.id===raw.id))continue;widgets.push(normalize({...raw,...(!this.store.get('layoutV2')&&raw.radius===20?{radius:32}:{})},{id:raw.id}));}catch{}}
  // Prefer the visible expanded card when migrating former per-card settings.
  const prior=widgets.find(w=>w.visible&&!w.collapsed)||widgets.find(w=>w.visible)||widgets[0];this.store.data.sharedRadius=Math.round(number(this.store.get('sharedRadius'),0,48,prior?.radius??32));for(const w of widgets)w.radius=this.store.data.sharedRadius;
  const selected=[];for(const kind of Object.keys(TYPES)){const candidates=widgets.filter(w=>w.kind===kind),chosen=candidates.find(w=>w.visible&&!w.collapsed)||candidates.find(w=>w.visible)||candidates[0];if(chosen)selected.push(chosen);}selected.sort((a,b)=>widgets.indexOf(a)-widgets.indexOf(b));widgets.splice(0,widgets.length,...selected);this.store.data.widgets=widgets;this.store.data.layoutV2=true;for(const w of widgets)if(w.groupId&&widgets.filter(v=>v.groupId===w.groupId).length<2)w.groupId='';if(!this.store.get('uniqueKindsV1')){this.store.data.uniqueKindsV1=true;this.store.save();}}
 view(){return {widgets:structuredClone(this.store.get('widgets',[])),hidden:!!this.store.get('hidden'),types:TYPES};}
 find(id){const item=this.store.get('widgets',[]).find(w=>w.id===id);if(!item)throw Error('桌面卡片不存在');return item;}
 commit(patch){const previous=structuredClone(this.store.data);const radius=Math.round(number(patch.sharedRadius,0,48,this.store.get('sharedRadius',32)));if(patch.widgets)patch={...patch,widgets:patch.widgets.map(w=>({...w,radius})),sharedRadius:radius};try{this.store.set(patch);}catch(error){this.store.data=previous;throw error;}}
 create(kind,bounds){const rows=this.view().widgets,existing=rows.find(w=>w.kind===kind);if(existing){existing.visible=true;this.commit({widgets:rows,hidden:false});return existing;}const value=normalize({kind,radius:this.store.get('sharedRadius',32),bounds:bounds||{x:80+(rows.length%4)*48,y:120+(rows.length%5)*38}});this.commit({widgets:[...rows,value],hidden:false});return value;}
 update(id,patch){if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('卡片设置无效');const old=this.find(id),item=normalize({...patch,kind:old.kind},old);this.batch(this.view().widgets.map(w=>w.id===id?item:w),patch.radius);return this.find(id);}
 batch(rows,radius){this.commit({widgets:rows.map(w=>normalize(w,{id:w.id,kind:w.kind})),sharedRadius:radius});}
 remove(id){this.find(id);const rows=this.view().widgets.filter(w=>w.id!==id);for(const w of rows)if(w.groupId&&rows.filter(v=>v.groupId===w.groupId).length<2)w.groupId='';this.commit({widgets:rows});}
 hideAll(hidden){this.commit({hidden:!!hidden});}
 done(item,value){const key=occurrenceKey(item),completed={...this.store.get('completed',{})};if(value)completed[key]=Date.now();else delete completed[key];const entries=Object.entries(completed).sort((a,b)=>b[1]-a[1]).slice(0,5000);this.commit({completed:Object.fromEntries(entries)});}
 isDone(item){return !!this.store.get('completed',{})[occurrenceKey(item)];}
}
class DesktopWidgets{
 constructor({electron,dir,actions={},managerAllowed=()=>false,onChange=()=>{}}){Object.assign(this,{electron,actions,managerAllowed,onChange});this.store=new WidgetStore(path.join(dir,'desktop-widgets.json'));this.windows=new Map();this.timers=new Map();this.stopped=false;this.nativeMaterials=materials.supported(process.platform,require('node:os').release());this.native=new(require('./widget-material-native').WidgetMaterialNative)(path.join(dir,'native-widgets'));this.screenChanged=()=>{this.reconcile();this.refreshMaterials();};this.materialTimer=null;this.activeId=null;this.dockDrag=null;}
 presentation(item){const w=this.windows.get(item.id);return {...item,nativeSupported:this.nativeMaterials,nativeMaterials:this.nativeMaterials&&!w?._materialFailed,avoiding:!!w?._avoidShift,dragging:this.dockDrag?.id===item.id,temporarilyHidden:!!w?._occluded,groupCount:item.groupId?this.store.view().widgets.filter(v=>v.groupId===item.groupId).length:0,effectiveMaterial:w?._material||'none'};}
 owns(sender){return [...this.windows.values()].some(w=>!w.isDestroyed()&&w.webContents===sender);}
 own(sender){const entry=[...this.windows].find(([,w])=>!w.isDestroyed()&&w.webContents===sender);if(!entry)throw Error('此窗口不能操作桌面卡片');return this.store.find(entry[0]);}
 authorizeManager(event){if(!this.managerAllowed(event.sender))throw Error('此窗口不能管理桌面卡片');}
 start(){const ipc=this.electron.ipcMain;
  ipc.handle('widgets:list',event=>{this.authorizeManager(event);return this.store.view();});
  ipc.handle('widgets:create',(event,kind)=>{this.authorizeManager(event);return this.create(kind);});
  ipc.handle('widgets:update',(event,{id,patch}={})=>{if(this.owns(event.sender)){if(this.own(event.sender).id!==id)throw Error('只能修改当前卡片');}else this.authorizeManager(event);return this.update(id,patch);});
  ipc.handle('widgets:remove',(event,id)=>{this.authorizeManager(event);this.clearTimer(id);this.store.remove(id);this.changed();return true;});
  ipc.handle('widgets:showAll',(event,on)=>{this.authorizeManager(event);this.showAll(on);return this.store.view();});
  ipc.handle('widgets:arrange',event=>{this.authorizeManager(event);return this.arrange();});
  ipc.handle('widgets:detach',event=>{const item=this.own(event.sender);this.detach(item.id);return true;});
  ipc.on?.('widgets:fileDrag',(event,ids)=>{if(!this.owns(event.sender)||this.own(event.sender).kind!=='files')return;try{this.actions.fileDrag(event.sender,ids);}catch(error){event.sender.send('widgets:layoutError',error.message);}});
  ipc.handle('widgets:moveDrag',(event,value)=>this.dragCard(this.own(event.sender).id,value));
  ipc.handle('widgets:dockDrag',(event,value)=>this.dragDock(this.own(event.sender).id,value));
  ipc.handle('widgets:state',event=>this.presentation(this.own(event.sender)));
  ipc.handle('widgets:call',async(event,{method,value}={})=>{const item=this.own(event.sender);const calendar=['calendarView','calendarAdd','calendarUpdate','calendarRemove','calendarCategorySave','calendarPlan','calendarPlanCancel'];const allowed=item.kind==='calendar'?calendar:item.kind==='todo'?['calendarView','todoDone','openSchedule']:item.kind==='files'?['files','fileOpen','openFiles','fileBrowse','fileLinkFolder','fileUnlink','fileManage','fileImportInto','fileCreate']:['notes','noteSave','noteDelete'];if(!allowed.includes(method))throw Error('此卡片不支持该操作');
   if(method==='todoDone'){const range=this.todoRange(item),data=await this.actions.calendarView(range);const target=data.items.find(row=>occurrenceKey(row)===value?.key);if(!target)throw Error('日程已改变，请刷新后重试');this.store.done(target,!!value.done);this.broadcast('widgets:dataChanged');return true;}
   if(method==='calendarView'){const result=await this.actions.calendarView(item.kind==='todo'?this.todoRange(item):value);return {...result,items:result.items.map(row=>({...row,completed:this.store.isDone(row),completionKey:occurrenceKey(row)}))};}
   if(!this.actions[method])throw Error('内容暂不可用');return this.actions[method](value);
  });
  for(const event of ['display-added','display-removed','display-metrics-changed'])this.electron.screen.on(event,this.screenChanged);this.electron.nativeTheme?.on('updated',this.screenChanged);this.electron.powerMonitor?.on('resume',this.screenChanged);this.electron.powerMonitor?.on('unlock-screen',this.screenChanged);this.materialTimer=setInterval(()=>this.refreshMaterials(),30000);this.materialTimer.unref?.();this.reconcile();
 }
 todoRange(item){const from=new Date();from.setHours(0,0,0,0);const to=new Date(from);to.setDate(to.getDate()+item.days);return {from:from.toISOString(),to:to.toISOString()};}
 create(kind){const defaults=normalize({kind}),area=(this.electron.screen.getPrimaryDisplay?.()||this.electron.screen.getAllDisplays()[0]).workArea,others=this.store.view().widgets.filter(w=>w.visible).map(w=>({...w.bounds,...layout.size(w)})),bounds=placeBounds(defaults.bounds,area,others),item=this.store.create(kind,bounds);this.changed();return item;}
 clearTimer(id){clearTimeout(this.timers.get(id));this.timers.delete(id);}
 flush(id){if(!this.timers.has(id))return;this.clearTimer(id);const win=this.windows.get(id);if(!win||win.isDestroyed())return;const item=this.store.find(id),actual=win.getBounds(),previous=win._layoutBounds||layout.size(item);if(JSON.stringify(actual)===JSON.stringify(previous))return;const bounds={...item.bounds,x:item.bounds.x+actual.x-previous.x,y:item.bounds.y+actual.y-previous.y,width:item.collapsed||actual.width===previous.width?item.bounds.width:actual.width,height:item.collapsed||actual.height===previous.height?item.bounds.height:actual.height};try{this.update(id,{bounds},false);}catch(error){this.reconcile();win.webContents.send('widgets:layoutError',error.message||'卡片布局未保存，请重试');}}
 update(id,patch,flush=true){if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('卡片设置无效');if(this.dockDrag)this.cancelDockDrag();if(flush)this.flush(id);const old=this.store.find(id),safe={...patch};delete safe.groupId;delete safe.groupAxis;delete safe.dockSide;if(safe.undock===true||safe.dockEnabled===false)safe.dockSide='';delete safe.undock;let item=normalize({...safe,kind:old.kind},old),rows=this.store.view().widgets.map(w=>w.id===id?item:w);
  if(old.groupId&&(safe.autoGroup===false||safe.locked===true||safe.visible===false)){for(const w of rows)if(w.id===id)w.groupId='';for(const w of rows)if(w.groupId===old.groupId&&rows.filter(v=>v.groupId===old.groupId).length<2)w.groupId='';item=rows.find(w=>w.id===id);}
  if(item.groupId&&safe.bounds){const members=rows.filter(w=>w.groupId===item.groupId),axis=item.groupAxis,first=members[0],area=this.electron.screen.getDisplayMatching(first.bounds).workArea;let anchor={...this.store.find(first.id).bounds};if(safe.bounds){anchor.x+=item.bounds.x-old.bounds.x;anchor.y+=item.bounds.y-old.bounds.y;}
   const placed=layout.groupLayout(members.map(w=>({...w,collapsed:true})),axis,area,anchor,!item.collapsed?item.bounds.width:first.bounds.width)?.map(w=>({...w,collapsed:members.find(v=>v.id===w.id).collapsed}));if(!placed)throw Error('组合空间不足，请先收起部分卡片或移出组合');rows=rows.map(w=>placed.find(v=>v.id===w.id)||w);
  }
  if(safe.collapsed===false)this.activeId=id;else if(safe.collapsed===true&&this.activeId===id)this.activeId=null;this.store.batch(rows,safe.radius);this.changed();return this.presentation(this.store.find(id));
 }
 dragCard(id,value={}){
  const item=this.store.find(id),w=this.windows.get(id),phase=value.phase;if(!['start','move','end','cancel'].includes(phase))throw Error('拖动状态无效');
  if(phase==='cancel'){this.cardDrag=null;this.reconcile();return true;}
  if(phase==='start'){if(item.locked||!w||item.dockSide&&item.collapsed)return false;this.flush(id);this.cardDrag={id,bounds:w.getBounds(),item:structuredClone(this.store.find(id)),key:JSON.stringify(this.store.view().widgets)};return true;}
  const drag=this.cardDrag;if(!drag||drag.id!==id)return false;if(drag.key!==JSON.stringify(this.store.view().widgets)){this.cardDrag=null;this.reconcile();return false;}
  if(!Number.isFinite(value.dx)||!Number.isFinite(value.dy)||Math.abs(value.dx)>50000||Math.abs(value.dy)>50000)throw Error('拖动位置无效');
  const bounds={...drag.bounds,x:Math.round(drag.bounds.x+value.dx),y:Math.round(drag.bounds.y+value.dy)};
  if(phase==='move'){w._applying=true;w.setBounds(bounds,false);w._applying=false;return true;}
  this.cardDrag=null;if(Math.hypot(value.dx,value.dy)<6){this.reconcile();return true;}
  if(this.tryDock(id,bounds))return true;
  if(!item.groupId&&this.tryJoin(id,bounds))return true;
  this.update(id,{undock:true,bounds:{...drag.item.bounds,x:bounds.x,y:bounds.y}},false);return true;
 }
 detach(id){const item=this.store.find(id),rows=this.store.view().widgets;for(const w of rows)if(w.id===id)w.groupId='';for(const w of rows)if(w.groupId===item.groupId&&rows.filter(v=>v.groupId===item.groupId).length<2)w.groupId='';this.store.batch(rows);this.changed();}
 tryDock(id,bounds){const item=this.store.find(id);if(!item.dockEnabled||item.locked)return false;const area=this.electron.screen.getDisplayMatching(bounds).workArea,side=bounds.x<=area.x+32?'left':bounds.x+bounds.width>=area.x+area.width-32?'right':'';if(!side)return false;
  const rows=this.store.view().widgets;for(const w of rows)if(w.id===id)w.groupId='';for(const w of rows)if(w.groupId&&rows.filter(v=>v.groupId===w.groupId).length<2)w.groupId='';const next=rows.find(w=>w.id===id);Object.assign(next,{dockSide:side,collapsed:true,bounds:{...item.bounds,x:side==='left'?area.x:area.x+area.width-item.bounds.width,y:Math.max(area.y,Math.min(bounds.y,area.y+area.height-52))}});
  const neighbours=rows.filter(w=>w.id!==id&&w.dockSide===side&&w.collapsed&&w.visible);for(const w of neighbours){const r=this.windows.get(w.id)?.getBounds()||layout.size(w);for(const y of [r.y-60,r.y+60])if(Math.abs(y-next.bounds.y)<=20)next.bounds.y=Math.max(area.y,Math.min(y,area.y+area.height-52));}
  this.clearTimer(id);this.store.batch(rows);this.activeId=null;this.changed();return true;
 }
 cancelDockDrag(){if(!this.dockDrag)return;this.dockDrag=null;if(!this.stopped)this.reconcile();}
 dragDock(id,value={}){
  const item=this.store.find(id),phase=value?.phase;if(!['start','move','end','cancel'].includes(phase))throw Error('拖动状态无效');
  if(phase==='cancel'){if(this.dockDrag?.id===id)this.cancelDockDrag();return true;}
  if(phase==='start'){
   this.cancelDockDrag();if(!item.visible||!item.collapsed||!item.dockSide||item.locked)return false;
   this.flush(id);const bounds=this.windows.get(id)?.getBounds()||layout.size(item),area=layout.areaFor(item.bounds,this.electron.screen.getAllDisplays());
   this.dockDrag={id,original:this.store.view().widgets,originalKey:JSON.stringify(this.store.view().widgets),bounds,area,preview:null,moved:false,dx:0,dy:0,undock:false};return true;
  }
  const drag=this.dockDrag;if(!drag||drag.id!==id)return false;
  if(!Number.isFinite(value.dx)||!Number.isFinite(value.dy)||Math.abs(value.dx)>50000||Math.abs(value.dy)>50000)throw Error('拖动位置无效');
  drag.dx=value.dx;drag.dy=value.dy;drag.moved=Math.hypot(drag.dx,drag.dy)>=6;
  drag.undock=(item.dockSide==='left'?drag.dx:-drag.dx)>32&&Math.abs(drag.dx)>Math.abs(drag.dy)*.55;
  drag.preview=drag.moved&&!drag.undock?layout.reorderDock(drag.original,id,drag.bounds.y+drag.dy,this.electron.screen.getAllDisplays()):null;
  if(phase==='move'){this.reconcile();return true;}
  this.dockDrag=null;
  try{
   if(drag.moved&&drag.undock){const width=item.capsuleWidthMode==='aligned'?item.bounds.width:item.capsuleWidth;this.update(id,{undock:true,bounds:{...item.bounds,x:Math.round(drag.bounds.x+drag.dx-(item.dockSide==='right'?width-drag.bounds.width:0)),y:Math.round(drag.bounds.y+drag.dy)}},false);}
   else if(drag.moved&&drag.preview){this.store.batch(drag.preview);this.changed();}else this.reconcile();return true;
  }catch(error){this.reconcile();throw error;}
 }
 refreshMaterials(id){if(this.stopped)return;for(const [key,w]of this.windows){if(w.isDestroyed()||id&&id!==key)continue;const item=this.store.find(key);w._themeKey=null;this.applyMaterial(w,item);}}
 applyMaterial(w,item){
  const tab=!!item.dockSide&&item.collapsed,radius=tab?0:item.radius,native=tab?'none':materials.native(item.material,item.opacity,this.nativeMaterials),dark=item.theme==='dark'||item.theme==='auto'&&this.electron.nativeTheme?.shouldUseDarkColors,key=[native,!!dark,radius,item.opacity,item.materialIntensity,w.getBounds().width,w.getBounds().height].join(':');
  if(w._themeKey===key)return;w._themeKey=key;const request=(w._nativeRequest||0)+1;w._nativeRequest=request;
  // BackgroundMaterial on creation initializes Electron's translucent output.
  // Subsequent appearance changes use clipped Composition brushes exclusively.
  if(!this.nativeMaterials){w._material='none';w._chromeReady=true;return;}
  if(typeof w.getNativeWindowHandle!=='function')return;w._chromeReady=false;
  void this.native.apply(w,dark,radius,native).then(ok=>{if(this.stopped||w.isDestroyed()||w._nativeRequest!==request)return;w._chromeReady=true;w._materialFailed=!ok&&native!=='none';w._material=ok?native:'none';w.webContents.send('widgets:changed',this.presentation(this.store.find(item.id)));if(w._loaded&&!this.store.view().hidden&&!w._occluded&&!w.isVisible())w.showInactive();});
 }
 tryJoin(id,bounds){const item=this.store.find(id);if(!item.autoGroup||!item.snap||item.locked||item.groupId||item.dockSide)return false;const rows=this.store.view().widgets,others=rows.filter(w=>w.id!==id&&w.visible&&!w.locked&&!w.dockSide&&w.snap&&w.autoGroup),candidate=layout.joinCandidate(bounds,others);if(!candidate)return false;
  const target=candidate.item,axis=target.groupId?target.groupAxis:candidate.axis;if(axis!==candidate.axis)return false;const members=target.groupId?rows.filter(w=>w.groupId===target.groupId):[target],newItem={...item,bounds:{...bounds,width:item.collapsed?item.bounds.width:bounds.width,height:item.collapsed?item.bounds.height:bounds.height}},index=members.findIndex(w=>w.id===target.id);members.splice(index+(candidate.before?0:1),0,newItem);
  const area=this.electron.screen.getDisplayMatching(target.bounds).workArea,placed=layout.groupLayout(members,axis,area,members[0].id===id?bounds:members[0].bounds,target.bounds.width);if(!placed)return false;const groupId=target.groupId||randomUUID();for(const w of placed){w.groupId=groupId;w.groupAxis=axis;}this.clearTimer(id);const ordered=rows.filter(w=>!placed.some(v=>v.id===w.id));ordered.push(...placed);this.store.batch(ordered);this.changed();return true;
 }
 arrange(){for(const id of [...this.timers.keys()])this.flush(id);let rows=this.store.view().widgets;const displays=this.electron.screen.getAllDisplays();for(const display of displays){const area=display.workArea,members=rows.filter(w=>w.visible&&!w.locked&&this.electron.screen.getDisplayMatching(w.bounds).workArea.x===area.x&&this.electron.screen.getDisplayMatching(w.bounds).workArea.y===area.y);if(!members.length)continue;const columns=Math.min(members.length,Math.max(1,Math.floor((area.width-16)/(320+8)))),width=Math.floor((area.width-24-8*(columns-1))/columns),rowCount=Math.ceil(members.length/columns),height=Math.floor((area.height-24-8*(rowCount-1))/rowCount);if(width<320||height<260)throw Error('桌面空间不足，请收起或隐藏部分卡片后再排列');const placed=[];for(let i=0;i<members.length;i++){const w=members[i],col=i%columns,row=Math.floor(i/columns),bounds={x:area.x+12+col*(width+8),y:area.y+12+row*(height+8),width,height:w.collapsed?w.bounds.height:height};if(rows.some(v=>v.visible&&v.locked&&bounds.x<v.bounds.x+v.bounds.width&&bounds.x+width>v.bounds.x&&bounds.y<v.bounds.y+layout.size(v).height&&bounds.y+(w.collapsed?52:height)>v.bounds.y))throw Error('锁定卡片占用排列区域，请先移动或解锁');placed.push({...w,bounds,groupId:'',groupAxis:'row'});}for(let row=0;row<rowCount;row++){const group=placed.filter((_,i)=>Math.floor(i/columns)===row);if(group.length>1){const groupId=randomUUID();for(const w of group)w.groupId=groupId;}}rows=rows.map(w=>placed.find(v=>v.id===w.id)||w);}
  this.store.batch(rows);this.changed();return this.store.view();
 }
 remember(id){this.clearTimer(id);const timer=setTimeout(()=>{this.flush(id);this.onChange(this.store.view());},250);this.timers.set(id,timer);timer.unref?.();}
 changed(){this.reconcile();this.onChange(this.store.view());}
 showAll(on=true){this.store.hideAll(!on);this.changed();}
 broadcast(channel,data){if(!['calendar:changed','calendar:plannerProgress','toolbox:changed','files:changed','widgets:dataChanged'].includes(channel))return;for(const [id,w]of this.windows){if(w.isDestroyed())continue;const kind=this.store.find(id).kind;if(channel.startsWith('calendar:')&&!['calendar','todo'].includes(kind)||channel==='toolbox:changed'&&kind!=='notes'||channel==='files:changed'&&kind!=='files')continue;w.webContents.send(channel,channel==='toolbox:changed'?undefined:data);}}
 reconcile(){if(this.stopped)return;const state=this.store.view();if(this.dockDrag&&this.dockDrag.originalKey!==JSON.stringify(state.widgets))this.dockDrag=null;const widgets=this.dockDrag?.preview||state.widgets,hidden=state.hidden,positions=layout.avoid(widgets,this.electron.screen.getAllDisplays(),this.activeId);for(const [id,w]of this.windows)if(!widgets.some(i=>i.id===id&&i.visible)){this.clearTimer(id);this.windows.delete(id);if(!w.isDestroyed())w.destroy();}
  for(const item of widgets){if(!item.visible)continue;let w=this.windows.get(item.id);if(!w){if(hidden)continue;w=this.createWindow(item);this.windows.set(item.id,w);}if(w.isDestroyed())continue;const position=positions.get(item.id)||{bounds:fitBounds(layout.size(item),this.electron.screen.getAllDisplays())},bounds={...position.bounds};if(this.dockDrag?.id===item.id&&this.dockDrag.moved){const drag=this.dockDrag,area=drag.area;bounds.x=drag.undock?Math.round(Math.max(area.x,Math.min(drag.bounds.x+drag.dx,area.x+area.width-bounds.width))):bounds.x;bounds.y=Math.round(Math.max(area.y,Math.min(drag.bounds.y+drag.dy,area.y+area.height-bounds.height)));}w._avoidShift=position.shifted;w._occluded=position.occluded;
   w._applying=true;w.setResizable(!item.locked&&!item.collapsed);w.setMovable(!item.locked);w.setMinimumSize(Math.min(item.collapsed?(item.dockSide?layout.DOCK_WIDTH:220):320,bounds.width),Math.min(item.collapsed?52:260,bounds.height));w._layoutBounds={...bounds};if(JSON.stringify(w.getBounds())!==JSON.stringify(bounds))w.setBounds(bounds);w._layoutBounds=w.getBounds();w.setAlwaysOnTop(item.alwaysOnTop,'floating');this.applyMaterial(w,item);
   w._applying=false;w.webContents.send('widgets:changed',this.presentation(item));if(hidden||w._occluded)w.hide();else if(w._loaded&&w._chromeReady!==false&&!w.isVisible())w.showInactive();
  }
 }
 createWindow(item){const {BrowserWindow}=this.electron,w=new BrowserWindow({...fitBounds(item.bounds,this.electron.screen.getAllDisplays()),show:false,frame:false,thickFrame:false,transparent:!this.nativeMaterials,...(this.nativeMaterials?{backgroundMaterial:'acrylic'}:{}),backgroundColor:'#00000000',hasShadow:false,skipTaskbar:true,minimizable:false,maximizable:false,webPreferences:{partition:'persist:feimo-desktop-widgets',preload:path.join(__dirname,'../preload/desktop-widget-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:true}});
  w.setMenu(null);w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',event=>event.preventDefault());w.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  for(const event of ['focus','blur','restore'])w.on(event,()=>{clearTimeout(w._materialTimer);w._materialTimer=setTimeout(()=>this.refreshMaterials(item.id),150);w._materialTimer.unref?.();});
  w.on('will-move',(event,bounds)=>{if(this.store.find(item.id).locked){event.preventDefault();return;}w._userMoving=true;w._userMoveBounds=bounds;});
  const moved=()=>{if(this.cardDrag?.id===item.id||w._applying||this.stopped||JSON.stringify(w.getBounds())===JSON.stringify(w._layoutBounds))return;const current=this.store.find(item.id);try{const movedBounds=w._userMoveBounds||w.getBounds();w._userMoving=false;w._userMoveBounds=null;if(this.tryDock(item.id,movedBounds))return;if(!current.groupId&&this.tryJoin(item.id,w.getBounds()))return;}catch(error){this.reconcile();w.webContents.send('widgets:layoutError',error.message||'组合未保存，请重试');return;}if(current.dockSide){const actual=w.getBounds();this.update(item.id,{undock:true,bounds:{...current.bounds,x:actual.x,y:actual.y}},false);return;}if(current.snap&&!current.groupId&&!current.locked){const bounds=w.getBounds(),area=this.electron.screen.getDisplayMatching(bounds).workArea,others=[...this.windows].filter(([id])=>id!==item.id).map(([,win])=>win.getBounds()),next=fitBounds(snapBounds(bounds,area,others),this.electron.screen.getAllDisplays());if(next.x!==bounds.x||next.y!==bounds.y){w._applying=true;w.setBounds(next);w._applying=false;}}this.remember(item.id);};
  w.on('moved',moved);w.on('resized',()=>{if(!w._applying&&!this.stopped&&JSON.stringify(w.getBounds())!==JSON.stringify(w._layoutBounds))this.remember(item.id);});w.on('close',event=>{if(this.stopped)return;event.preventDefault();this.flush(item.id);this.update(item.id,{visible:false});});w.on('closed',()=>{this.native.remove?.(w);this.windows.delete(item.id);this.clearTimer(item.id);clearTimeout(w._materialTimer);});
  w.webContents.on('did-finish-load',()=>{w._loaded=true;if(!this.stopped){this.reconcile();w.webContents.send('widgets:changed',this.presentation(this.store.find(item.id)));}});
  let failures=0;w.webContents.on('render-process-gone',()=>{if(!this.stopped&&++failures<=3)setTimeout(()=>{if(!w.isDestroyed())void w.loadFile(path.join(__dirname,'../renderer/desktop/widget.html'));},1000).unref?.();});
  void w.loadFile(path.join(__dirname,'../renderer/desktop/widget.html'));return w;
 }
 stop(){this.cancelDockDrag();clearInterval(this.materialTimer);for(const w of this.windows.values())clearTimeout(w._materialTimer);for(const id of this.timers.keys())this.flush(id);this.stopped=true;this.native.stop();for(const event of ['display-added','display-removed','display-metrics-changed'])this.electron.screen.removeListener(event,this.screenChanged);this.electron.nativeTheme?.removeListener('updated',this.screenChanged);this.electron.powerMonitor?.removeListener('resume',this.screenChanged);this.electron.powerMonitor?.removeListener('unlock-screen',this.screenChanged);for(const w of this.windows.values())if(!w.isDestroyed())w.destroy();this.windows.clear();}
}
module.exports={DesktopWidgets,WidgetStore,TYPES,normalize,fitBounds,snapBounds,placeBounds,occurrenceKey};
