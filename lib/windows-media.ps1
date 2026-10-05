Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
$taskMethod=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1)
function Await-Operation($operation,$resultType){$task=$taskMethod.MakeGenericMethod($resultType).Invoke($null,@($operation));if(!$task.Wait(5000)){throw 'Media session timeout'};return $task.Result}
try{$manager=Await-Operation ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])}catch{$manager=$null}
while($null -ne ($line=[Console]::ReadLine())){
  try{
    $request=$line | ConvertFrom-Json
    if(!$manager){throw 'Windows media session unavailable'}
    $sessions=@($manager.GetSessions());$session=$sessions | Where-Object { $_.SourceAppUserModelId -match '(?i)cloudmusic|netease|orpheus' } | Select-Object -First 1
    if(!$session -and $request.player -eq 'system'){$session=$manager.GetCurrentSession()}
    if(!$session){$result=@{available=$false;message='打开网易云音乐并播放歌曲后，音乐药丸会自动连接';sessions=@($sessions | ForEach-Object {$_.SourceAppUserModelId})}}
    else{
      switch($request.command){
        'toggle'{$ok=Await-Operation ($session.TryTogglePlayPauseAsync()) ([bool]);if(!$ok){throw '播放控制不可用'}}
        'next'{$ok=Await-Operation ($session.TrySkipNextAsync()) ([bool]);if(!$ok){throw '下一首不可用'}}
        'previous'{$ok=Await-Operation ($session.TrySkipPreviousAsync()) ([bool]);if(!$ok){throw '上一首不可用'}}
      }
      $properties=Await-Operation ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $playback=$session.GetPlaybackInfo();$timeline=$session.GetTimelineProperties()
      $position=$position;if($playback.PlaybackStatus.ToString() -eq 'Playing'){$position+=[Math]::Max(0,([DateTimeOffset]::Now-$timeline.LastUpdatedTime).TotalSeconds)}
      $result=@{available=$true;title=$properties.Title;artist=$properties.Artist;album=$properties.AlbumTitle;player=$session.SourceAppUserModelId;playing=($playback.PlaybackStatus.ToString() -eq 'Playing');position=$timeline.Position.TotalSeconds;duration=$timeline.EndTime.TotalSeconds;canToggle=$playback.Controls.IsPlayPauseToggleEnabled;canNext=$playback.Controls.IsNextEnabled;canPrevious=$playback.Controls.IsPreviousEnabled}
    }
    @{id=$request.id;data=$result}|ConvertTo-Json -Depth 5 -Compress | ForEach-Object {[Console]::WriteLine($_)}
  }catch{@{id=$request.id;data=@{available=$false;error=$_.Exception.Message}}|ConvertTo-Json -Compress | ForEach-Object {[Console]::WriteLine($_)}}
}
