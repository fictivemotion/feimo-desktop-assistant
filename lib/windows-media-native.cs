using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Text;
using System.Collections.Generic;

// NetEase releases without SMTC still expose their track caption and Windows audio session.
// Try that player's HWND first; the caller permits transport keys only without another SMTC session.
public static class FeimoMediaNative {
 public delegate bool EnumProc(IntPtr hwnd, IntPtr param);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr param);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd,StringBuilder text,int max);
 [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr h,uint msg,IntPtr w,IntPtr l,uint flags,uint timeout,out IntPtr result);
 [DllImport("user32.dll")] static extern uint SendInput(uint count,INPUT[] input,int size);
 [StructLayout(LayoutKind.Sequential)] struct INPUT{public uint type;public INPUTUNION data;}
 [StructLayout(LayoutKind.Explicit)] struct INPUTUNION{[FieldOffset(0)]public KEYBDINPUT keyboard;[FieldOffset(0)]public MOUSEINPUT mouse;}
 [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT{public ushort key,scan;public uint flags,time;public IntPtr extra;}
 [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT{public int x,y;public uint mouseData,flags,time;public IntPtr extra;}
 public static string[] Track() {
  foreach(var process in Process.GetProcessesByName("cloudmusic")){try{var text=process.MainWindowTitle;int split=text.LastIndexOf(" - ",StringComparison.Ordinal);if(process.MainWindowHandle!=IntPtr.Zero&&split>0&&split<text.Length-3)return new[]{text.Substring(0,split),text.Substring(split+3),process.MainWindowHandle.ToInt64().ToString(),process.Id.ToString()};}catch{}}
  return null;
 }
 public static bool Command(long hwnd,int command) {IntPtr result;return SendMessageTimeout(new IntPtr(hwnd),0x319,new IntPtr(hwnd),new IntPtr(command<<16),2,1200,out result)!=IntPtr.Zero && result!=IntPtr.Zero;}
 public static bool MediaKey(int command){ushort key=(ushort)(command==14?0xB3:command==11?0xB0:0xB1);var down=new INPUT{type=1,data=new INPUTUNION{keyboard=new KEYBDINPUT{key=key}}};var up=down;up.data.keyboard.flags=2;return SendInput(2,new[]{down,up},Marshal.SizeOf(typeof(INPUT)))==2;}
 public static string Diagnostic="";public static float Peak=0;
 public static bool? Playing() {
  IMMDeviceEnumerator enumerator=null;IMMDeviceCollection devices=null;
  try {
   Peak=0;enumerator=(IMMDeviceEnumerator)new MMDeviceEnumerator();Marshal.ThrowExceptionForHR(enumerator.EnumAudioEndpoints(0,1,out devices));uint count;devices.GetCount(out count);bool found=false,active=false;
   for(uint i=0;i<count;i++){IMMDevice device=null;object managerObject=null;IAudioSessionEnumerator sessions=null;
    try{devices.Item(i,out device);var iid=typeof(IAudioSessionManager2).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref iid,23,IntPtr.Zero,out managerObject));var manager=(IAudioSessionManager2)managerObject;manager.GetSessionEnumerator(out sessions);int total;sessions.GetCount(out total);
     for(int j=0;j<total;j++){IAudioSessionControl2 control=null;try{sessions.GetSession(j,out control);uint pid;control.GetProcessId(out pid);if(pid==0)continue;if(!Process.GetProcessById((int)pid).ProcessName.Equals("cloudmusic",StringComparison.OrdinalIgnoreCase))continue;found=true;int state;control.GetState(out state);float peak=0;try{((IAudioMeterInformation)control).GetPeakValue(out peak);}catch{}Peak=Math.Max(Peak,peak);active|=state==1;}catch{}finally{Release(control);}}
    }catch(Exception e){Diagnostic=e.Message;}finally{Release(sessions);Release(managerObject);Release(device);}
   }
   return found?(bool?)active:null;
  }catch(Exception e){Diagnostic=e.Message;return null;}finally{Release(devices);Release(enumerator);}
 }
 static void Release(object o){if(o!=null&&Marshal.IsComObject(o))Marshal.ReleaseComObject(o);}
 [ComImport,Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioMeterInformation{
  [PreserveSig]int GetPeakValue(out float peak);
 }
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator{}
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDeviceEnumerator{
  [PreserveSig]int EnumAudioEndpoints(int flow,uint mask,out IMMDeviceCollection devices);
  [PreserveSig]int GetDefaultAudioEndpoint(int flow,int role,out IMMDevice device);
 }
 [ComImport,Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDeviceCollection{
  [PreserveSig]int GetCount(out uint count);[PreserveSig]int Item(uint index,out IMMDevice device);
 }
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDevice{
  [PreserveSig]int Activate(ref Guid iid,uint context,IntPtr activation,[MarshalAs(UnmanagedType.IUnknown)]out object instance);
 }
 [ComImport,Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioSessionManager2{
  [PreserveSig]int GetAudioSessionControl(IntPtr guid,uint flags,out IntPtr control);
  [PreserveSig]int GetSimpleAudioVolume(IntPtr guid,uint flags,out IntPtr volume);
  [PreserveSig]int GetSessionEnumerator(out IAudioSessionEnumerator sessions);
 }
 [ComImport,Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioSessionEnumerator{
  [PreserveSig]int GetCount(out int count);[PreserveSig]int GetSession(int index,out IAudioSessionControl2 session);
 }
 [ComImport,Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioSessionControl2{
  [PreserveSig]int GetState(out int state);
  [PreserveSig]int GetDisplayName(out IntPtr name);[PreserveSig]int SetDisplayName(IntPtr name,IntPtr context);
  [PreserveSig]int GetIconPath(out IntPtr path);[PreserveSig]int SetIconPath(IntPtr path,IntPtr context);
  [PreserveSig]int GetGroupingParam(out Guid grouping);[PreserveSig]int SetGroupingParam(IntPtr grouping,IntPtr context);
  [PreserveSig]int RegisterAudioSessionNotification(IntPtr client);[PreserveSig]int UnregisterAudioSessionNotification(IntPtr client);
  [PreserveSig]int GetSessionIdentifier(out IntPtr identifier);[PreserveSig]int GetSessionInstanceIdentifier(out IntPtr identifier);
  [PreserveSig]int GetProcessId(out uint pid);
 }
}

