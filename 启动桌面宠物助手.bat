@echo off
chcp 65001 >nul
title 桌面宠物助手
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo [首次运行] 正在安装依赖并下载 Electron...
  call npm install || goto :err
  if not exist node_modules\electron\dist\electron.exe (
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    call node node_modules\electron\install.js || goto :err
  )
)
echo 正在启动桌面宠物助手...（关闭此窗口或托盘右键退出）
start "" node_modules\electron\dist\electron.exe .
exit /b 0
:err
echo 启动失败，请检查 Node.js 环境或手动执行 npm install
pause
