'use strict';
// Native DWM backdrops plus Feimo's independent surface tint. No DeskBox source
// is bundled; the material choices follow its documented public controls.
((root,factory)=>{const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.FeimoWidgetMaterials=value;})(typeof window==='object'?window:globalThis,()=>{
 const MATERIALS=[['transparent','透明'],['mica','云母 Mica'],['mica-alt','云母 Alt'],['acrylic','亚克力 · 轻薄'],['acrylic-base','亚克力 · 基础'],['solid','纯色']];
 const nativeNames={'mica':'mica','mica-alt':'tabbed','acrylic':'acrylic','acrylic-base':'acrylic'};
 const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
 function supported(platform,release){return platform==='win32'&&Number(String(release).split('.')[2])>=22621;}
 function native(material,opacity,available){return available&&opacity>0?nativeNames[material]||'none':'none';}
 function appearance(material,opacity,intensity,available=true){const alpha=clamp(opacity),strength=clamp(intensity);let tint=alpha,grain=0;
  if(material==='mica')tint=alpha*(available ? .09+.25*strength : .55+.35*strength);
  if(material==='mica-alt')tint=alpha*(available ? .18+.35*strength : .65+.3*strength);
  if(material==='acrylic')tint=alpha*(.025+.22*strength);
  if(material==='acrylic-base')tint=alpha*(.22+.48*strength);
  if(['acrylic','acrylic-base'].includes(material))grain=alpha*strength*.04;
  return {tint:clamp(tint),grain,native:native(material,alpha,available),fallback:!!nativeNames[material]&&!available};
 }
 return {MATERIALS,supported,native,appearance};
});
