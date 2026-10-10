[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;public static class FeimoMiddle{[StructLayout(LayoutKind.Sequential)]public struct Point{public int X,Y;}[DllImport("user32.dll")]public static extern short GetAsyncKeyState(int key);[DllImport("user32.dll")]public static extern bool GetCursorPos(out Point p);}
'@
$started=0L;$fired=$false;$origin=New-Object FeimoMiddle+Point;$leftWas=$false
while($true){
 $left=([FeimoMiddle]::GetAsyncKeyState(1) -band 0x8000) -ne 0
 if($left -and !$leftWas){[Console]::WriteLine('left');[Console]::Out.Flush()};$leftWas=$left
 $down=([FeimoMiddle]::GetAsyncKeyState(4) -band 0x8000) -ne 0
 if(!$down){$started=0L;$fired=$false}else{
  $point=New-Object FeimoMiddle+Point;[FeimoMiddle]::GetCursorPos([ref]$point)|Out-Null
  $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  if($started -eq 0){$started=$now;$origin=$point}
  if([Math]::Abs($point.X-$origin.X) -gt 8 -or [Math]::Abs($point.Y-$origin.Y) -gt 8){$fired=$true}
  if(!$fired -and $now-$started -ge 500){$fired=$true;[Console]::WriteLine('hold');[Console]::Out.Flush()}
 }
 Start-Sleep -Milliseconds 25
}
