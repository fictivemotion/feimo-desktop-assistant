'use strict';
// A shared, bounded preference contract. Opacity never applies to a parent.
(function(root,factory){const value=factory();if(typeof module==='object')module.exports=value;else root.BubbleAppearance=value;})(typeof globalThis==='object'?globalThis:this,()=>{
 const clamp=(value,fallback)=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):fallback;
 function normalize(value={}){return {night:value.night===true,backgroundOpacity:clamp(value.backgroundOpacity??1,1),textColor:/^#[\da-f]{6}$/i.test(value.textColor||'')?value.textColor:null,fontSize:Number.isFinite(value.fontSize)?Math.round(Math.max(12,Math.min(28,value.fontSize))):null};}
 return {normalize};
});
