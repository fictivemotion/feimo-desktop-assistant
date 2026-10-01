using System;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Windows.Automation;
using System.Windows.Automation.Text;
using System.Web.Script.Serialization;

// Only the captured span can change. Both native and Chromium controls receive real keyboard input
// so controlled rich editors update their internal model. No clipboard pastes or Ctrl+A.
class FeimoInput {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd,out uint pid);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vkey);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] input, int size);
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION data; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public KEYBDINPUT key; [FieldOffset(0)] public MOUSEINPUT mouse; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort vk, scan; public uint flags, time; public UIntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx,dy; public uint mouseData,flags,time; public UIntPtr extra; }
  static AutomationElement target;
  static TextPattern pattern;
  static IntPtr foreground;
  static string prefix, suffix, owned, identity, framework, automationId;
  static uint ownerPid;
  static System.Windows.Rect editorBounds;
  static string awaitingOwned, awaitingTail;
  static bool emptyParagraph;
  static bool blocked=true;
  static JavaScriptSerializer json=new JavaScriptSerializer();
  static string Id(AutomationElement e) { return String.Join(".", Array.ConvertAll(e.GetRuntimeId(), v=>v.ToString())); }
  static string Canonical(string s){return s.Replace("\r\n","\n").Replace("\r","\n");}
  static string Read(){object fresh;if(!target.TryGetCurrentPattern(TextPattern.Pattern,out fresh))throw new Exception("输入框不再支持文本定位");pattern=(TextPattern)fresh;object value;return Canonical(target.TryGetCurrentPattern(ValuePattern.Pattern,out value)?((ValuePattern)value).Current.Value:pattern.DocumentRange.GetText(-1));}
  internal static bool TextMatches(string actual,string expected,bool virtualParagraph){return actual==expected||(virtualParagraph&&actual==expected+"\n");}
  static bool Matches(string expected){return TextMatches(Read(),expected,emptyParagraph);}
  static AutomationElement Editor(AutomationElement focused){
    for(int i=0;i<4&&focused!=null;i++){
      object p,v;bool writableValue=focused.TryGetCurrentPattern(ValuePattern.Pattern,out v)&&!((ValuePattern)v).Current.IsReadOnly;
      if((focused.Current.ControlType==ControlType.Edit||focused.Current.ControlType==ControlType.Document||writableValue)&&focused.TryGetCurrentPattern(TextPattern.Pattern,out p))return focused;
      focused=TreeWalker.RawViewWalker.GetParent(focused);
    }
    return null;
  }
  static void RefreshFocus(){
    if(GetForegroundWindow()!=foreground)throw new Exception("前台程序已切换，已停止自动写入");
    var focused=Editor(AutomationElement.FocusedElement);
    if(focused==null||focused.Current.ProcessId!=ownerPid||focused.Current.IsPassword||!focused.Current.IsEnabled)throw new Exception("输入框已切换，已停止自动写入");
    var nextId=Id(focused);
    if(nextId!=identity){
      // Chromium/Flutter may recreate the accessibility node when an empty composer
      // gains content or grows. Require the same editor geometry and descriptor;
      // full document and caret ownership are checked separately before every write.
      var b=focused.Current.BoundingRectangle;
      bool sameBox=!b.IsEmpty&&!editorBounds.IsEmpty&&Math.Abs(b.Left-editorBounds.Left)<8&&Math.Abs(b.Width-editorBounds.Width)<8&&(Math.Abs(b.Top-editorBounds.Top)<8||Math.Abs(b.Bottom-editorBounds.Bottom)<8);
      if(!sameBox||focused.Current.FrameworkId!=framework||focused.Current.AutomationId!=automationId)throw new Exception("输入框已切换，已停止自动写入");
    }
    target=focused;identity=nextId;editorBounds=focused.Current.BoundingRectangle;
  }
  static bool ModifiersDown(){return (GetAsyncKeyState(0x11)&0x8000)!=0||(GetAsyncKeyState(0x12)&0x8000)!=0||(GetAsyncKeyState(0x10)&0x8000)!=0;}
  static object Capture(){
    for(int i=0;i<75&&ModifiersDown();i++)Thread.Sleep(20);
    if(ModifiersDown())throw new Exception("请松开快捷键后开始听写");
    Thread.Sleep(60);
    blocked=true;emptyParagraph=false;awaitingOwned=awaitingTail=null; foreground=GetForegroundWindow(); target=Editor(AutomationElement.FocusedElement);
    uint foregroundPid;GetWindowThreadProcessId(foreground,out foregroundPid);
    if(target==null || target.Current.IsPassword || !target.Current.IsEnabled || target.Current.ProcessId!=foregroundPid)throw new Exception("请先点击前台程序中的可编辑输入框，再按语音快捷键");
    object value; if(!target.TryGetCurrentPattern(TextPattern.Pattern,out value))throw new Exception("这个输入框不支持安全听写定位，请尝试记事本、浏览器或其他文本编辑器");
    pattern=(TextPattern)value; object vp; if(target.TryGetCurrentPattern(ValuePattern.Pattern,out vp)&&((ValuePattern)vp).Current.IsReadOnly)throw new Exception("当前输入框是只读的");
    if(target.Current.ControlType!=ControlType.Edit && target.Current.ControlType!=ControlType.Document && vp==null)throw new Exception("请先选择可编辑的文本输入框");
    var selected=pattern.GetSelection(); if(selected.Length!=1)throw new Exception("不支持多处同时选择的输入框");
    var before=pattern.DocumentRange.Clone(); before.MoveEndpointByRange(TextPatternRangeEndpoint.End,selected[0],TextPatternRangeEndpoint.Start);
    var after=pattern.DocumentRange.Clone(); after.MoveEndpointByRange(TextPatternRangeEndpoint.Start,selected[0],TextPatternRangeEndpoint.End);
    prefix=Canonical(before.GetText(-1));suffix=Canonical(after.GetText(-1));owned=Canonical(selected[0].GetText(-1));
    // Some Chromium providers retain the virtual paragraph newline after the first
    // keystroke. Match it against the expected owned text for the whole session.
    emptyParagraph=target.Current.FrameworkId=="Chrome"&&prefix==""&&owned==""&&suffix=="\n"&&(Read()=="\n"||Read()=="");
    if(emptyParagraph)suffix="";
    if((prefix+owned+suffix).Length>200000)throw new Exception("当前文档过长，请在较短的输入框中听写");
    if(!Matches(prefix+owned+suffix))throw new Exception("无法精确定位输入位置，请重新点击输入框");
    if(target.Current.FrameworkId=="Chrome"&&(prefix+owned+suffix).IndexOf('\uFFFC')>=0)throw new Exception("当前输入框包含嵌入对象，请使用纯文本输入框听写");
    identity=Id(target);framework=target.Current.FrameworkId;automationId=target.Current.AutomationId;ownerPid=foregroundPid;editorBounds=target.Current.BoundingRectangle;blocked=false;return new {ok=true};
  }
  static object Probe(){var e=AutomationElement.FocusedElement;object p;uint fp;GetWindowThreadProcessId(GetForegroundWindow(),out fp);return new {type=e.Current.ControlType.ProgrammaticName,framework=e.Current.FrameworkId,cls=e.Current.ClassName,pid=e.Current.ProcessId,foregroundPid=fp,textPattern=e.TryGetCurrentPattern(TextPattern.Pattern,out p),valuePattern=e.TryGetCurrentPattern(ValuePattern.Pattern,out p),length=target==null?-1:Read().Length,trailingLine=target!=null&&Read().EndsWith("\n"),prefixLength=prefix==null?-1:prefix.Length,suffixLength=suffix==null?-1:suffix.Length,ownedLength=owned==null?-1:owned.Length};}
  static void Verify(){
    if(blocked)throw new Exception("输入位置已失效，结果会保留并复制到剪贴板");
    RefreshFocus();
    if(!Matches(prefix+owned+suffix))throw new Exception("输入框已被编辑，已停止自动写入");
    var selected=pattern.GetSelection();if(selected.Length!=1)throw new Exception("输入位置发生变化");
    var before=pattern.DocumentRange.Clone();before.MoveEndpointByRange(TextPatternRangeEndpoint.End,selected[0],TextPatternRangeEndpoint.Start);
    var current=Canonical(before.GetText(-1));var selection=Canonical(selected[0].GetText(-1));
    if(!((current==prefix+owned&&selection=="")||(current==prefix&&selection==owned)))throw new Exception("光标已移动，已停止自动替换");
  }
  static INPUT Key(char c,uint flags){return new INPUT{type=1,data=new UNION{key=new KEYBDINPUT{scan=(ushort)c,flags=flags}}};}
  static INPUT Virtual(ushort vk,uint flags){return new INPUT{type=1,data=new UNION{key=new KEYBDINPUT{vk=vk,flags=flags}}};}
  static bool Boundary(string value,int index){return index==0||index==value.Length||Array.IndexOf(System.Globalization.StringInfo.ParseCombiningCharacters(value),index)>=0;}
  static int Units(string text){return new System.Globalization.StringInfo(text).LengthInTextElements;}
  static bool ConfirmPending(){
    if(awaitingOwned==null)return true;
    for(int i=0;i<60;i++){
      RefreshFocus();
      try{if(Matches(prefix+awaitingOwned+suffix)){
        if(awaitingTail.Length>0){var caret=pattern.GetSelection()[0].Clone();caret.MoveEndpointByUnit(TextPatternRangeEndpoint.Start,TextUnit.Character,Units(awaitingTail));caret.MoveEndpointByRange(TextPatternRangeEndpoint.End,caret,TextPatternRangeEndpoint.Start);caret.Select();}
        owned=awaitingOwned;awaitingOwned=awaitingTail=null;return true;
      }}catch(ElementNotAvailableException){}
      Thread.Sleep(20);
    }
    return false;
  }
  static void SendKeys(System.Collections.Generic.List<INPUT> list){
    // Small batches let editors consume long additions without dropping a flood of
    // Unicode events. Unchanged text is never selected or retyped on normal growth.
    for(int start=0;start<list.Count;){
      int count=Math.Min(64,list.Count-start);
      // Never leave Shift held across a batch boundary for a rich-editor line break.
      while(count<list.Count-start&&list[start+count-1].data.key.vk==13)count++;
      var keys=list.GetRange(start,count).ToArray();
      if(SendInput((uint)keys.Length,keys,Marshal.SizeOf(typeof(INPUT)))!=(uint)keys.Length)throw new Exception("系统阻止了写入，请检查目标程序是否以管理员身份运行");
      start+=count;if(start<list.Count)Thread.Sleep(4);
    }
  }
  static object Update(string text){
    try{
      if(!ConfirmPending())return new {ok=false,retryable=true,message="等待输入框确认写入，仍在听写"};
      Verify();if(text==owned)return new {ok=true};
      for(int i=0;i<25 && ((GetAsyncKeyState(0x11)&0x8000)!=0||(GetAsyncKeyState(0x12)&0x8000)!=0||(GetAsyncKeyState(0x10)&0x8000)!=0);i++)Thread.Sleep(20);
      if((GetAsyncKeyState(0x11)&0x8000)!=0||(GetAsyncKeyState(0x12)&0x8000)!=0||(GetAsyncKeyState(0x10)&0x8000)!=0)throw new Exception("请松开快捷键后继续说话");
      Verify();
      // Preserve unchanged text. Normal recognition growth is a direct append, without selection or retyping.
      int start=0;while(start<owned.Length&&start<text.Length&&owned[start]==text[start])start++;
      while(start>0&&(!Boundary(owned,start)||!Boundary(text,start)))start--;
      int tail=0;while(tail<owned.Length-start&&tail<text.Length-start&&owned[owned.Length-1-tail]==text[text.Length-1-tail])tail++;
      while(tail>0&&(!Boundary(owned,owned.Length-tail)||!Boundary(text,text.Length-tail)))tail--;
      string previous=owned.Substring(start,owned.Length-start-tail),replacement=text.Substring(start,text.Length-start-tail),retained=owned.Substring(owned.Length-tail);
      var range=pattern.GetSelection()[0].Clone();
      bool selection=Canonical(range.GetText(-1))!="";
      if(selection)range.MoveEndpointByUnit(TextPatternRangeEndpoint.Start,TextUnit.Character,Units(owned.Substring(0,start)));
      else if(previous.Length+retained.Length>0)range.MoveEndpointByUnit(TextPatternRangeEndpoint.Start,TextUnit.Character,-Units(previous+retained));
      if(tail>0)range.MoveEndpointByUnit(TextPatternRangeEndpoint.End,TextUnit.Character,-Units(retained));
      if(Canonical(range.GetText(-1))!=previous)throw new Exception("输入范围校验失败，已停止替换");
      if(selection||previous.Length>0||tail>0)range.Select();
      // Recheck focus and full text after selection; this operation never touches the clipboard.
      RefreshFocus();if(!Matches(prefix+owned+suffix))throw new Exception("输入框已变化");
      var list=new System.Collections.Generic.List<INPUT>();
      if(replacement.Length==0&&previous.Length>0){list.Add(Virtual(8,0));list.Add(Virtual(8,2));}
      else foreach(char c in replacement){
        if(c=='\n'&&target.Current.FrameworkId=="Chrome"){
          // Shift+Enter inserts a line break without submitting a chat composer.
          list.Add(Virtual(16,0));list.Add(Virtual(13,0));list.Add(Virtual(13,2));list.Add(Virtual(16,2));
        }else{list.Add(Key(c,4));list.Add(Key(c,6));}
      }
      SendKeys(list);awaitingOwned=text;awaitingTail=retained;
      if(!ConfirmPending())return new {ok=false,retryable=true,message="等待输入框确认写入，仍在听写"};
      return new {ok=true};
    }catch(ElementNotAvailableException){return new {ok=false,retryable=true,message="输入框正在更新，正在重新确认写入"};}
    catch(Exception e){blocked=true;return new {ok=false,retryable=false,message=e.Message};}
  }
  [STAThread] static void Main(){
    Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=new UTF8Encoding(false);json.MaxJsonLength=1000000;
    string line;while((line=Console.ReadLine())!=null){int id=0;object result;
      try{var data=json.Deserialize<System.Collections.Generic.Dictionary<string,object>>(line);id=Convert.ToInt32(data["id"]);string command=(string)data["command"];
        if(command=="probe")result=Probe();else if(command=="capture")result=Capture();else if(command=="update")result=Update((string)data["text"]);else{blocked=true;target=null;pattern=null;prefix=suffix=owned=null;result=new {ok=true};}
      }catch(Exception e){blocked=true;result=new {ok=false,message=e.Message};}
      Console.WriteLine(json.Serialize(new {id=id,result=result}));Console.Out.Flush();
    }
  }
}
