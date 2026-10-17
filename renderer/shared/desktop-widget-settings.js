'use strict';
(()=>{
 const names={calendar:'日历日程',todo:'重要级待办',files:'文件库',notes:'速记列表'},icons={calendar:'CalendarDays',todo:'ClipboardText',files:'Folder',notes:'NoteText'};
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 function button(text,fn){const b=el('button',text,'dw-button');b.type='button';b.onclick=fn;return b;}
 function controls(item,save){const form=el('div',undefined,'dw-form');
  const field=(title,input)=>{const label=el('label',undefined,'dw-field');label.append(el('span',title),input);form.append(label);input.setAttribute('aria-label',title);return input;};
  const text=field('卡片名称',el('input'));text.value=item.title;text.maxLength=40;text.onchange=()=>save({title:text.value});
  const material=el('select');for(const [id,name]of FeimoWidgetMaterials.MATERIALS)material.append(new Option(name,id));material.value=item.material||'transparent';material.onchange=()=>save({material:material.value,...(material.value==='solid'?{opacity:1}:{})});field('卡片材质',material);
  const range=(title,key,min,max,step)=>{const row=el('div',undefined,'dw-range'),input=el('input'),output=el('output');input.type='range';Object.assign(input,{min,max,step,value:item[key]});const paint=()=>output.textContent=['opacity','materialIntensity'].includes(key)?Math.round(input.value*100)+'%':input.value+' px';input.oninput=paint;input.onchange=()=>save({[key]:Number(input.value)});row.append(input,output);field(title,row);input.setAttribute('aria-label',title);paint();};
  range('背景不透明度','opacity',0,1,.05);if(!['transparent','solid',undefined].includes(item.material))range('材质浓度','materialIntensity',0,1,.05);range('文字大小','fontSize',12,20,1);range('卡片圆角','radius',0,48,2);
  const theme=el('select');for(const [id,name]of [['light','浅色卡片 · 深色文字'],['dark','深色卡片 · 浅色文字'],['auto','跟随系统明暗']])theme.append(new Option(name,id));theme.value=item.theme;theme.onchange=()=>save({theme:theme.value});field('明暗主题',theme);
  for(const [key,title]of [['alwaysOnTop','始终置顶'],['locked','锁定位置与大小'],['snap','吸附屏幕与相邻卡片'],['autoGroup','贴近卡片时自动组合']]){const label=el('label',undefined,'dw-check'),input=el('input');input.type='checkbox';input.checked=item[key];input.onchange=()=>save({[key]:input.checked});label.append(input,el('span',title));form.append(label);}
  const choice=(title,key,values)=>{const input=el('select');for(const [id,name]of values)input.append(new Option(name,id));input.value=item[key];input.onchange=()=>save({[key]:input.value});field(title,input);};
  choice('胶囊收起方式','collapseBehavior',[['manual','手动收起与展开'],['smart','离开自动收起 · 悬停展开']]);
  choice('胶囊宽度','capsuleWidthMode',[['independent','独立紧凑宽度'],['aligned','与展开卡片同宽']]);
  if(item.capsuleWidthMode!=='aligned')range('紧凑胶囊宽度','capsuleWidth',220,500,10);
  if(item.collapseBehavior==='smart'){const delay=el('select');for(const [n,label]of [[200,'0.2 秒'],[600,'0.6 秒'],[1200,'1.2 秒'],[3000,'3 秒'],[5000,'5 秒'],[10000,'10 秒']])delay.append(new Option(label,n));delay.value=item.collapseDelay||1200;delay.onchange=()=>save({collapseDelay:+delay.value});field('离开后多久收起',delay);}
  if(item.groupId)form.append(el('p','已组合 '+(item.groupCount||'多')+' 张卡片 · 移动和宽度自动联动。组合中的胶囊保持同宽。','dw-material-hint'));
  if(item.kind==='todo'){const days=el('select');for(const [id,name]of [[1,'今天'],[7,'未来 7 天'],[30,'未来 30 天'],[90,'未来 90 天']])days.append(new Option(name,id));days.value=item.days;days.onchange=()=>save({days:Number(days.value)});field('待办显示范围',days);}
  const hint=el('p',item.nativeMaterials===false?'当前系统使用兼容着色外观；原生云母与亚克力需要 Windows 11 22H2 或以上。':'云母取景于壁纸；亚克力呈现磨砂效果。背景透明度与材质浓度可独立调整。','dw-material-hint');form.append(hint);
  return form;
 }
 function mount(root,{api=window.api}={}){let disposed=false,state={widgets:[],hidden:false},generation=0;const heading=el('p','把常看的内容放在桌面。可创建多张卡片，独立调整透明度、位置与大小。','hint'),create=el('div',undefined,'dw-create-grid'),actions=el('div',undefined,'dw-manager-actions'),list=el('div',undefined,'dw-manager-list'),status=el('p',undefined,'dw-status');status.setAttribute('role','status');root.replaceChildren(heading,create,actions,list,status);
  const run=async fn=>{try{status.textContent='';await fn();}catch(error){status.textContent=error.message||String(error);}};
  for(const [kind,name]of Object.entries(names)){const b=button(name,()=>run(async()=>{await api.desktopWidgetCreate(kind);await refresh(true);}));b.prepend(ReiconFilled.create(icons[kind],22));b.setAttribute('aria-label','创建'+name+'桌面卡片');create.append(b);}
  actions.append(button('自动对齐与组合',()=>run(async()=>{await api.desktopWidgetsArrange();await refresh(true);})),button('显示卡片',()=>run(async()=>{await api.desktopWidgetsShowAll(true);await refresh(true);})),button('隐藏全部',()=>run(async()=>{await api.desktopWidgetsShowAll(false);await refresh(true);})));
  function render(force=false){if(disposed||!force&&root.contains(document.activeElement)&&document.activeElement.matches('input,select'))return;const opened=new Set([...list.querySelectorAll('details[open]')].map(n=>n.dataset.id));list.replaceChildren();if(!state.widgets.length)list.append(el('p','还没有桌面卡片，点击上方类型即可创建。','dw-empty'));
   for(const item of state.widgets){const details=el('details',undefined,'dw-entry');details.dataset.id=item.id;details.open=opened.has(item.id);const summary=el('summary'),copy=el('span');copy.append(el('strong',item.title),el('small',names[item.kind]+' · '+(item.visible&&!state.hidden?'已显示':'已隐藏')+(item.locked?' · 已锁定':'')));summary.append(ReiconFilled.create(icons[item.kind],20),copy);details.append(summary);
    const content=el('div',undefined,'dw-entry-body'),buttons=el('div',undefined,'dw-manager-actions');const save=patch=>run(async()=>{await api.desktopWidgetUpdate(item.id,patch);await refresh();});content.append(controls(item,save));buttons.append(button(item.visible?'隐藏':'显示',()=>save({visible:!item.visible})),button(item.collapsed?'展开':'收起',()=>save({collapsed:!item.collapsed})),button('移回主屏',()=>save({bounds:{...item.bounds,x:80,y:120}})),button('移除卡片',()=>run(async()=>{if(!confirm('只移除此桌面卡片，日程、文件和速记内容会保留。'))return;await api.desktopWidgetRemove(item.id);await refresh(true);})));content.append(buttons);details.append(content);list.append(details);
   }
  }
  async function refresh(force=false){const id=++generation;const next=await api.desktopWidgets();if(!disposed&&id===generation){state=next;render(force);}}
  root.addEventListener('focusout',()=>setTimeout(()=>render(),0));const unsubscribe=api.onDesktopWidgetsChanged?.(next=>{state=next;render();});void run(()=>refresh());return {destroy(){disposed=true;unsubscribe?.();}};
 }
 window.FeimoDesktopSettings={mount,controls,names,icons};
})();
