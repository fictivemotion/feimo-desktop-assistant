param(
  [Parameter(Mandatory=$true)][string]$ImagePath,
  [Parameter(Mandatory=$true)][string]$OutFile,
  [string]$Lang = ""
)
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]

  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]
  function AwaitOp($WinRtTask, $ResultType) {
    $t = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($WinRtTask))
    $t.Wait(-1) | Out-Null
    return $t.Result
  }

  $engine = $null
  $langUsed = ''
  if ($Lang -and $Lang -ne 'auto') {
    foreach ($l in [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages) {
      if ($l.LanguageTag -eq $Lang -or $l.LanguageTag.ToLower().StartsWith($Lang.ToLower())) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($l)
        $langUsed = $l.LanguageTag
        break
      }
    }
    if ($null -eq $engine) { throw "NO_LANGPACK: $Lang" }
  } else {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    $langUsed = 'user-profile'
  }
  if ($null -eq $engine) { throw 'NO_ENGINE' }

  $file = AwaitOp ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
  $stream = AwaitOp ($file.OpenAsync(0)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = AwaitOp ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bmp = AwaitOp ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

  $result = AwaitOp ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])

  $lines = @()
  foreach ($line in $result.Lines) {
    $x0 = [double]::MaxValue; $y0 = [double]::MaxValue; $x1 = 0.0; $y1 = 0.0
    foreach ($w in $line.Words) {
      $r = $w.BoundingRect
      if ($r.X -lt $x0) { $x0 = $r.X }
      if ($r.Y -lt $y0) { $y0 = $r.Y }
      if (($r.X + $r.Width) -gt $x1) { $x1 = $r.X + $r.Width }
      if (($r.Y + $r.Height) -gt $y1) { $y1 = $r.Y + $r.Height }
    }
    $lines += [pscustomobject]@{
      text = $line.Text
      x = [math]::Round($x0, 1); y = [math]::Round($y0, 1)
      w = [math]::Round($x1 - $x0, 1); h = [math]::Round($y1 - $y0, 1)
    }
  }

  $out = [pscustomobject]@{
    ok = $true
    language = $langUsed
    lineCount = $lines.Count
    lines = $lines
  }
  $out | ConvertTo-Json -Depth 4 | Out-File -FilePath $OutFile -Encoding utf8
  exit 0
} catch {
  $msg = $_.Exception.Message
  $out = [pscustomobject]@{ ok = $false; error = "$msg" }
  $out | ConvertTo-Json | Out-File -FilePath $OutFile -Encoding utf8
  exit 0
}
