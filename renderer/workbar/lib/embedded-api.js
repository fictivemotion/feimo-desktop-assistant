'use strict';
// Local embedded modules reuse the top window's validated API. Electron does
// not reliably run an asar preload in subframes; no Node access is needed here.
if(window.parent!==window&&new URLSearchParams(location.search).has('embedded')){
  try{
    if(parent.location.protocol==='file:'&&parent.location.pathname.endsWith('/renderer/island/island.html'))window.api=parent.api;
  }catch{}
}
