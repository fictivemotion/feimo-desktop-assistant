using System;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;

// Read-only compatibility probe for NetEase 3.x. No DLL injection or process writes.
// The MOVSD playback-clock signature is documented by YUCLing/netease-watcher.
public static class FeimoNeteaseProgress {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr h,IntPtr address,byte[] data,IntPtr size,out IntPtr read);
 static int cachedPid;static long clockAddress;static DateTime nextProbe=DateTime.MinValue;
 public static double Read(){
  if(clockAddress!=0){var value=ReadClock(cachedPid,clockAddress);if(value>=0)return value;clockAddress=0;}
  if(DateTime.UtcNow<nextProbe)return -1;nextProbe=DateTime.UtcNow.AddSeconds(15);
  foreach(var process in Process.GetProcessesByName("cloudmusic"))try{
   foreach(ProcessModule module in process.Modules){if(!module.ModuleName.Equals("cloudmusic.dll",StringComparison.OrdinalIgnoreCase))continue;
    using(var file=new FileStream(module.FileName,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete))using(var reader=new BinaryReader(file)){
     if(reader.ReadUInt16()!=0x5A4D)continue;file.Position=0x3C;int pe=reader.ReadInt32();if(pe<64||pe>file.Length-24)continue;file.Position=pe;if(reader.ReadUInt32()!=0x4550)continue;
     if(reader.ReadUInt16()!=0x8664)continue;int sections=reader.ReadUInt16();file.Position=pe+20;int optional=reader.ReadUInt16();long table=pe+24+optional;
     for(int section=0;section<Math.Min(sections,32);section++){
      file.Position=table+section*40;var name=System.Text.Encoding.ASCII.GetString(reader.ReadBytes(8)).TrimEnd('\0');uint virtualSize=reader.ReadUInt32(),virtualRva=reader.ReadUInt32(),rawSize=reader.ReadUInt32(),rawOffset=reader.ReadUInt32();
      if(name!=".text"||rawSize>32*1024*1024||rawOffset+rawSize>file.Length)continue;file.Position=rawOffset;var code=reader.ReadBytes((int)rawSize);
      for(int i=0;i<code.Length-12;i++)if(code[i]==0xF2&&code[i+1]==0x0F&&code[i+2]==0x11&&code[i+3]==0x3D&&code[i+8]==0xF2&&code[i+9]==0x0F&&code[i+10]==0x11&&code[i+11]==0x35){
       long rva=(long)virtualRva+i+8+BitConverter.ToInt32(code,i+4);if(rva<0||rva>module.ModuleMemorySize-8)continue;long address=module.BaseAddress.ToInt64()+rva;double value=ReadClock(process.Id,address);if(value<0)continue;cachedPid=process.Id;clockAddress=address;return value;
      }
     }
    }
   }
  }catch{}finally{process.Dispose();}
  return -1;
 }
 static double ReadClock(int pid,long address){var h=OpenProcess(0x410,false,pid);if(h==IntPtr.Zero)return -1;try{var data=new byte[8];IntPtr read;if(!ReadProcessMemory(h,new IntPtr(address),data,new IntPtr(8),out read)||read.ToInt64()!=8)return -1;double value=BitConverter.ToDouble(data,0);return !double.IsNaN(value)&&!double.IsInfinity(value)&&value>=0&&value<=86400?value:-1;}finally{CloseHandle(h);}}
}
