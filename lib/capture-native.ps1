$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
public static class FeimoRegionCapture {
 [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("dwmapi.dll")] static extern int DwmFlush();
 public static string Capture(int x,int y,int width,int height) {
  if(width<1||height<1||width>16384||height>16384||(long)width*height>64000000)throw new ArgumentException("Invalid region");
  IntPtr previous=SetThreadDpiAwarenessContext(new IntPtr(-4));
  try { DwmFlush();using(var image=new Bitmap(width,height,PixelFormat.Format32bppArgb)) {
   using(var graphics=Graphics.FromImage(image))graphics.CopyFromScreen(x,y,0,0,new Size(width,height),CopyPixelOperation.SourceCopy);
   using(var bytes=new MemoryStream()){image.Save(bytes,ImageFormat.Png);return Convert.ToBase64String(bytes.ToArray());}
  }} finally { SetThreadDpiAwarenessContext(previous); }
 }
}
'@ -ReferencedAssemblies System.Drawing
[Console]::WriteLine('{"ready":true}')
while($null -ne ($line=[Console]::ReadLine())) {
 try { $request=$line|ConvertFrom-Json;$image=[FeimoRegionCapture]::Capture([int]$request.x,[int]$request.y,[int]$request.width,[int]$request.height);[Console]::WriteLine((@{id=$request.id;image=('data:image/png;base64,'+$image)}|ConvertTo-Json -Compress)) }
 catch { [Console]::WriteLine((@{id=$request.id;error=$_.Exception.Message}|ConvertTo-Json -Compress)) }
}
