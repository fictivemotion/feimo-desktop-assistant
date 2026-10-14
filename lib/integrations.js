'use strict';
// Service pollers adapted from Louis-CFM/coucou (MIT; assets are not included).
const EDITION=require('./edition');
const CATALOG=[
  {id:'github',name:'GitHub',icon:'CodeSquare',color:'#566273',interval:120000,url:'https://github.com',secret:'integrationGithubKey'},
  {id:'notion',name:'Notion',icon:'DocumentText',color:'#566273',interval:300000,url:'https://www.notion.so',secret:'notionToken'},
].filter(item=>item.id!=='github'||EDITION.coding);
const plain=x=>Array.isArray(x)?x.map(y=>y.plain_text||y.text?.content||'').join(''):'';
function titleOf(page){return plain(page.title)||plain(Object.values(page.properties||{}).find(p=>p.type==='title')?.title)||'未命名页面';}
function validateConfig(id,c={}){
  if(!CATALOG.some(x=>x.id===id))throw new Error('未知服务');
  const out={enabled:!!c.enabled};
  if(id==='github'){
    out.repo=String(c.repo||'').trim();if(out.repo&&(!/^[A-Za-z0-9][A-Za-z0-9-]*\/[\w.-]+$/.test(out.repo)||['.','..'].includes(out.repo.split('/')[1])))throw new Error('仓库格式为 owner/repository');
  }
  return out;
}
class Integrations {
  constructor({settings,getSecret,fetcher=fetch,onChange=()=>{}}){Object.assign(this,{settings,getSecret,fetcher,onChange});this.states=new Map();this.busy=new Map();this.active=false;}
  async request(id,route,body){
    const item=CATALOG.find(x=>x.id===id);if(!item)throw new Error('未知服务');
    const key=await this.getSecret(item.secret);if(!key&&id!=='github')throw new Error('请先在连接设置中保存 API 密钥');
    const config=this.settings.get('integrations',{})[id]||{};
    const bases={github:'https://api.github.com',notion:'https://api.notion.com/v1'};
    if(!route.startsWith('/')||route.startsWith('//'))throw new Error('无效 API 路径');
    const base=bases[id];if(!base)throw new Error('请先设置服务地址');
    const headers={'Content-Type':'application/json','Accept':'application/json','User-Agent':'Feimo'};
    if(key)headers.Authorization='Bearer '+key;
    if(id==='notion')headers['Notion-Version']='2025-09-03';
    if(id==='github'){headers.Accept='application/vnd.github+json';headers['X-GitHub-Api-Version']='2022-11-28';}
    const response=await this.fetcher(base+route,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(response.status===401?'密钥无效或已过期':response.status===403?'权限不足或请求额度受限':`服务请求失败（${response.status}）`);
    return response.json();
  }
  async view(){
    return Promise.all(CATALOG.map(async item=>{
      const config=this.settings.get('integrations',{})[item.id]||{};
      return {...item,secret:undefined,config,configured:!!await this.getSecret(item.secret)||(item.id==='github'&&!!config.repo),...this.states.get(item.id)};
    }));
  }
  async refresh(id){
    if(this.busy.has(id))return this.busy.get(id);
    const task=this._refresh(id).finally(()=>this.busy.delete(id));this.busy.set(id,task);return task;
  }
  async _refresh(id){
    const c=this.settings.get('integrations',{})[id]||{};
    if(!c.enabled)return {id,disabled:true};
    const old=this.states.get(id);this.states.set(id,{...old,loading:true});this.onChange();
    try{
      const data=await this.poll(id,c),stamp=JSON.stringify(data.items?.map(x=>[x.id,x.status,x.updated])||[]);
      this.states.set(id,{loading:false,data,updatedAt:new Date().toISOString(),error:null,changed:!!old?.stamp&&old.stamp!==stamp,stamp});
    }catch(e){this.states.set(id,{...old,loading:false,error:e.message,attemptedAt:new Date().toISOString()});}
    this.onChange();return this.states.get(id);
  }
  async poll(id,c){
    const q=(route,body)=>this.request(id,route,body);
    if(id==='github'){
      const token=await this.getSecret('integrationGithubKey');let user=null,repo=c.repo;
      if(token){user=await q('/user');}
      const prs=repo?await q(`/repos/${repo}/pulls?state=open&per_page=20`):(await q('/search/issues?q='+encodeURIComponent(`is:pr is:open author:${user?.login||''}`)+'&per_page=20')).items;
      const reviews=user?(await q('/search/issues?q='+encodeURIComponent(`is:pr is:open review-requested:${user.login}`)+'&per_page=20')).items:[];
      const items=[];
      for(let p of prs||[]){
        let status='开放 PR';const slug=repo||p.repository_url?.split('/repos/')[1];
        if(!p.head?.sha&&slug&&p.number){try{p={...p,...await q(`/repos/${slug}/pulls/${p.number}`)};}catch{/* Keep the PR visible when checks cannot be read. */}}
        if(p.head?.sha&&slug){
          const checks=await Promise.allSettled([q(`/repos/${slug}/commits/${p.head.sha}/check-runs?per_page=30`),q(`/repos/${slug}/commits/${p.head.sha}/status`)]);
          const runs=checks[0].status==='fulfilled'?checks[0].value.check_runs||[]:[];
          const commit=checks[1].status==='fulfilled'?checks[1].value:null;
          status=runs.some(x=>['failure','cancelled','timed_out','action_required'].includes(x.conclusion))?'CI 失败':runs.some(x=>x.status!=='completed')?'CI 进行中':runs.length?'CI '+(runs.every(x=>['success','neutral','skipped'].includes(x.conclusion))?'通过':'待检查'):commit?.total_count?'CI '+({success:'通过',failure:'失败',error:'失败',pending:'进行中'}[commit.state]||commit.state):'尚无 CI';
        }
        items.push({id:String(p.id),title:p.title,status,url:p.html_url,updated:p.updated_at,detail:`#${p.number} · ${p.user?.login||''}`,repo:slug,number:p.number});
      }
      for(const p of reviews||[])items.push({id:'review-'+p.id,title:p.title,status:'请求你审核',url:p.html_url,updated:p.updated_at,detail:'#'+p.number});
      return {summary:`${prs?.length||0} 个开放 PR · ${reviews?.length||0} 个审核请求`,account:user?.login||null,items};
    }
    if(id==='notion'){
      const d=await q('/search',{sort:{direction:'descending',timestamp:'last_edited_time'},page_size:30});
      return {summary:`${d.results?.length||0} 个最近编辑页面`,items:(d.results||[]).map(p=>({id:p.id,title:titleOf(p),status:p.object==='data_source'?'数据库':'页面',url:p.url,updated:p.last_edited_time}))};
    }
    throw new Error('未知服务');
  }
  start(){if(this.active)return;this.active=true;this.timer=setInterval(()=>{for(const x of CATALOG){const s=this.states.get(x.id);if(this.settings.get('integrations',{})[x.id]?.enabled&&!s?.loading&&Date.now()-Date.parse(s?.attemptedAt||s?.updatedAt||0)>x.interval)void this.refresh(x.id);}},15000);this.timer.unref?.();}
  stop(){this.active=false;clearInterval(this.timer);}
}
module.exports={Integrations,CATALOG,validateConfig,titleOf};
