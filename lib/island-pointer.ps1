[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;public static class FeimoPointer{[DllImport("user32.dll")]public static extern short GetAsyncKeyState(int key);}
'@
$previous=$false
while($true){$down=([FeimoPointer]::GetAsyncKeyState(1) -band 0x8000) -ne 0;if($down -and !$previous){[Console]::WriteLine('click');[Console]::Out.Flush()};$previous=$down;Start-Sleep -Milliseconds 30}
