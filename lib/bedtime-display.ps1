param([ValidateSet('Install','Night','Morning')][string]$Operation,[Parameter(Mandatory=$true)][string]$StateDir)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex=New-Object System.Threading.Mutex($false,('Local\FeimoDisplay-'+$sid))
$held=$false
function Read-State($name){$p=Join-Path $StateDir $name;if(Test-Path -LiteralPath $p){try{return Get-Content -LiteralPath $p -Raw | ConvertFrom-Json}catch{}};return $null}
function Write-State($name,$value){$p=Join-Path $StateDir $name;$tmp=$p+'.tmp';[IO.File]::WriteAllText($tmp,($value|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false));Move-Item -LiteralPath $tmp -Destination $p -Force}
function Set-Timeout($minutes){
 # This is deliberately the ONLY power setting changed by this feature.
 & "$env:SystemRoot\System32\powercfg.exe" /change monitor-timeout-ac $minutes | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Cannot change plugged-in screen timeout'}
}
try {
 try{$held=$mutex.WaitOne(15000)}catch [System.Threading.AbandonedMutexException]{$held=$true}
 if(!$held){throw 'Display settings busy'}
 $now=Get-Date;$today=$now.ToString('yyyy-MM-dd')
 if($Operation -eq 'Install'){
  $exe="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $arguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -Operation Morning -StateDir "'+$StateDir+'"'
  $action=New-ScheduledTaskAction -Execute $exe -Argument $arguments
  $trigger=New-ScheduledTaskTrigger -Daily -At '08:00'
  $principal=New-ScheduledTaskPrincipal -UserId $sid -LogonType Interactive -RunLevel Limited
  $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName ('Feimo-DisplayMorning-'+$sid+'-'+(Split-Path $StateDir -Leaf)) -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Feimo: restore only plugged-in display timeout to 60 minutes at 08:00.' -Force | Out-Null
  # Installation after 08:00 must not immediately alter a user's current settings.
  if(!(Test-Path -LiteralPath (Join-Path $StateDir 'installed.json'))){Write-State 'installed.json' @{at=$now.ToString('o')};if($now.Hour -ge 8){Write-State 'morning.json' @{day=$today;changed=$false;at=$now.ToString('o')}}}
  @{registered=$true}|ConvertTo-Json -Compress
 } elseif($Operation -eq 'Morning'){
  $morning=Read-State 'morning.json';$night=Read-State 'night.json'
  # A late scheduler catch-up must not undo a new bedtime click made after 08:00.
  if($now.Hour -lt 8 -or $morning.day -eq $today -or ($night -and ([datetime]$night.at).Date -eq $now.Date -and ([datetime]$night.at).Hour -ge 8)){
   @{changed=$false}|ConvertTo-Json -Compress
  }else{Set-Timeout 60;Write-State 'morning.json' @{day=$today;changed=$true;at=$now.ToString('o')};@{changed=$true}|ConvertTo-Json -Compress}
 }else{
  # Save the night marker first; morning and night operations share this mutex.
  Set-Timeout 1;Write-State 'night.json' @{at=$now.ToString('o')}
  $ok=0;$failed=0
  try{foreach($monitor in @(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Where-Object Active)){
   try{$result=Invoke-CimMethod -InputObject $monitor -MethodName WmiSetBrightness -Arguments @{Timeout=[uint32]0;Brightness=[byte]0};if($result.ReturnValue -eq 0){$ok++}else{$failed++}}catch{$failed++}
  }}catch{}
  # External monitors commonly expose DDC/CI instead of the laptop WMI interface.
  try{
   Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class FeimoDisplayBrightness {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct Physical {public IntPtr handle;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)]public string name;}
 public delegate bool Callback(IntPtr monitor,IntPtr dc,IntPtr rect,IntPtr data);
 [DllImport("user32.dll")]static extern bool EnumDisplayMonitors(IntPtr dc,IntPtr rect,Callback callback,IntPtr data);
 [DllImport("dxva2.dll")]static extern bool GetNumberOfPhysicalMonitorsFromHMONITOR(IntPtr h,out uint count);
 [DllImport("dxva2.dll")]static extern bool GetPhysicalMonitorsFromHMONITOR(IntPtr h,uint count,[Out]Physical[] monitors);
 [DllImport("dxva2.dll")]static extern bool DestroyPhysicalMonitors(uint count,Physical[] monitors);
 [DllImport("dxva2.dll")]static extern bool GetMonitorBrightness(IntPtr h,out uint min,out uint current,out uint max);
 [DllImport("dxva2.dll")]static extern bool SetMonitorBrightness(IntPtr h,uint brightness);
 public static int[] Dim(){int ok=0,fail=0;Callback cb=delegate(IntPtr h,IntPtr dc,IntPtr rect,IntPtr data){uint count;if(!GetNumberOfPhysicalMonitorsFromHMONITOR(h,out count)||count==0||count>32)return true;var monitors=new Physical[count];if(!GetPhysicalMonitorsFromHMONITOR(h,count,monitors))return true;try{foreach(var m in monitors){uint min,current,max;if(GetMonitorBrightness(m.handle,out min,out current,out max)){if(SetMonitorBrightness(m.handle,min))ok++;else fail++;}}}finally{DestroyPhysicalMonitors(count,monitors);}return true;};EnumDisplayMonitors(IntPtr.Zero,IntPtr.Zero,cb,IntPtr.Zero);return new[]{ok,fail};}
}
'@
   $ddc=[FeimoDisplayBrightness]::Dim();$ok+=$ddc[0];$failed+=$ddc[1]
  }catch{}
  @{timeoutMinutes=1;brightnessChanged=($ok -gt 0);brightnessPartial=($failed -gt 0)}|ConvertTo-Json -Compress
 }
}finally{if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
