using System;using System.Diagnostics;using System.Runtime.InteropServices;
class ModifierShortcut {
 delegate IntPtr Hook(int code,IntPtr message,IntPtr data);
 [StructLayout(LayoutKind.Sequential)]struct KEY{public uint vk,scan,flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Sequential)]struct POINT{public int x,y;}
 [StructLayout(LayoutKind.Sequential)]struct MSG{public IntPtr hwnd;public uint message;public UIntPtr w;public IntPtr l;public uint time;public POINT point;public uint extra;}
 [DllImport("user32.dll")]static extern IntPtr SetWindowsHookEx(int id,Hook hook,IntPtr module,uint thread);
 [DllImport("user32.dll")]static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
 [DllImport("user32.dll")]static extern bool UnhookWindowsHookEx(IntPtr hook);
 [DllImport("user32.dll")]static extern int GetMessage(out MSG message,IntPtr hwnd,uint min,uint max);
 [DllImport("user32.dll")]static extern bool TranslateMessage(ref MSG message);
 [DllImport("user32.dll")]static extern IntPtr DispatchMessage(ref MSG message);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern IntPtr GetModuleHandle(string name);
 static IntPtr handle;static Hook callback=OnKey;static bool ctrl,alt,candidate,invalid;static long start,last=-1000;static Stopwatch clock=Stopwatch.StartNew();
 static IntPtr OnKey(int code,IntPtr message,IntPtr data){
  if(code>=0){var k=(KEY)Marshal.PtrToStructure(data,typeof(KEY));bool down=message.ToInt32()==0x100||message.ToInt32()==0x104;bool up=message.ToInt32()==0x101||message.ToInt32()==0x105;bool control=k.vk==0x11||k.vk==0xA2||k.vk==0xA3;bool menu=k.vk==0x12||k.vk==0xA4||k.vk==0xA5;
   if(down){if(control)ctrl=true;else if(menu){alt=true;if(k.vk==0xA5||(k.flags&1)!=0)invalid=true;}else if(ctrl||alt)invalid=true;
    if(ctrl&&alt&&!candidate){candidate=true;start=clock.ElapsedMilliseconds;} }
   if(up){if(control)ctrl=false;if(menu)alt=false;if(!ctrl&&!alt){long now=clock.ElapsedMilliseconds;if(candidate&&!invalid&&now-start>=25&&now-start<2000&&now-last>250){last=now;Console.WriteLine("toggle");Console.Out.Flush();}candidate=false;invalid=false;}}
  }
  // Observes the chord only. Never consumes keys or changes the normal keyboard / IME flow.
  return CallNextHookEx(handle,code,message,data);
 }
 static void Main(){handle=SetWindowsHookEx(13,callback,GetModuleHandle(Process.GetCurrentProcess().MainModule.ModuleName),0);if(handle==IntPtr.Zero){Console.WriteLine("error");return;}Console.WriteLine("ready");Console.Out.Flush();MSG m;try{while(GetMessage(out m,IntPtr.Zero,0,0)>0){TranslateMessage(ref m);DispatchMessage(ref m);}}finally{UnhookWindowsHookEx(handle);}}
}
