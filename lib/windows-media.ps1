[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'windows-media-native.cs')
Add-Type -Path (Join-Path $PSScriptRoot 'netease-progress.cs')
$legacyTrack='';$legacyPosition=0.0;$legacyPlaying=$false;$legacyAt=[DateTimeOffset]::Now;$lastSound=[DateTimeOffset]::MinValue
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
$taskMethod=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1)
function Await-Operation($operation,$resultType){$task=$taskMethod.MakeGenericMethod($resultType).Invoke($null,@($operation));if(!$task.Wait(5000)){throw 'Media session timeout'};return $task.Result}
try{$manager=Await-Operation ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])}catch{$manager=$null}
while($null -ne ($line=[Console]::ReadLine())){
  try{
    $request=$line | ConvertFrom-Json
    $sessions=@();if($manager){$sessions=@($manager.GetSessions())};$session=$sessions | Where-Object { $_.SourceAppUserModelId -match '(?i)cloudmusic|netease|orpheus' } | Select-Object -First 1
    if(!$session -and $request.player -eq 'system' -and $manager){$session=$manager.GetCurrentSession()}
    if(!$session){
      $track=[FeimoMediaNative]::Track()
      if(!$track){$result=@{available=$false;message='打开网易云音乐并播放歌曲后，音乐药丸会自动连接'}}
      else{
        if($request.command -eq 'seek'){
          if($request.track -ne $track[0] -or $request.artist -ne $track[1]){throw '歌曲已切换，请重试'}
          $duration=[double]$request.duration;$seconds=[double]$request.seconds
          if($duration -le 0 -or $seconds -lt 0 -or $seconds -gt $duration -or [FeimoNeteaseProgress]::Read() -lt 0){throw '未连接歌曲进度'}
          if(![FeimoMediaNative]::Seek([long]$track[2],$seconds/$duration)){throw '当前窗口不支持进度控制，请展开网易云完整播放器后重试'}
          Start-Sleep -Milliseconds 120
          if([Math]::Abs([FeimoNeteaseProgress]::Read()-$seconds) -gt 2){throw '网易云未确认进度跳转，请重试'}
        }
        elseif($request.command -ne 'poll'){
          $code=@{toggle=14;next=11;previous=12}[$request.command]
          if(!$code){throw '未知音乐控制'}
          $handled=[FeimoMediaNative]::Command([long]$track[2],$code)
          if(!$handled){if($sessions.Count -gt 0){throw '其他播放器正在占用系统媒体键，请暂停它后重试'};if(![FeimoMediaNative]::MediaKey($code)){throw '网易云音乐未响应媒体键'}}
          Start-Sleep -Milliseconds 180
          $updated=[FeimoMediaNative]::Track();if($updated){$track=$updated}
        }
        $now=[DateTimeOffset]::Now;$key=$track[0]+'|'+$track[1]
        if($legacyTrack -ne $key){$legacyPosition=0;$legacyTrack=$key}
        elseif($legacyPlaying){$legacyPosition+=[Math]::Max(0,($now-$legacyAt).TotalSeconds)}
        $playing=[FeimoMediaNative]::Playing();if([FeimoMediaNative]::Peak -gt 0.00001){$lastSound=$now};if($null -ne $playing){$playing=$playing -and (($now-$lastSound).TotalSeconds -lt 3)};if($request.command -eq 'toggle'){$playing=!$legacyPlaying;if($playing){$lastSound=$now}else{$lastSound=[DateTimeOffset]::MinValue}};if($null -eq $playing){$playing=$legacyPlaying;if($request.command -eq 'toggle'){$playing=!$playing}}
        $realPosition=[FeimoNeteaseProgress]::Read();$exact=$realPosition -ge 0;if($exact){$legacyPosition=$realPosition}
        $legacyPlaying=[bool]$playing;$legacyAt=$now
        $result=@{available=$true;title=$track[0];artist=$track[1];album='';player='cloudmusic';playing=$legacyPlaying;position=$legacyPosition;duration=0;canToggle=$true;canNext=$true;canPrevious=$true;source='netease-desktop';timelineExact=$exact;canSeek=$exact;message=($(if($exact){'已连接网易云真实播放进度'}else{'当前版本未提供播放进度，歌词从接入时起估算'}))}
      }
    }
    else{
      switch($request.command){
        'seek'{$seconds=[double]$request.seconds;if($seconds -lt 0 -or $seconds -gt [double]$request.duration){throw '无效播放位置'};$ok=Await-Operation ($session.TryChangePlaybackPositionAsync([long]($seconds*10000000))) ([bool]);if(!$ok){throw '播放器不支持进度调节'}}
        'toggle'{$ok=Await-Operation ($session.TryTogglePlayPauseAsync()) ([bool]);if(!$ok){throw '播放控制不可用'}}
        'next'{$ok=Await-Operation ($session.TrySkipNextAsync()) ([bool]);if(!$ok){throw '下一首不可用'}}
        'previous'{$ok=Await-Operation ($session.TrySkipPreviousAsync()) ([bool]);if(!$ok){throw '上一首不可用'}}
      }
      $properties=Await-Operation ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $playback=$session.GetPlaybackInfo();$timeline=$session.GetTimelineProperties()
      $position=$timeline.Position.TotalSeconds;if($playback.PlaybackStatus.ToString() -eq 'Playing'){$position+=[Math]::Max(0,([DateTimeOffset]::Now-$timeline.LastUpdatedTime).TotalSeconds)}
      $result=@{available=$true;title=$properties.Title;artist=$properties.Artist;album=$properties.AlbumTitle;player=$session.SourceAppUserModelId;playing=($playback.PlaybackStatus.ToString() -eq 'Playing');position=$position;source='smtc';timelineExact=$true;duration=$timeline.EndTime.TotalSeconds;canSeek=$playback.Controls.IsPlaybackPositionEnabled;canToggle=$playback.Controls.IsPlayPauseToggleEnabled;canNext=$playback.Controls.IsNextEnabled;canPrevious=$playback.Controls.IsPreviousEnabled}
    }
    @{id=$request.id;data=$result}|ConvertTo-Json -Depth 5 -Compress | ForEach-Object {[Console]::WriteLine($_)}
  }catch{@{id=$request.id;data=@{available=$false;error=$_.Exception.Message}}|ConvertTo-Json -Compress | ForEach-Object {[Console]::WriteLine($_)}}
}
