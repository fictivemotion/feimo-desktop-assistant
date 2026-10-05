param([string]$PidList)
Add-Type @'
using System;using System.Runtime.InteropServices;
public class FeimoTerminal{
 [DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int command);
}
'@
$ids=$PidList | ConvertFrom-Json
foreach($taskPid in $ids){
 $p=Get-Process -Id $taskPid -ErrorAction SilentlyContinue
 if($p -and $p.MainWindowHandle -ne 0){[FeimoTerminal]::ShowWindowAsync($p.MainWindowHandle,9)|Out-Null;[FeimoTerminal]::SetForegroundWindow($p.MainWindowHandle)|Out-Null;Write-Output 'focused';exit 0}
}
Write-Output 'unavailable';exit 1
