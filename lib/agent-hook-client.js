'use strict';
const fs=require('node:fs'),net=require('node:net'),{execFile}=require('node:child_process');
async function run(configFile,event,source='claude'){
  let config;try{config=JSON.parse(fs.readFileSync(configFile,'utf8'));}catch{return;}
  let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>1024*1024)return;}
  let payload;try{payload=JSON.parse(input);}catch{return;}
  payload.hook_event_name=event;payload.feimo_agent=source;
  payload.term_program=process.env.TERM_PROGRAM||'';payload.wt_session=process.env.WT_SESSION||'';
  payload.terminal_pids=[process.ppid];
  if(process.platform==='win32')await new Promise(resolve=>{
    execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$taskPid=${process.ppid}; $ids=@(); for($i=0;$i -lt 12 -and $taskPid -gt 0;$i++){ $p=Get-CimInstance Win32_Process -Filter ('ProcessId='+$taskPid);if(!$p){break};$ids+=$p.ProcessId;$taskPid=$p.ParentProcessId }; ConvertTo-Json -Compress -InputObject @($ids)`],{windowsHide:true,timeout:2500},(_err,stdout)=>{try{payload.terminal_pids=JSON.parse(stdout);}catch{}resolve();});
  });
  await new Promise(resolve=>{
    const waits=event==='PermissionRequest'||(event==='PreToolUse'&&payload.tool_name==='AskUserQuestion');
    let data='',finished=false;
    const socket=net.createConnection(config.pipe);
    const finish=()=>{if(finished)return;finished=true;socket.destroy();resolve();};
    socket.setTimeout(waits?125000:1500,finish);socket.on('error',finish);socket.on('close',finish);
    socket.on('connect',()=>socket.write(JSON.stringify({token:config.token,payload})+'\n'));
    socket.on('data',chunk=>{data+=chunk;if(data.length>1024*1024)return finish();const nl=data.indexOf('\n');if(nl<0)return;
      try{const response=JSON.parse(data.slice(0,nl));if(response.output)process.stdout.write(JSON.stringify(response.output)+'\n');}catch{}finish();
    });
  });
}
module.exports={run};
if(require.main===module)run(process.argv[2],process.argv[3],process.argv[4]).catch(()=>{});
