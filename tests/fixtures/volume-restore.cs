using System;
using System.Collections.Generic;
class VolumeRestoreRegression {
 class Endpoint:FeimoOutputAudio.IAudioEndpointVolume {
  public float level=.06f;public bool muted=true,fail=false;public List<string> events=new List<string>();
  public int GetMasterVolumeLevelScalar(out float value){value=level;return 0;}
  public int SetMasterVolumeLevelScalar(float value,ref Guid context){if(fail){fail=false;return unchecked((int)0x80004005);}events.Add("volume");level=value;return 0;}
  public int SetMute(bool value,ref Guid context){events.Add("mute");muted=value;return 0;}public int GetMute(out bool value){value=muted;return 0;}
  public int RegisterControlChangeNotify(IntPtr callback){return 0;}public int UnregisterControlChangeNotify(IntPtr callback){return 0;}public int GetChannelCount(out uint count){count=2;return 0;}
  public int SetMasterVolumeLevel(float level,ref Guid context){return 0;}public int GetMasterVolumeLevel(out float level){level=0;return 0;}
  public int SetChannelVolumeLevel(uint channel,float level,ref Guid context){return 0;}public int SetChannelVolumeLevelScalar(uint channel,float level,ref Guid context){return 0;}
  public int GetChannelVolumeLevel(uint channel,out float level){level=0;return 0;}public int GetChannelVolumeLevelScalar(uint channel,out float level){level=0;return 0;}
 }
 class Session:FeimoOutputAudio.ISimpleAudioVolume {
  public float level=.06f;public bool muted=true;public List<string> events=new List<string>();
  public int SetMasterVolume(float value,ref Guid context){events.Add("volume");level=value;return 0;}public int GetMasterVolume(out float value){value=level;return 0;}
  public int SetMute(bool value,ref Guid context){events.Add("mute");muted=value;return 0;}public int GetMute(out bool value){value=muted;return 0;}
 }
 static void Check(bool ok,string scenario){if(!ok)throw new Exception(scenario);}
 static void Main(){
  var original=FeimoOutputAudio.RememberEndpoint("speakers",false,.8f,true);
  Check(Object.ReferenceEquals(original,FeimoOutputAudio.RememberEndpoint("speakers",true,.06f,true)),"poll must preserve first snapshot");
  var speaker=new Endpoint();FeimoOutputAudio.RestoreEndpoint(speaker,original);Check(Math.Abs(speaker.level-.8f)<.0001f&&!speaker.muted,"restore 6 percent to original 80 percent");Check(String.Join(",",speaker.events)=="volume,mute","restore volume before unmuting");
  var preMuted=new Endpoint();FeimoOutputAudio.RestoreEndpoint(preMuted,new FeimoOutputAudio.EndpointLease{level=.3f,muted=true,output=true});Check(preMuted.muted&&Math.Abs(preMuted.level-.3f)<.0001f,"preserve pre-existing mute");
  var microphone=new Endpoint();FeimoOutputAudio.RestoreEndpoint(microphone,new FeimoOutputAudio.EndpointLease{level=.7f,output=false});Check(microphone.muted&&Math.Abs(microphone.level-.7f)<.0001f,"restore microphone gain without changing its mute switch");
  var session=new Session();FeimoOutputAudio.RestoreSession(session,new FeimoOutputAudio.SessionLease{level=.45f,muted=false});Check(Math.Abs(session.level-.45f)<.0001f&&!session.muted,"restore application-session volume");Check(String.Join(",",session.events)=="volume,mute","restore session level before mute switch");
  var retry=new Endpoint{fail=true};bool threw=false;try{FeimoOutputAudio.RestoreEndpoint(retry,original);}catch{threw=true;}Check(threw,"failed level restore must be reported");FeimoOutputAudio.RestoreEndpoint(retry,original);Check(Math.Abs(retry.level-.8f)<.0001f,"retry retains original level");
  Console.WriteLine("volume lease restoration passed; no real audio devices touched");
 }
}
