using System;using System.Diagnostics;using System.Runtime.InteropServices;using System.Threading;
// Read key state only; never join a remote application's low-level keyboard hook
// chain, consume injected events, or synthesize modifier releases.
class ModifierShortcut {
 [DllImport("user32.dll")]static extern short GetAsyncKeyState(int key);
 internal sealed class Chord {
  bool candidate,invalid,held;long start,last=-1000;
  internal bool Step(bool ctrl,bool alt,bool other,long now){
   if(ctrl||alt){
    if(!held){held=true;invalid=other;}invalid|=other;
    if(ctrl&&alt&&!candidate){candidate=true;start=now;}return false;
   }
   bool toggle=held&&candidate&&!invalid&&now-start>=25&&now-start<2000&&now-last>250;
   held=candidate=invalid=false;if(toggle)last=now;return toggle;
  }
 }
 static bool Down(int key){return (GetAsyncKeyState(key)&0x8000)!=0;}
 static void Main(){
  var chord=new Chord();var clock=Stopwatch.StartNew();
  bool initial=Down(0x11)||Down(0x12);
  Console.WriteLine("ready");Console.Out.Flush();
  while(true){
   bool ctrl=Down(0x11),alt=Down(0x12),other=initial||Down(0xA5)||Down(0x10)||Down(0x5B)||Down(0x5C);
   if(ctrl||alt){for(int key=8;key<=254&&!other;key++){
    if(key==0x10||key==0x11||key==0x12||(key>=0xA0&&key<=0xA5))continue;
    other=Down(key);
   }}else initial=false;
   if(chord.Step(ctrl,alt,other,clock.ElapsedMilliseconds)){Console.WriteLine("toggle");Console.Out.Flush();}
   Thread.Sleep(10);
  }
 }
}
