'use strict';
(() => {
  const root=document.getElementById('view-connections');let built=false;
  window.TABS.connections={onShown:async()=>{if(built)return;root.innerHTML='<div class="card">正在读取本机连接配置…</div>';try{await FeimoConnections.mount(root);built=true;}catch(error){root.innerHTML='';const card=document.createElement('div');card.className='card';card.textContent=error.message;root.append(card);}}};
})();
