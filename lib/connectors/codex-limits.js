'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
function normalizeLimits(value, observedAt=new Date().toISOString(), source='api') {
  const window = x => {
    const used=x?.usedPercent ?? x?.used_percent;
    if (typeof used!=='number' || !Number.isFinite(used)) return null;
    return {usedPercent:Math.max(0,Math.min(100,used)),resetsAt:x.resetsAt ?? x.resets_at ?? null,windowMinutes:x.windowDurationMins ?? x.windowMinutes ?? x.window_minutes ?? null};
  };
  const primary=window(value?.primary),secondary=window(value?.secondary);
  return primary || secondary ? {provider:'codex',primary,secondary,observedAt,source} : null;
}
function findCodex() {
  const home=process.env.CODEX_HOME || path.join(os.homedir(),'.codex');
  const candidates=[path.join(home,'bin','codex.exe'),...(process.env.PATH||'').split(path.delimiter).map(p=>path.join(p,'codex.exe'))];
  return candidates.find(p=>fs.existsSync(p)) || (process.platform==='win32'?null:'codex');
}
/** Read-only stdio JSON-RPC client. Starts no thread, sends no model request. */
class CodexLimitsClient {
  constructor({executable=findCodex(),spawnProcess=spawn,timeoutMs=15000}={}) {this.executable=executable;this.spawnProcess=spawnProcess;this.timeoutMs=timeoutMs;this.pending=null;this.child=null;this.closed=false;}
  read() {
    if(this.closed)return Promise.reject(new Error('额度查询已停止'));
    if(this.pending)return this.pending;
    if(!this.executable)return Promise.reject(new Error('未找到 Codex 原生 CLI，可从会话日志读取额度'));
    const operation=new Promise((resolve,reject)=>{
      let child,buffer='',settled=false;
      const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);child?.kill();if(this.child===child)this.child=null;error?reject(error):resolve(value);};
      const timer=setTimeout(()=>finish(new Error('额度查询超时，暂时保留最近的观测值')),this.timeoutMs);
      try { child=this.spawnProcess(this.executable,['app-server','--stdio','-c','analytics.enabled=false'],{windowsHide:true,stdio:['pipe','pipe','ignore']});this.child=child; }
      catch { finish(new Error('Codex 额度查询进程启动失败'));return; }
      const send=(message)=>{if(!settled)child.stdin.write(JSON.stringify(message)+'\n');};
      child.on('error',()=>finish(new Error('Codex 额度查询进程启动失败')));
      child.on('exit',()=>finish(new Error('Codex 额度查询进程提前退出')));
      child.stdin.on('error',()=>finish(new Error('Codex 额度查询连接中断')));
      child.stdout.setEncoding('utf8');
      child.stdout.on('data',chunk=>{
        buffer+=chunk;if(buffer.length>2000000){finish(new Error('额度响应过大'));return;}
        let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let msg;try{msg=JSON.parse(line);}catch{continue;}
          if(msg.id===1){if(msg.error){finish(new Error('Codex 额度接口初始化失败'));return;}send({method:'initialized'});send({id:2,method:'account/rateLimits/read',params:null});}
          if(msg.id===2){if(msg.error){finish(new Error('额度暂不可用，请确认 Codex 已登录 ChatGPT 账号'));return;}
            const result=msg.result,raw=result?.rateLimitsByLimitId?.codex || result?.rateLimits;
            const limits=normalizeLimits(raw);if(!limits){finish(new Error('接口未返回可用额度'));return;}finish(null,limits);
          }
        }
      });
      send({id:1,method:'initialize',params:{clientInfo:{name:'feimo_readonly_limits',title:'Feimo quota observer',version:'1.1'},capabilities:{experimentalApi:true}}});
    });
    this.pending=operation;operation.finally(()=>{if(this.pending===operation)this.pending=null;}).catch(()=>{});return operation;
  }
  stop(){this.closed=true;this.child?.kill();}
}
module.exports={normalizeLimits,findCodex,CodexLimitsClient};
