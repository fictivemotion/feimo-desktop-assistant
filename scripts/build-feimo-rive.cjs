'use strict';
// Original Feimo character. Reproducible RML; all motion is authored in Rive,
// with no embedded scripts, fonts, remote assets or signing requirement.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../assets/pets/feimo-rive'),source=path.join(root,'source');
fs.mkdirSync(source,{recursive:true});let serial=100;const ids=new Map();
const id=n=>{if(!ids.has(n))ids.set(n,`0:${serial++}`);return ids.get(n);};
const attr=o=>Object.entries(o).map(([k,v])=>`${k}="${v}"`).join(' ');
const tag=(t,a,c='')=>`<${t} ${attr(a)}>${c}</${t}>`;
const paint=color=>tag('Fill',{},tag('SolidColor',{colorValue:color}));
const shape=(n,x,y,geometry,color,extra={})=>tag('Shape',{id:id(n),name:n,x,y,...extra},geometry+(color.startsWith('<')?color:paint(color)));
const ellipse=(n,x,y,w,h,c,a={})=>shape(n,x,y,tag('Ellipse',{width:w,height:h}),c,a);
const rect=(n,x,y,w,h,r,c,a={})=>shape(n,x,y,tag('Rectangle',{width:w,height:h,cornerRadiusTL:r}),c,a);
const group=(n,x,y,c,a={})=>tag('Node',{id:id(n),name:n,x,y,...a},c);
const line=(n,pts,c,width=5,closed=false)=>tag('Shape',{id:id(n),name:n},tag('PointsPath',{isClosed:closed},pts.map(([x,y])=>tag('StraightVertex',{x,y})).join(''))+tag('Stroke',{thickness:width,cap:'round',join:'round'},tag('SolidColor',{colorValue:c})));
function curve(n,points,c,width=5){return tag('Shape',{id:id(n),name:n},tag('PointsPath',{},points.map(([x,y,ir,il,or,ol])=>tag('CubicDetachedVertex',{x,y,inRotation:ir,inDistance:il,outRotation:or,outDistance:ol})).join(''))+tag('Stroke',{thickness:width,cap:'round',join:'round'},tag('SolidColor',{colorValue:c})));}
const white='FFF9FCFF',ink='FF303B59',gold='FFF1B964';
const coffee=group('coffee',61,60,
 curve('steam',[[0,-32,0,0,-2,12],[-3,-48,1,8,-1,8],[2,-60,2,8,0,0]],'B3F8FBFF',3)+
 ellipse('coffee-handle',19,0,24,23,'<Stroke thickness="5"><SolidColor colorValue="FFF9FCFF"/></Stroke>')+
 rect('cup',0,0,34,31,9,white)+ellipse('coffee-top',0,-14,26,6,'FF8A675C'),{opacity:0});
const water=group('water',61,60,
 line('water-rim',[[-15,-20],[15,-20]],'FFDAEDFA',3)+
 rect('water-fill',0,4,26,24,4,'FF8EBECD')+rect('water-glass',0,0,32,40,6,'B3DAEDFA')+
 ellipse('water-paw',19,4,15,14,white),{opacity:0});
const hand=group('hand',80,30,
 rect('finger-one',-7,-25,7,21,3,white,{rotation:-.15})+rect('finger-two',2,-28,7,25,3,white)+rect('finger-three',11,-25,7,20,3,white,{rotation:.15})+
 ellipse('palm',2,-12,29,29,white)+ellipse('thumb',-14,-12,10,18,white,{rotation:-.6}),{opacity:0});
const writing=group('writing',0,0,
 group('pen',39,56,rect('pen-shaft',0,-17,7,40,3,gold)+line('pen-tip',[[0,3],[0,8]],ink,3),{rotation:.4})+
 ellipse('hand-writing',39,52,18,15,'FFC0D1FF')+
 line('paper-line1',[[-35,60],[12,60]],'FFB5C7D9',3)+line('paper-line2',[[-35,69],[23,69]],'FFB5C7D9',3)+
 rect('paper',0,64,108,45,9,white,{rotation:-.06}),{opacity:0});
const headphones=group('headphones',0,0,
 rect('ear-left',-78,-1,23,45,10,ink,{rotation:-.13})+rect('ear-right',78,-1,23,45,10,ink,{rotation:.13})+
 curve('band',[[-77,-10,0,0,-Math.PI/2,82],[77,-10,-Math.PI/2,82,0,0]],ink,10),{opacity:0});
const notes=group('notes',0,0,
 ellipse('note-dot',106,-24,13,9,gold,{rotation:-.4})+line('note-stem',[[111,-26],[111,-49],[123,-44]],gold,4)+
 ellipse('note-dot2',-107,20,11,8,'FFAAA0EE')+line('note-stem2',[[-103,17],[-103,-3],[-92,1]],'FFAAA0EE',4),{opacity:0});
const question=group('question',70,-89,ellipse('question-dot',0,18,5,5,ink)+curve('question-hook',[[-9,-8,0,0,-1.2,20],[11,-8,-1.8,20,1.5,12],[0,7,-Math.PI/2,8,0,0]],ink,5)+ellipse('question-bubble',0,0,48,54,white),{opacity:0});
const attention=group('attention',70,-89,rect('bang',0,-5,5,19,3,ink)+ellipse('bang-dot',0,13,5,5,ink)+ellipse('bang-bubble',0,0,46,50,'FFFFE1AD'),{opacity:0});
const success=group('success',66,-82,line('check',[[-10,0],[-3,8],[12,-9]],'FF3D8276',5)+ellipse('success-bubble',0,0,45,45,'FFD6F2E7'),{opacity:0});
const error=group('error',68,-82,line('cross1',[[-7,-7],[7,7]],'FFA26065',4)+line('cross2',[[7,-7],[-7,7]],'FFA26065',4)+ellipse('error-bubble',0,0,43,43,'FFFFDADC'),{opacity:0});
const voice=group('voice',0,79,[-2,-1,0,1,2].map((v,i)=>rect('wave'+i,v*11,0,5,12+i%3*8,3,'FF475F95')).join(''),{opacity:0});
const sleep=group('sleep',64,-75,line('zzz',[[0,0],[14,0],[0,15],[14,15]],'FFA6AFCD',3),{opacity:0});
const sparkles=group('sparkles',0,0,line('sparkle1',[[-109,-42],[-95,-42]],gold,3)+line('sparkle2',[[-102,-49],[-102,-35]],gold,3)+ellipse('sparkle3',102,35,7,7,'FF9DBBE5'),{opacity:0});
const happyEyes=group('happyEyes',0,0,curve('happyL',[[-24,4,0,0,-Math.PI/2,12],[-10,4,-Math.PI/2,12,0,0]],white,6)+curve('happyR',[[10,4,0,0,-Math.PI/2,12],[24,4,-Math.PI/2,12,0,0]],white,6),{opacity:0});
const eyes=group('eyes',0,-4,happyEyes+rect('eyeL',-17,0,10,24,5,white)+rect('eyeR',17,0,10,24,5,white));
const keyboardKeys=[];for(let row=0;row<2;row++)for(let col=0;col<8;col++)keyboardKeys.push(rect('key-'+row+'-'+col,-56+col*16,69+row*11,11,7,2,'FFB7C0C9'));
const typing=group('typing',0,0,group('typingL',-30,59,ellipse('pawL',0,0,22,15,white)+line('fingerL',[[-5,0],[-5,5]],'FF87939D',2))+group('typingR',30,65,ellipse('pawR',0,0,22,15,white)+line('fingerR',[[5,0],[5,5]],'FF87939D',2))+keyboardKeys.join('')+rect('spacebar',0,90,54,6,2,'FFB7C0C9')+rect('keyboard',0,78,146,42,10,'FFEAF0F4'),{opacity:0});
// Pure black circular silhouette, no mouth: emotion is carried by eyes and motion.
const body=ellipse('body',0,0,160,160,'FF08090A');
const spin=require('./feimo-music-spin.cjs')({id,tag,group,rect,ellipse,line,ink,gold});
const character=group('character',160,164,spin.front+question+attention+success+error+sleep+notes+sparkles+hand+water+coffee+writing+typing+headphones+voice+eyes+body+spin.back);
const {modes}=require('../assets/pets/feimo-rive/scenes');
const defaults={character:{x:160,y:164,rotation:0,scaleX:1,scaleY:1},eyes:{x:0,y:-4,scaleY:1},eyeL:{rotation:-.07,y:0,scaleY:1,opacity:1},eyeR:{rotation:.07,y:0,scaleY:1,opacity:1},happyEyes:{opacity:0},headphones:{opacity:0,scaleX:1},notes:{opacity:0,y:0},writing:{opacity:0},pen:{x:39,y:56,rotation:.4},coffee:{opacity:0,x:61,y:60,rotation:0},question:{opacity:0,y:-89,rotation:0},attention:{opacity:0,y:-89,scaleX:1,scaleY:1},success:{opacity:0},error:{opacity:0},voice:{opacity:0},sleep:{opacity:0,y:-75},sparkles:{opacity:0,rotation:0}};
for(let i=0;i<5;i++)defaults['wave'+i]={scaleY:1};
defaults.water={opacity:0,x:61,y:60,rotation:0};defaults.hand={opacity:0,x:80,y:30,rotation:0};defaults.typing={opacity:0};defaults.typingL={y:59,rotation:0};defaults.typingR={y:65,rotation:0};
Object.assign(defaults,spin.defaults);defaults.eyes.scaleX=1;
function animation(mode,index){const duration=mode==='focus'?1440:mode==='idle'?480:mode==='idle-doze'?420:240;const tracks=structuredClone(defaults);const set=(n,p,v)=>tracks[n][p]=v;const keys=(...pairs)=>pairs;
set('character','y',keys([0,164],[duration/2,160],[duration,164]));set('character','scaleY',keys([0,1],[duration/2,1.025],[duration,1]));
set('eyeL','rotation',keys([0,-.07],[duration/2,.04],[duration,-.07]));set('eyeR','rotation',keys([0,.07],[duration/2,-.04],[duration,.07]));
set('eyes','scaleY',keys([0,1],[100,1],[106,.12],[112,1],[duration,1]));
if(mode==='music'){set('headphones','opacity',1);set('notes','opacity',1);set('character','rotation',keys([0,-.065],[60,.065],[120,-.065],[180,.065],[240,-.065]));set('notes','y',keys([0,4],[120,-8],[240,4]));}
if(mode==='focus'){set('writing','opacity',1);set('eyes','y',-1);const scribble=[];for(let f=0;f<=1440;f+=24)scribble.push([f,f>=1080&&f<=1230?.4:.4+.19*Math.sin(f/24*2)]);set('pen','rotation',scribble);set('pen','x',keys([0,16],[240,42],[264,16],[504,42],[528,16],[768,42],[792,16],[1032,42],[1056,16],[1260,16],[1440,39]));set('coffee','opacity',keys([0,0],[1020,0],[1050,1],[1260,1],[1290,0],[1440,0]));set('coffee','x',keys([0,61],[1080,61],[1120,22],[1200,22],[1240,61],[1440,61]));set('coffee','y',keys([0,60],[1080,60],[1120,20],[1200,20],[1240,60],[1440,60]));set('coffee','rotation',keys([0,0],[1110,0],[1140,-.3],[1200,-.3],[1240,0],[1440,0]));}
if(mode==='thinking'){set('question','opacity',1);set('eyeL','scaleY',.65);set('eyeR','y',-3);set('eyeL','rotation',-.2);set('eyeR','rotation',.12);set('question','y',keys([0,-89],[120,-97],[240,-89]));set('character','rotation',keys([0,-.035],[120,.035],[240,-.035]));}
if(mode==='attention'){set('attention','opacity',1);set('attention','scaleX',keys([0,1],[30,1.14],[60,1],[240,1]));set('attention','scaleY',tracks.attention.scaleX);}
if(mode==='completed'){set('success','opacity',1);set('sparkles','opacity',1);set('character','y',keys([0,164],[20,173],[48,143],[78,164],[240,164]));set('character','scaleX',keys([0,1],[20,1.08],[48,.96],[78,1],[240,1]));}
if(mode==='failed'){set('error','opacity',1);set('eyeL','rotation',.22);set('eyeR','rotation',-.22);set('eyeL','scaleY',.68);set('eyeR','scaleY',.68);set('character','rotation',keys([0,0],[20,-.08],[40,.08],[60,-.04],[80,0],[240,0]));}
if(mode==='sleeping'){set('eyes','scaleY',.12);set('sleep','opacity',1);set('sleep','y',keys([0,-75],[120,-87],[240,-75]));set('character','scaleY',keys([0,.93],[120,.97],[240,.93]));}
if(mode==='listening'){set('voice','opacity',1);for(let i=0;i<5;i++){const a=[];for(let f=0;f<=240;f+=20)a.push([f,.5+Math.abs(Math.sin(f*Math.PI/120+i))]);set('wave'+i,'scaleY',a);}}
if(mode==='streaming'){set('voice','opacity',1);set('sparkles','opacity',.6);set('character','y',keys([0,164],[60,160],[120,164],[180,160],[240,164]));}
if(mode==='greeting'){set('sparkles','opacity',1);set('character','rotation',keys([0,0],[35,-.1],[70,.1],[105,-.06],[140,0],[240,0]));}
if(mode==='dragging'){set('character','rotation',keys([0,-.12],[120,.12],[240,-.12]));set('character','scaleY',1.07);}
if(mode==='break'){set('coffee','opacity',1);set('coffee','y',keys([0,60],[70,60],[110,23],[150,23],[190,60],[240,60]));set('coffee','x',keys([0,61],[70,61],[110,23],[150,23],[190,61],[240,61]));}
if(mode==='workbench'){set('sparkles','opacity',.45);}
if(mode==='typing'){set('typing','opacity',1);const left=[],right=[],body=[];for(let f=0;f<=240;f+=6){left.push([f,f%12===0?58:69]);right.push([f,f%12===0?69:58]);body.push([f,f%12===0?164:162]);}set('typingL','y',left);set('typingR','y',right);set('character','y',body);set('character','scaleY',keys([0,1],[60,1.018],[120,1],[180,1.018],[240,1]));set('eyeL','rotation',-.12);set('eyeR','rotation',.12);}
if(['completed','greeting','music'].includes(mode)){set('happyEyes','opacity',keys([0,0],[30,0],[48,1],[150,1],[168,0],[240,0]));set('eyeL','opacity',keys([0,1],[30,1],[48,0],[150,0],[168,1],[240,1]));set('eyeR','opacity',tracks.eyeL.opacity);}

// No mouth: a raised paw, closed eyes and a slow head stretch convey a yawn.
if(mode==='sleepy'){
 set('eyes','scaleY',keys([0,.7],[30,.4],[60,.09],[130,.09],[175,.4],[210,.15],[240,.7]));
 set('character','scaleY',keys([0,1],[70,1.09],[110,1.09],[165,.94],[210,.97],[240,1]));
 set('character','rotation',keys([0,0],[70,-.06],[130,-.06],[180,.11],[220,.08],[240,0]));
 set('hand','opacity',keys([0,0],[22,1],[128,1],[155,0],[240,0]));
 set('hand','x',keys([0,80],[60,19],[125,19],[170,80],[240,80]));
 set('hand','y',keys([0,45],[60,40],[125,40],[170,45],[240,45]));
 set('sleep','opacity',keys([0,0],[150,0],[175,1],[225,1],[240,0]));
}
if(mode==='coffee'||mode==='water'){
 const prop=mode;set(prop,'opacity',1);
 set(prop,'x',keys([0,61],[35,61],[85,22],[140,22],[190,61],[240,61]));
 set(prop,'y',keys([0,60],[35,60],[85,20],[140,20],[190,60],[240,60]));
 set(prop,'rotation',keys([0,0],[55,0],[98,-.35],[135,-.35],[185,0],[240,0]));
 set('eyes','scaleY',keys([0,1],[60,1],[95,.15],[140,.15],[175,1],[240,1]));
 set('character','rotation',keys([0,0],[95,-.05],[140,-.05],[185,0],[240,0]));
}
if(mode==='farewell'){
 set('hand','opacity',1);set('hand','x',85);set('hand','y',15);
 set('hand','rotation',keys([0,0],[30,-.3],[55,.3],[80,-.3],[105,.3],[130,-.3],[160,0],[240,0]));
 set('character','rotation',keys([0,0],[50,-.07],[150,-.07],[200,0],[240,0]));
 set('happyEyes','opacity',1);set('eyeL','opacity',0);set('eyeR','opacity',0);
}
if(mode==='music-spin')spin.animate(set);

if(mode.startsWith('idle-')){
 set('eyes','scaleY',1);set('character','y',164);set('character','scaleY',1);
 if(mode==='idle-asymmetric'){set('eyeL','scaleY',keys([0,1],[40,1.3],[95,1.3],[135,.72],[175,1],[240,1]));set('eyeR','scaleY',keys([0,1],[40,.65],[95,.65],[135,1.2],[175,1],[240,1]));set('character','rotation',keys([0,0],[40,-.08],[95,-.08],[135,.06],[175,0],[240,0]));}
 if(mode.includes('wink')){const left=mode.endsWith('left'),eye=left?'eyeL':'eyeR',other=left?'eyeR':'eyeL';set(eye,'scaleY',keys([0,1],[25,1],[35,.06],[70,.06],[85,1],[240,1]));set(other,'scaleY',keys([0,1],[35,1.13],[70,1.13],[95,1],[240,1]));set('character','rotation',keys([0,0],[35,left?-.07:.07],[70,left?-.07:.07],[105,0],[240,0]));}
 if(mode==='idle-double-blink')set('eyes','scaleY',keys([0,1],[30,1],[36,.06],[44,1],[55,1],[61,.06],[70,1],[240,1]));
 if(mode.includes('look')){const sign=mode.endsWith('left')?-1:1;set('eyes','x',keys([0,0],[45,sign*13],[110,sign*13],[160,0],[240,0]));set('character','x',keys([0,160],[45,160+sign*3],[110,160+sign*3],[160,160],[240,160]));set('character','rotation',keys([0,0],[45,sign*.08],[110,sign*.08],[160,0],[240,0]));set('character','scaleX',keys([0,1],[45,.96],[110,.96],[160,1],[240,1]));set(sign<0?'eyeL':'eyeR','scaleY',keys([0,1],[45,.84],[110,.84],[160,1],[240,1]));}
 if(mode==='idle-nod'){set('character','y',keys([0,164],[35,169],[65,160],[100,167],[135,164],[240,164]));set('character','scaleY',keys([0,1],[35,.94],[65,1.025],[100,.97],[135,1],[240,1]));set('eyes','y',keys([0,-4],[35,1],[65,-6],[100,-1],[135,-4],[240,-4]));set('eyes','scaleY',keys([0,1],[35,.6],[65,1],[100,.8],[135,1],[240,1]));}
 if(mode==='idle-doze'){set('eyes','scaleY',keys([0,1],[60,.55],[100,.09],[280,.09],[310,1.14],[335,1],[420,1]));set('character','rotation',keys([0,0],[100,.10],[220,.12],[280,.1],[310,-.04],[350,0],[420,0]));set('character','y',keys([0,164],[100,169],[220,171],[280,169],[310,161],[350,164],[420,164]));set('sleep','opacity',keys([0,0],[100,0],[130,.8],[270,.8],[295,0],[420,0]));set('sleep','y',keys([0,-75],[130,-75],[270,-87],[420,-75]));}
 if(mode==='idle-stretch'){set('character','scaleX',keys([0,1],[50,.95],[85,.92],[115,1.06],[150,1],[240,1]));set('character','scaleY',keys([0,1],[50,1.07],[85,1.12],[115,.95],[150,1],[240,1]));set('eyes','scaleY',keys([0,1],[65,.2],[95,.2],[120,1.08],[150,1],[240,1]));}
}
return tag('LinearAnimation',{id:id('anim-'+mode),name:mode,fps:60,duration,loopValue:'loop'},Object.entries(tracks).map(([n,props])=>tag('KeyedObject',{objectId:id(n)},Object.entries(props).map(([property,v])=>tag('KeyedProperty',{property},(Array.isArray(v)?v:[[0,v]]).map(([frame,value])=>tag('KeyFrameDouble',{frame,value,interpolationType:'cubic'},tag('CubicEaseInterpolator',{x1:.42,y1:0,x2:.58,y2:1}))).join(''))).join(''))).join(''));}
const animations=modes.map(animation).join('');
const condition=value=>tag('TransitionViewModelCondition',{opValue:'equal'},tag('TransitionPropertyViewModelComparator',{},tag('BindablePropertyNumber',{},tag('DataBindContext',{sourcePathIds:'0:40-0:45',propertyKey:636})))+tag('TransitionValueNumberComparator',{value}));
const states=modes.map((m,i)=>tag('AnimationState',{id:id('state-'+m),animationId:id('anim-'+m),x:200+i%4*240,y:Math.floor(i/4)*200,reset:true})).join('');
const machine=tag('StateMachine',{name:'Feimo',id:'0:7'},tag('StateMachineLayer',{name:'Character',id:'0:8'},tag('EntryState',{x:0,y:0},tag('StateTransition',{stateToId:id('state-idle')}))+tag('AnyState',{x:0,y:-180},modes.map((m,i)=>tag('StateTransition',{stateToId:id('state-'+m),duration:320},condition(i))).join(''))+tag('ExitState',{x:0,y:600})+states));
const vm=tag('ViewModel',{name:'Feimo',id:'0:40',defaultInstanceId:'0:41'},tag('ViewModelPropertyNumber',{name:'mode',id:'0:45'})+tag('ViewModelInstance',{name:'Default',id:'0:41',exports:true},tag('ViewModelInstanceNumber',{propertyValue:0,viewModelPropertyId:'0:45'})));
fs.writeFileSync(path.join(source,'scene.rml'),tag('Rive',{version:1,kind:'fragment'},tag('Artboard',{name:'Feimo',id:'0:2',width:320,height:320,styleId:'0:5',defaultStateMachineId:'0:7',viewModelId:'0:40',viewModelInstanceId:'0:41'},tag('LayoutComponentStyle',{id:'0:5',name:'Artboard Style'})+character+machine+animations)+vm));
fs.writeFileSync(path.join(source,'rive.yaml'),'name: feimo\n');
fs.writeFileSync(path.join(root,'modes.json'),JSON.stringify(modes,null,2)+'\n');
const cli=process.env.RIVE_CLI||path.resolve(__dirname,'../tools/rive-cli/rive.exe');
for(const args of [[source,'--verify'],['inspect',source,'--summary'],[source,'--once']])execFileSync(cli,args,{stdio:'inherit'});
fs.copyFileSync(path.join(source,'build/feimo.riv'),path.join(root,'feimo.riv'));
