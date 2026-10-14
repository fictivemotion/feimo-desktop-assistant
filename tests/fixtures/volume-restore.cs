using System;
using System.Collections.Generic;
class VolumeRestoreRegression {
 class Session:FeimoOutputAudio.ISimpleAudioVolume {
  public float level=.06f;public bool muted=true;public List<string> events=new List<string>();
  public int SetMasterVolume(float value,ref Guid context){events.Add("volume");level=value;return 0;}public int GetMasterVolume(out float value){value=level;return 0;}
  public int SetMute(bool value,ref Guid context){events.Add("mute");muted=value;return 0;}public int GetMute(out bool value){value=muted;return 0;}
 }
 static void Check(bool ok,string scenario){if(!ok)throw new Exception(scenario);}
 static void Main(){
  var isolated=new Session{level=.8f,muted=false};FeimoOutputAudio.MuteSession(isolated);FeimoOutputAudio.MuteSession(isolated);Check(isolated.muted&&Math.Abs(isolated.level-.8f)<.0001f,"isolation never lowers volume");Check(String.Join(",",isolated.events)=="mute","repeated polling does not repeat mute writes");
  var preMuted=new Session{level=.3f,muted=true};FeimoOutputAudio.MuteSession(preMuted);Check(preMuted.events.Count==0,"already muted session is untouched");
  var session=new Session();FeimoOutputAudio.RestoreSession(session,new FeimoOutputAudio.SessionLease{level=.45f,muted=false});Check(Math.Abs(session.level-.45f)<.0001f&&!session.muted,"restore application-session volume");Check(String.Join(",",session.events)=="volume,mute","restore session level before mute switch");
  Console.WriteLine("volume lease restoration passed; no real audio devices touched");
 }
}
