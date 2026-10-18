$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)] public struct FeimoAccentPolicy { public int State; public int Flags; public uint Color; public int Animation; }
[StructLayout(LayoutKind.Sequential)] public struct FeimoCompositionData { public int Attribute; public IntPtr Data; public UIntPtr Size; }
public static class FeimoWidgetMaterial {
 [DllImport("user32.dll")] static extern bool SetWindowCompositionAttribute(IntPtr hwnd, ref FeimoCompositionData data);
 public static bool Acrylic(IntPtr hwnd, bool enabled, bool dark) {
  // Accent 4's system luminance/fallback layer becomes opaque white on some
  // Chromium transparent surfaces. Use the stable desktop blur primitive;
  // the renderer supplies the independently adjustable acrylic tint and grain.
  var policy=new FeimoAccentPolicy { State=enabled?3:0, Flags=2, Color=0 };
  IntPtr memory=Marshal.AllocHGlobal(Marshal.SizeOf(policy));
  try { Marshal.StructureToPtr(policy,memory,false); var data=new FeimoCompositionData { Attribute=19, Data=memory, Size=new UIntPtr((uint)Marshal.SizeOf(policy)) }; return SetWindowCompositionAttribute(hwnd,ref data); }
  catch { return false; } finally { Marshal.FreeHGlobal(memory); }
 }
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
  $widgetAccent=[FeimoWidgetMaterial]::Acrylic($widgetHandle,($widgetRequest.material -eq 'acrylic'),[bool]$widgetRequest.dark)
  [int]$widgetDark=if($widgetRequest.dark){1}else{0}
  $widgetResult=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,20,[ref]$widgetDark,4)
  [int]$widgetCorner=if($widgetRequest.rounded){2}else{1}
  [int]$widgetBorder=-2
  $null=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,33,[ref]$widgetCorner,4)
  $null=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,34,[ref]$widgetBorder,4)
  [Console]::WriteLine((@{id=$widgetRequest.id;ok=($widgetResult -eq 0 -and ($widgetRequest.material -ne 'acrylic' -or $widgetAccent))}|ConvertTo-Json -Compress))
 } catch {
  if($null -ne $widgetRequest){[Console]::WriteLine((@{id=$widgetRequest.id;ok=$false}|ConvertTo-Json -Compress))}
 }
}
