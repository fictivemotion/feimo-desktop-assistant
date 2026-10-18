$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)] public struct FeimoRect { public int Left,Top,Right,Bottom; }
public static class FeimoWidgetMaterial {
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
 [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out FeimoRect rect);
 [DllImport("gdi32.dll")] static extern IntPtr CreateRoundRectRgn(int left,int top,int right,int bottom,int width,int height);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr handle);
 [DllImport("user32.dll")] static extern int SetWindowRgn(IntPtr hwnd,IntPtr region,bool redraw);
 public static bool Clip(IntPtr hwnd,double radius,bool nativeBackdrop) {
  // Native backdrops paint outside CSS. Clip them with one native curve in
  // physical pixels. CSS-only surfaces retain their antialiased alpha.
  if(!nativeBackdrop || radius<=0) return SetWindowRgn(hwnd,IntPtr.Zero,true)!=0;
  FeimoRect rect;if(!GetWindowRect(hwnd,out rect))return false;
  int width=rect.Right-rect.Left,height=rect.Bottom-rect.Top;
  double scale=GetDpiForWindow(hwnd)/96.0;
  int diameter=(int)Math.Round(2*Math.Min(radius*scale,Math.Min(width,height)/2.0));
  IntPtr region=CreateRoundRectRgn(0,0,width+1,height+1,diameter,diameter);
  if(region==IntPtr.Zero)return false;
  if(SetWindowRgn(hwnd,region,true)!=0)return true;
  DeleteObject(region);return false;
 }
}
"@
[Console]::WriteLine('{"ready":true}')
while($null -ne ($widgetLine=[Console]::ReadLine())) {
 $widgetRequest=$null
 $widgetOwned=$false
 try {
  $widgetRequest=$widgetLine | ConvertFrom-Json
  $widgetHandle=[IntPtr]([long]$widgetRequest.handle)
  [uint32]$widgetOwner=0
  $null=[FeimoWidgetMaterial]::GetWindowThreadProcessId($widgetHandle,[ref]$widgetOwner)
  if($widgetOwner -ne [uint32]$widgetRequest.pid -or $widgetOwner -eq 0){throw 'Window owner mismatch'}
  $widgetOwned=$true
  [int]$widgetDark=if($widgetRequest.dark){1}else{0}
  $widgetTheme=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,20,[ref]$widgetDark,4)
  [int]$widgetBackdrop=switch($widgetRequest.material){'mica'{2};'tabbed'{4};'acrylic'{3};default{1}}
  # Never call Electron setBackgroundMaterial('none'), which makes its content
  # compositor opaque. Clear only DWM to preserve transparent pixel rendering.
  $widgetMaterial=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,38,[ref]$widgetBackdrop,4)
  [int]$widgetCorner=1
  [int]$widgetBorder=-2
  $null=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,33,[ref]$widgetCorner,4)
  $null=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,34,[ref]$widgetBorder,4)
  $widgetDpiContext=[FeimoWidgetMaterial]::SetThreadDpiAwarenessContext([IntPtr](-4))
  try { $widgetClip=[FeimoWidgetMaterial]::Clip($widgetHandle,[Math]::Max(0,[Math]::Min(48,[double]$widgetRequest.radius)),($widgetRequest.material -ne 'none')) }
  finally { $null=[FeimoWidgetMaterial]::SetThreadDpiAwarenessContext($widgetDpiContext) }
  [Console]::WriteLine((@{id=$widgetRequest.id;ok=($widgetTheme -eq 0 -and $widgetMaterial -eq 0 -and $widgetClip)}|ConvertTo-Json -Compress))
 } catch {
  if($widgetOwned){[int]$widgetClear=1;$null=[FeimoWidgetMaterial]::DwmSetWindowAttribute($widgetHandle,38,[ref]$widgetClear,4);$null=[FeimoWidgetMaterial]::Clip($widgetHandle,0,$false)}
  if($null -ne $widgetRequest){[Console]::WriteLine((@{id=$widgetRequest.id;ok=$false}|ConvertTo-Json -Compress))}
 }
}
