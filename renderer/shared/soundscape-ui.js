'use strict';
window.SoundscapeUI={
 icon(button,name){button.replaceChildren(window.ReiconFilled.create(name,20));},
 tracks(root,state,command,{removable=false}={}){
  const signature=state.tracks.map(t=>t.id).join('|');
  if(root.dataset.signature!==signature){root.dataset.signature=signature;root.replaceChildren();for(const track of state.tracks){
   const sound=state.catalog.sounds.find(s=>s.id===track.id),row=document.createElement('label');row.className='noise-track';row.dataset.id=track.id;
   const name=document.createElement('span');name.textContent=sound?.name||track.id;row.append(name);
   const input=document.createElement('input');input.type='range';input.min=0;input.max=100;input.setAttribute('aria-label',(sound?.name||'声音')+'音量');row.append(input);
   const output=document.createElement('output');row.append(output);
   input.oninput=()=>{output.textContent=input.value+'%'};input.onchange=()=>command({tracks:state.tracks.map(t=>({...t,volume:t.id===track.id?Number(input.value)/100:t.volume}))});
   if(removable){const remove=document.createElement('button');remove.type='button';remove.className='btn small';remove.title='移除'+name.textContent;remove.setAttribute('aria-label',remove.title);this.icon(remove,'CloseCircle');remove.onclick=e=>{e.preventDefault();command({tracks:state.tracks.filter(t=>t.id!==track.id)})};row.append(remove)}root.append(row);
  }}
  for(const row of root.children){const t=state.tracks.find(t=>t.id===row.dataset.id),input=row.querySelector('input');if(document.activeElement!==input){input.value=Math.round(t.volume*100);row.querySelector('output').textContent=input.value+'%'}
   // Refresh handlers with the latest state without replacing a focused slider.
   input.onchange=()=>command({tracks:state.tracks.map(x=>({...x,volume:x.id===t.id?Number(input.value)/100:x.volume}))});const remove=row.querySelector('button');if(remove)remove.onclick=e=>{e.preventDefault();command({tracks:state.tracks.filter(x=>x.id!==t.id)})};
  }
 }
};
