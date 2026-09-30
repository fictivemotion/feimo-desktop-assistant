using System;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Windows.Automation;
using System.Windows.Automation.Text;
using System.Web.Script.Serialization;

// The helper owns only the captured selection / dictated span. Never selects a whole field.
class FeimoInput {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vkey);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] input, int size);
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION data; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public KEYBDINPUT key; [FieldOffset(0)] public MOUSEINPUT mouse; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort vk, scan; public uint flags, time; public UIntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx,dy; public uint mouseData,flags,time; public UIntPtr extra; }
  static AutomationElement target;
  static TextPattern pattern;
  static IntPtr foreground;
  static string prefix, suffix, owned, identity;
  static bool blocked=true;
  static JavaScriptSerializer json=new JavaScriptSerializer();
  static string Id(AutomationElement e) { return String.Join(".", Array.ConvertAll(e.GetRuntimeId(), v=>v.ToString())); }
  static string Read(){object fresh;if(!target.TryGetCurrentPattern(TextPattern.Pattern,out fresh))throw new Exception("输入框不再支持文本定位");pattern=(TextPattern)fresh;return pattern.DocumentRange.GetText(-1);}
  static bool ModifiersDown(){return (GetAsyncKeyState(0x11)&0x8000)!=0||(GetAsyncKeyState(0x12)&0x8000)!=0||(GetAsyncKeyState(0x10)&0x8000)!=0;}
  static object Capture(){
    for(int i=0;i<75&&ModifiersDown();i++)Thread.Sleep(20);
    if(ModifiersDown())throw new Exception("请松开快捷键后开始听写");
    Thread.Sleep(60);
    blocked=true; foreground=GetForegroundWindow(); target=AutomationElement.FocusedElement;
    if(target==null || target.Current.IsPassword || !target.Current.IsEnabled)throw new Exception("请先点击可编辑的输入框，再按语音快捷键");
    object value; if(!target.TryGetCurrentPattern(TextPattern.Pattern,out value))throw new Exception("这个输入框不支持安全听写定位，请尝试记事本、浏览器或其他文本编辑器");
    pattern=(TextPattern)value; object vp; if(target.TryGetCurrentPattern(ValuePattern.Pattern,out vp)&&((ValuePattern)vp).Current.IsReadOnly)throw new Exception("当前输入框是只读的");
    if(target.Current.ControlType!=ControlType.Edit && target.Current.ControlType!=ControlType.Document && vp==null)throw new Exception("请先选择可编辑的文本输入框");
    var selected=pattern.GetSelection(); if(selected.Length!=1)throw new Exception("不支持多处同时选择的输入框");
    var before=pattern.DocumentRange.Clone(); before.MoveEndpointByRange(TextPatternRangeEndpoint.End,selected[0],TextPatternRangeEndpoint.Start);
    var after=pattern.DocumentRange.Clone(); after.MoveEndpointByRange(TextPatternRangeEndpoint.Start,selected[0],TextPatternRangeEndpoint.End);
    prefix=before.GetText(-1);suffix=after.GetText(-1);owned=selected[0].GetText(-1);
    if((prefix+owned+suffix).Length>200000)throw new Exception("当前文档过长，请在较短的输入框中听写");
    if(Read()!=prefix+owned+suffix)throw new Exception("无法精确定位输入位置，请重新点击输入框");
    identity=Id(target);blocked=false;return new {ok=true};
  }
  static void Verify(){
    if(blocked)throw new Exception("输入位置已失效，结果会保留并复制到剪贴板");
    var focused=AutomationElement.FocusedElement;
    if(GetForegroundWindow()!=foreground||focused==null||Id(focused)!=identity||Read()!=prefix+owned+suffix)throw new Exception("输入框已切换或被编辑，已停止自动写入");
    var selected=pattern.GetSelection();if(selected.Length!=1)throw new Exception("输入位置发生变化");
    var before=pattern.DocumentRange.Clone();before.MoveEndpointByRange(TextPatternRangeEndpoint.End,selected[0],TextPatternRangeEndpoint.Start);
    var current=before.GetText(-1);
    if(!((current==prefix+owned&&selected[0].GetText(-1)=="")||(current==prefix&&selected[0].GetText(-1)==owned)))throw new Exception("光标已移动，已停止自动替换");
  }
  static INPUT Key(char c,uint flags){return new INPUT{type=1,data=new UNION{key=new KEYBDINPUT{scan=(ushort)c,flags=flags}}};}
  static object Update(string text){
    try{
      Verify();if(text==owned)return new {ok=true};
      for(int i=0;i<25 && ((GetAsyncKeyState(0x11)&0x8000)!=0||(GetAsyncKeyState(0x12)&0x8000)!=0||(GetAsyncKeyState(0x10)&0x8000)!=0);i++)Thread.Sleep(20);
      if((GetAsyncKeyState(0x11)&0x8000)!=0||(GetAsyncKeyState(0x12)&0x8000)!=0||(GetAsyncKeyState(0x10)&0x8000)!=0)throw new Exception("请松开快捷键后继续说话");
      Verify();
      var range=pattern.DocumentRange.Clone(); range.MoveEndpointByRange(TextPatternRangeEndpoint.End,range,TextPatternRangeEndpoint.Start);
      range.MoveEndpointByUnit(TextPatternRangeEndpoint.End,TextUnit.Character,prefix.Length+owned.Length);
      range.MoveEndpointByUnit(TextPatternRangeEndpoint.Start,TextUnit.Character,prefix.Length);
      if(range.GetText(-1)!=owned)throw new Exception("输入范围校验失败，已停止替换");
      range.Select();
      // Recheck focus and full text after selection; this operation never touches the clipboard.
      if(GetForegroundWindow()!=foreground||Read()!=prefix+owned+suffix||Id(AutomationElement.FocusedElement)!=identity)throw new Exception("输入框已变化");
      var keys=new INPUT[text.Length*2+(text.Length==0?2:0)];
      if(text.Length==0){keys[0]=new INPUT{type=1,data=new UNION{key=new KEYBDINPUT{vk=8}}};keys[1]=keys[0];keys[1].data.key.flags=2;}
      else for(int i=0;i<text.Length;i++){keys[i*2]=Key(text[i],4);keys[i*2+1]=Key(text[i],6);}
      if(SendInput((uint)keys.Length,keys,Marshal.SizeOf(typeof(INPUT)))!=(uint)keys.Length)throw new Exception("系统阻止了写入，请检查目标程序是否以管理员身份运行");
      string expected=prefix+text+suffix;bool matched=false;
      for(int i=0;i<35;i++){Thread.Sleep(10);if(Read()==expected){matched=true;break;}}
      if(!matched)throw new Exception("目标程序未确认写入，已停止后续替换");
      owned=text;return new {ok=true};
    }catch(Exception e){blocked=true;return new {ok=false,message=e.Message};}
  }
  [STAThread] static void Main(){
    Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=new UTF8Encoding(false);json.MaxJsonLength=1000000;
    string line;while((line=Console.ReadLine())!=null){int id=0;object result;
      try{var data=json.Deserialize<System.Collections.Generic.Dictionary<string,object>>(line);id=Convert.ToInt32(data["id"]);string command=(string)data["command"];
        if(command=="capture")result=Capture();else if(command=="update")result=Update((string)data["text"]);else{blocked=true;target=null;pattern=null;prefix=suffix=owned=null;result=new {ok=true};}
      }catch(Exception e){blocked=true;result=new {ok=false,message=e.Message};}
      Console.WriteLine(json.Serialize(new {id=id,result=result}));Console.Out.Flush();
    }
  }
}
