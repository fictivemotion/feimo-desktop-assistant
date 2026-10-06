using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Web.Script.Serialization;

// Mute shared render sessions before the device output. Device mute alone may be
// downstream of an audio-engine mix / virtual loopback / echo-reference tap.
// A pipe-scoped lease restores both layers, including on parent-process exit.
class FeimoOutputAudio {
 static readonly object gate=new object();
 static readonly Dictionary<string,bool> saved=new Dictionary<string,bool>();
 class SessionLease {public IAudioSessionControl2 control;public bool muted;}
 static readonly Dictionary<string,SessionLease> savedSessions=new Dictionary<string,SessionLease>();
 static bool active=false;
 static readonly Guid context=new Guid("26841874-2ac0-4e29-9d42-49154cad535a");
 static IAudioEndpointVolume Volume(IMMDevice device){object obj;Guid id=typeof(IAudioEndpointVolume).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref id,23,IntPtr.Zero,out obj));return (IAudioEndpointVolume)obj;}
 static void Free(object obj){if(obj!=null&&Marshal.IsComObject(obj))Marshal.ReleaseComObject(obj);}
 static object Sessions(IMMDevice device,string endpoint,bool mute){object managerObject=null;IAudioSessionEnumerator list=null;var rows=new List<object>();
  try{Guid iid=typeof(IAudioSessionManager2).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref iid,23,IntPtr.Zero,out managerObject));Marshal.ThrowExceptionForHR(((IAudioSessionManager2)managerObject).GetSessionEnumerator(out list));int count;Marshal.ThrowExceptionForHR(list.GetCount(out count));
   for(int i=0;i<count;i++){IAudioSessionControl2 control=null;try{Marshal.ThrowExceptionForHR(list.GetSession(i,out control));int state;Marshal.ThrowExceptionForHR(control.GetState(out state));if(state==2)continue;
    IntPtr p;Marshal.ThrowExceptionForHR(control.GetSessionInstanceIdentifier(out p));string key;try{key=endpoint+"|"+Marshal.PtrToStringUni(p);}finally{Marshal.FreeCoTaskMem(p);}
    var volume=(ISimpleAudioVolume)control;bool original;float level;Marshal.ThrowExceptionForHR(volume.GetMute(out original));Marshal.ThrowExceptionForHR(volume.GetMasterVolume(out level));uint pid;Marshal.ThrowExceptionForHR(control.GetProcessId(out pid));
    if(mute){if(!savedSessions.ContainsKey(key)){savedSessions[key]=new SessionLease{control=control,muted=original};control=null;}Guid c=context;Marshal.ThrowExceptionForHR(volume.SetMute(true,ref c));}
    rows.Add(new {id=key,pid=pid,muted=mute||original,level=level});
   }finally{Free(control);}}
  }finally{Free(list);Free(managerObject);}return rows;
 }
 static object Read(bool mute){var rows=new List<object>();IMMDeviceEnumerator e=null;IMMDeviceCollection list=null;
  try{e=(IMMDeviceEnumerator)new MMDeviceEnumerator();Marshal.ThrowExceptionForHR(e.EnumAudioEndpoints(0,1,out list));uint count;Marshal.ThrowExceptionForHR(list.GetCount(out count));
   for(uint i=0;i<count;i++){IMMDevice d=null;IAudioEndpointVolume v=null;try{Marshal.ThrowExceptionForHR(list.Item(i,out d));string id;Marshal.ThrowExceptionForHR(d.GetId(out id));v=Volume(d);bool original;float level;Marshal.ThrowExceptionForHR(v.GetMute(out original));Marshal.ThrowExceptionForHR(v.GetMasterVolumeLevelScalar(out level));
    var sessions=Sessions(d,id,mute);if(mute){if(!saved.ContainsKey(id))saved[id]=original;Guid c=context;Marshal.ThrowExceptionForHR(v.SetMute(true,ref c));}rows.Add(new {id=id,muted=mute||original,level=level,sessions=sessions});
   }finally{Free(v);Free(d);}}
  }finally{Free(list);Free(e);}return rows;
 }
 static bool Restore(){active=false;
  foreach(string id in new List<string>(savedSessions.Keys)){var lease=savedSessions[id];try{int state;Marshal.ThrowExceptionForHR(lease.control.GetState(out state));if(state!=2){Guid c=context;Marshal.ThrowExceptionForHR(((ISimpleAudioVolume)lease.control).SetMute(lease.muted,ref c));}savedSessions.Remove(id);Free(lease.control);}catch{}}
  IMMDeviceEnumerator e=null;try{e=(IMMDeviceEnumerator)new MMDeviceEnumerator();foreach(string id in new List<string>(saved.Keys)){IMMDevice d=null;IAudioEndpointVolume v=null;try{Marshal.ThrowExceptionForHR(e.GetDevice(id,out d));v=Volume(d);Guid c=context;Marshal.ThrowExceptionForHR(v.SetMute(saved[id],ref c));saved.Remove(id);}catch{}finally{Free(v);Free(d);}}}finally{Free(e);}return saved.Count==0&&savedSessions.Count==0;}
 [MTAThread] static void Main(){Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=new UTF8Encoding(false);var json=new JavaScriptSerializer();
  // New output devices connected during dictation are covered as well.
  var timer=new Timer(_=>{lock(gate){if(active)try{Read(true);}catch{}}},null,100,100);
  try{string line;while((line=Console.ReadLine())!=null){int id=0;object result;lock(gate){try{var data=json.Deserialize<Dictionary<string,object>>(line);id=Convert.ToInt32(data["id"]);string cmd=(string)data["command"];
    if(cmd=="begin"){active=true;try{result=new {ok=true,devices=Read(true)};}catch{Restore();throw;}}
    else if(cmd=="end")result=new {ok=Restore()};else result=new {ok=true,devices=Read(false)};
   }catch(Exception ex){result=new {ok=false,message=ex.Message};}}Console.WriteLine(json.Serialize(new {id=id,result=result}));Console.Out.Flush();}
  }finally{timer.Dispose();lock(gate){for(int i=0;i<5&&!Restore();i++)Thread.Sleep(200);}}
 }
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator{}
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
 [ComImport,Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ISimpleAudioVolume{
  [PreserveSig]int SetMasterVolume(float level,ref Guid context);[PreserveSig]int GetMasterVolume(out float level);
  [PreserveSig]int SetMute([MarshalAs(UnmanagedType.Bool)]bool mute,ref Guid context);[PreserveSig]int GetMute([MarshalAs(UnmanagedType.Bool)]out bool mute);
 }
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDeviceEnumerator{
  [PreserveSig]int EnumAudioEndpoints(int flow,uint mask,out IMMDeviceCollection devices);
  [PreserveSig]int GetDefaultAudioEndpoint(int flow,int role,out IMMDevice device);
  [PreserveSig]int GetDevice([MarshalAs(UnmanagedType.LPWStr)]string id,out IMMDevice device);
 }
 [ComImport,Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDeviceCollection{
  [PreserveSig]int GetCount(out uint count);[PreserveSig]int Item(uint index,out IMMDevice device);
 }
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDevice{
  [PreserveSig]int Activate(ref Guid iid,uint context,IntPtr activation,[MarshalAs(UnmanagedType.IUnknown)]out object instance);
  [PreserveSig]int OpenPropertyStore(uint access,out IntPtr store);
  [PreserveSig]int GetId([MarshalAs(UnmanagedType.LPWStr)]out string id);
 }
 [ComImport,Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioEndpointVolume{
  [PreserveSig]int RegisterControlChangeNotify(IntPtr callback);
  [PreserveSig]int UnregisterControlChangeNotify(IntPtr callback);
  [PreserveSig]int GetChannelCount(out uint count);
  [PreserveSig]int SetMasterVolumeLevel(float db,ref Guid context);
  [PreserveSig]int SetMasterVolumeLevelScalar(float level,ref Guid context);
  [PreserveSig]int GetMasterVolumeLevel(out float db);
  [PreserveSig]int GetMasterVolumeLevelScalar(out float level);
  [PreserveSig]int SetChannelVolumeLevel(uint channel,float db,ref Guid context);
  [PreserveSig]int SetChannelVolumeLevelScalar(uint channel,float level,ref Guid context);
  [PreserveSig]int GetChannelVolumeLevel(uint channel,out float db);
  [PreserveSig]int GetChannelVolumeLevelScalar(uint channel,out float level);
  [PreserveSig]int SetMute([MarshalAs(UnmanagedType.Bool)]bool mute,ref Guid context);
  [PreserveSig]int GetMute([MarshalAs(UnmanagedType.Bool)]out bool mute);
 }
}
