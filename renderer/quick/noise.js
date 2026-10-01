'use strict';
(()=>{
 const api=window.quickApi,$=id=>document.getElementById(id);let state;
 function render(value){if(!value?.catalog)return;state=value;SoundscapeUI.icon($('noise-play'),state.playing?'Pause':'Play');$('noise-play').title=state.playing?'暂停白噪音':'播放白噪音';$('noise-play').setAttribute('aria-label',$('noise-play').title);$('noise-play').disabled=!state.tracks.length;
  if(!$('noise-preset').options.length){for(const mix of state.catalog.mixes){const o=document.createElement('option');o.value=mix.id;o.textContent=mix.name;$('noise-preset').append(o)}const custom=document.createElement('option');custom.value='custom';custom.textContent='我的混音';$('noise-preset').append(custom)}
  $('noise-preset').value=state.catalog.mixes.find(m=>m.name===state.name)?.id||'custom';
  SoundscapeUI.tracks($('noise-tracks'),state,command);$('noise-status').textContent=state.error||(state.loading?'正在加载在线音源…':state.playing?'正在播放 · 关闭卡片后继续':'轻声陪你，把注意力留给此刻');
 }
 async function command(value){try{render(await api.soundscapeCommand(value))}catch(e){$('noise-status').textContent=e.message}}
 $('noise-play').onclick=()=>command({playing:!state?.playing});$('noise-preset').onchange=()=>{if($('noise-preset').value!=='custom')command({preset:$('noise-preset').value})};$('noise-library').onclick=()=>api.openWorkbar('soundscape');
 api.onSoundscapeChanged?.(render);window.FeimoNoise={refresh:()=>api.soundscapeState().then(render)};window.FeimoNoise.refresh();
})();
