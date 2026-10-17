$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class FeimoWidgetMaterial {
 [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
}
"@
[Console]::WriteLine('{"ready":true}')
while($null -ne ($widgetLine=[Console]::ReadLine())) {
 $widgetRequest=$null
 try {
  $widgetRequest=$widgetLine | ConvertFrom-Json
  $widgetHandle=[IntPtr]([long]$widgetRequest.handle)
  [uint32]$widgetOwner=0
  $null=[FeimoWidgetMaterial]::GetWindowThreadProcessId($widgetHandle,[ref]$widgetOwner)
  if($widgetOwner -ne [uint32]$widgetRequest.pid -or $widgetOwner -eq 0){throw 'Window owner mismatch'}
  [int]$widgetDark=if($widgetRequest.dark){1}else{0}
  $widgetResult=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,20,[ref]$widgetDark,4)
  [int]$widgetCorner=if($widgetRequest.rounded){2}else{1}
  [int]$widgetBorder=-2
  $null=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,33,[ref]$widgetCorner,4)
  $null=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,34,[ref]$widgetBorder,4)
  [Console]::WriteLine((@{id=$widgetRequest.id;ok=($widgetResult -eq 0)}|ConvertTo-Json -Compress))
 } catch {
  if($null -ne $widgetRequest){[Console]::WriteLine((@{id=$widgetRequest.id;ok=$false}|ConvertTo-Json -Compress))}
 }
}
