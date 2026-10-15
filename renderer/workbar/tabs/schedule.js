'use strict';
(()=>{
 const api=window.api,view=document.getElementById('view-schedule'),calendar=document.createElement('section');calendar.className='card';const controls=document.createElement('div');controls.className='fc-calendar-sync';const status=document.createElement('span'),sync=document.createElement('button');sync.className='btn small';sync.textContent='同步 Notion';controls.append(status,sync);view.replaceChildren(calendar,controls);
 const ui=FeimoCalendarUI.mount(calendar,{api,onViewChange:route=>{const editing=route!=='calendar';view.classList.toggle('editing',editing);const action=document.getElementById('page-action');if(action)action.textContent=editing?'返回日程':'新建日程';}});
 async function refreshStatus(){try{const value=await api.calendarNotionStatus();status.textContent=value.configured?'Notion 已连接'+(value.lastSyncAt?' · '+new Date(value.lastSyncAt).toLocaleString('zh-CN'):''):'Notion 未连接 · 可在设置中配置';}catch(error){status.textContent=error.message;}}
 sync.onclick=async()=>{sync.disabled=true;sync.textContent='同步中…';try{const r=await api.calendarSyncNotion();if(!r.ok)throw Error(r.error||(r.code==='NOT_CONFIGURED'?'请先在设置中连接 Notion':'同步失败'));UI.toast('日程已同步');await ui.refresh();await refreshStatus();}catch(error){UI.toast(error.message,true);}finally{sync.disabled=false;sync.textContent='同步 Notion';}};
 api.onCalendarSyncResult?.(()=>{void ui.refresh();void refreshStatus();});void refreshStatus();
 window.TABS.schedule={toggleEditor:()=>ui.isEditing()?ui.back():ui.openAdd(),onShown:()=>{void ui.refresh();void refreshStatus();}};
})();
