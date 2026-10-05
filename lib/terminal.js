'use strict';
const {execFile}=require('node:child_process'),path=require('node:path');
function focusTerminal(session,dir){
  const ids=session?.terminalPids?.filter(n=>Number.isInteger(n)&&n>0).slice(0,12)||[];
  if(!ids.length)throw new Error('该会话没有终端定位信息，请启用会话桥接后重启对应会话');
  return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',require('./native-script').nativeScript(path.join(__dirname,'terminal-focus.ps1'),dir||require('node:os').tmpdir()),'-PidList',JSON.stringify(ids)],{windowsHide:true,timeout:6000},(error,stdout)=>error||!stdout.includes('focused')?reject(new Error('原终端窗口已关闭，或当前会话没有独立终端窗口')):resolve(true)));
}
module.exports={focusTerminal};
