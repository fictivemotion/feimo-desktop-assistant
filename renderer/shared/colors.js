'use strict';
(() => {
  const curated = [
    { name: '雾林', colors: ['#273D36','#789A87','#BDCEC2','#E4E9DF','#FAF9F4'] },
    { name: '月下海岸', colors: ['#28374A','#6B849B','#AABECB','#DCE5EA','#F6F7F8'] },
    { name: '桃色晨光', colors: ['#543B42','#B47885','#E3B5BB','#F1DCD6','#FFF9F4'] },
    { name: '鸢尾与纸', colors: ['#393346','#8A7DA4','#BBB0CF','#E5DFEB','#FCFAF7'] },
    { name: '秋日咖啡', colors: ['#42372E','#927765','#C2A185','#E7D8C6','#FBF6ED'] },
    { name: '晴空柠檬', colors: ['#294656','#749FAC','#D3DEB1','#F1E4A2','#FBFAF0'] },
  ];
  function rgb(hex) { if (!/^#[a-f\d]{6}$/i.test(hex)) throw new Error('请输入六位 HEX 色值'); return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)); }
  function hsl(hex) {
    const [r,g,b] = rgb(hex).map(v=>v/255), max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min, l=(max+min)/2;
    let h=0; if(d) h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60;
    return [h, d ? d/(1-Math.abs(2*l-1)) : 0, l];
  }
  function hex(h,s,l) {
    h=((h%360)+360)%360; const a=s*Math.min(l,1-l);
    const f=n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));};
    return '#'+[f(0),f(8),f(4)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function harmony(base, mode='analogous') {
    const [h,s,l]=hsl(base), shifts=mode==='complementary'?[0,0,180,180,0]:mode==='triadic'?[0,120,240,120,0]:[-30,0,30,15,0];
    return shifts.map((d,i)=>i===1?base.toUpperCase():hex(h+d,Math.min(.8,s)*(i===4?.16:i===3?.45:1),i===0?Math.max(.15,l*.48):i===2?Math.min(.78,l+.14):i===3?.85:i===4?.97:l));
  }
  function luminance(color) { return rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0); }
  function contrast(a,b) { const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
  const api={curated,rgb,hsl,hex,harmony,contrast};
  if (typeof module!=='undefined') module.exports=api; else window.FeimoColors=api;
})();
