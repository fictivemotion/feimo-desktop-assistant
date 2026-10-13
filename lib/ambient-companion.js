'use strict';
const {JsonStore}=require('./store');
const FREQUENCIES={frequent:[10,15],normal:[15,25],quiet:[30,45]};
const PERIODS=[
 {from:0,to:1,lines:['夜猫子时刻🐱','夜深啦，记得给自己留点睡眠💤']},
 {from:7,to:9,lines:['早上好，今天也一起慢慢来☀️','先喝口水，再开启新的一天💧']},
 {from:9,to:11,lines:['上午吃点啥好呢🤔','一日之计在于晨☀️','阳光到位，今天也慢慢来🌤️']},
 {from:11,to:13,lines:['干饭时间到🥣','今天吃什么呢🤔','先填饱肚子，再继续加油🍚']},
 {from:13,to:14,scene:'sleeping',lines:['让我小睡一会😴','午休一下，充充电💤']},
 {from:13,to:15,lines:['好困喔🥱','我得来杯咖啡提提神☕️','午后慢一点也没关系🌤️']},
 {from:15,to:18,lines:['喝口水，伸个懒腰吧💧','盯屏幕久了，看看远处🌿','下午茶时间，要不要歇一会🍪','肩膀放松一点，我陪你慢慢来🌱']},
 {from:18,to:20,lines:['晚饭想好吃什么了吗🍜','给今天的自己补充一点能量🍲','今天也辛苦啦，歇一小会吧🌇']},
 {from:20,to:24,lines:['今天又前进了一小步✨','晚上也记得让眼睛休息一下🌙','事情一件件做就好，我在呢🖤']},
];
function shortcut(value,fallback){return String(value||fallback).replace(/CommandOrControl|CmdOrCtrl|Control/gi,'Ctrl').replace(/Option/gi,'Alt');}
function tips(settings={}){const hk=settings.hotkeys||{},voice=settings.voice||{},rows=[
 {id:'voice',text:`${shortcut(voice.shortcut,'Ctrl+Alt')}可以进行语音输入喔🎙️`},
 {id:'capture',text:`${shortcut(hk.capture,'Ctrl+Shift+A')}可以截屏/提取文字/表格/公式/标注📸`},
 {id:'ocr',text:`${shortcut(hk.ocrClipboard,'Shift+Alt+T')}可以提取剪贴板图片文字喔🔍`},
 {id:'clean',text:`${shortcut(hk.processClipboard,'Shift+Alt+O')}可以清洗剪贴板文字内容喔✨`},
];if(settings.toolbox?.middleHold!==false)rows.unshift({id:'clipboard',text:'长按鼠标中键可以调出剪贴板喔📋'});return rows.map(r=>({...r,kind:'tip',scene:'idle'}));}
function lifeLines(date){const h=date.getHours()+date.getMinutes()/60;return PERIODS.filter(p=>h>=p.from&&h<p.to).flatMap(p=>p.lines.map((text,i)=>({id:`life:${p.from}:${p.to}:${i}`,text,kind:'life',scene:p.scene||'idle'})));}
function dateKey(date){return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;}
class AmbientCompanion{
 constructor({file,now=()=>Date.now(),random=Math.random}){this.now=now;this.random=random;this.store=new JsonStore(file,{lastAt:0,nextAt:now()+5*60000,frequency:'normal',count:0,recent:[],fired:[]});const next=this.store.get('nextAt');if(!Number.isFinite(next)||next>now()+60*60000)this.store.set('nextAt',now()+5*60000);}
 interval(frequency){const [min,max]=FREQUENCIES[frequency]||FREQUENCIES.normal;return (min+(max-min)*Math.max(0,Math.min(1,this.random())))*60000;}
 next({enabled=true,available=true,busy=false,frequency='normal',settings={}}={}){
  const now=this.now(),date=new Date(now);frequency=Object.hasOwn(FREQUENCIES,frequency)?frequency:'normal';
  if(this.store.get('frequency')!==frequency)this.store.set({frequency,nextAt:now+this.interval(frequency)});
  if(!enabled||!available||busy)return null;
  const hour=date.getHours(),fired=this.store.get('fired'),key=`${dateKey(date)}:${hour}`;
  // Check every second in the host. Resume/startup catches up only within five
  // minutes, never replaying yesterday's reminders or firing twice after restart.
  if((hour===0||hour===2)&&date.getMinutes()<5&&!fired.includes(key)){
   this.store.set({fired:[...fired,key].slice(-14),lastAt:now,nextAt:now+this.interval(frequency)});
   return {kind:'bedtime',title:'休息提醒',text:hour===0?'十二点了该准备睡觉了💤':'快点睡觉🛏',scene:'attention'};
  }
  const life=lifeLines(date);if(!life.length||now<this.store.get('nextAt')||now-this.store.get('lastAt')<10*60000)return null;
  const count=this.store.get('count')+1,pool=count%3===0?tips(settings):life,recent=this.store.get('recent');
  const unseen=pool.filter(r=>!recent.includes(r.id)),eligible=unseen.length?unseen:pool.filter(r=>r.id!==recent.at(-1));
  const options=eligible.length?eligible:pool,row=options[Math.min(options.length-1,Math.floor(Math.max(0,this.random())*options.length))];
  this.store.set({count,lastAt:now,nextAt:now+this.interval(frequency),recent:[...recent,row.id].slice(-8)});
  return {...row,title:row.kind==='tip'?'小技巧':'斐墨陪伴'};
 }
}
module.exports={AmbientCompanion,lifeLines,tips,FREQUENCIES};
