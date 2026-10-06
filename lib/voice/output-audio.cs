using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Web.Script.Serialization;

// A pipe-scoped mute lease. Never change volume, default device, or microphone state.
class FeimoOutputAudio {
 static readonly object gate=new object();
 static readonly Dictionary<string,bool> saved=new Dictionary<string,bool>();
 static bool active=false;
 static readonly Guid context=new Guid("26841874-2ac0-4e29-9d42-49154cad535a");
 static IAudioEndpointVolume Volume(IMMDevice device){object obj;Guid id=typeof(IAudioEndpointVolume).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref id,23,IntPtr.Zero,out obj));return (IAudioEndpointVolume)obj;}
 static void Free(object obj){if(obj!=null&&Marshal.IsComObject(obj))Marshal.ReleaseComObject(obj);}
 static object Read(bool mute){var rows=new List<object>();IMMDeviceEnumerator e=null;IMMDeviceCollection list=null;
  try{e=(IMMDeviceEnumerator)new MMDeviceEnumerator();Marshal.ThrowExceptionForHR(e.EnumAudioEndpoints(0,1,out list));uint count;Marshal.ThrowExceptionForHR(list.GetCount(out count));
   for(uint i=0;i<count;i++){IMMDevice d=null;IAudioEndpointVolume v=null;try{Marshal.ThrowExceptionForHR(list.Item(i,out d));string id;Marshal.ThrowExceptionForHR(d.GetId(out id));v=Volume(d);bool original;float level;Marshal.ThrowExceptionForHR(v.GetMute(out original));Marshal.ThrowExceptionForHR(v.GetMasterVolumeLevelScalar(out level));
    if(mute){if(!saved.ContainsKey(id))saved[id]=original;Guid c=context;Marshal.ThrowExceptionForHR(v.SetMute(true,ref c));}rows.Add(new {id=id,muted=mute||original,level=level});
   }finally{Free(v);Free(d);}}
  }finally{Free(list);Free(e);}return rows;
 }
 static bool Restore(){active=false;IMMDeviceEnumerator e=null;try{e=(IMMDeviceEnumerator)new MMDeviceEnumerator();foreach(string id in new List<string>(saved.Keys)){IMMDevice d=null;IAudioEndpointVolume v=null;try{Marshal.ThrowExceptionForHR(e.GetDevice(id,out d));v=Volume(d);Guid c=context;Marshal.ThrowExceptionForHR(v.SetMute(saved[id],ref c));saved.Remove(id);}catch{}finally{Free(v);Free(d);}}}finally{Free(e);}return saved.Count==0;}
 [MTAThread] static void Main(){Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=new UTF8Encoding(false);var json=new JavaScriptSerializer();
  // New output devices connected during dictation are covered as well.
  var timer=new Timer(_=>{lock(gate){if(active)try{Read(true);}catch{}}},null,500,500);
  try{string line;while((line=Console.ReadLine())!=null){int id=0;object result;lock(gate){try{var data=json.Deserialize<Dictionary<string,object>>(line);id=Convert.ToInt32(data["id"]);string cmd=(string)data["command"];
    if(cmd=="begin"){active=true;try{result=new {ok=true,devices=Read(true)};}catch{Restore();throw;}}
    else if(cmd=="end")result=new {ok=Restore()};else result=new {ok=true,devices=Read(false)};
   }catch(Exception ex){result=new {ok=false,message=ex.Message};}}Console.WriteLine(json.Serialize(new {id=id,result=result}));Console.Out.Flush();}
  }finally{timer.Dispose();lock(gate){for(int i=0;i<5&&!Restore();i++)Thread.Sleep(200);}}
 }
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator{}
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
