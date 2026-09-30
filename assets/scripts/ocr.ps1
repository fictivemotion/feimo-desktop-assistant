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
  $null = [Windows.Graphics.Imaging.BitmapPixelFormat, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapAlphaMode, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $stream = $null
  $bmp = $null

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
    # Chinese OCR also reads Latin text. Prefer an installed Simplified Chinese
    # recognizer for the Chinese desktop UI, then use the user's profile engine.
    $preferred = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Where-Object { $_.LanguageTag -match '^zh-(Hans|CN)' } | Select-Object -First 1
    if ($preferred) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($preferred) }
    if ($null -eq $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
    if ($null -eq $engine) {
      $fallback = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Select-Object -First 1
      if ($fallback) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($fallback) }
    }
    if ($null -ne $engine) { $langUsed = $engine.RecognizerLanguage.LanguageTag }
  }
  if ($null -eq $engine) { throw 'NO_ENGINE' }

  $file = AwaitOp ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
  $stream = AwaitOp ($file.OpenAsync(0)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = AwaitOp ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  if ($decoder.PixelWidth -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension -or $decoder.PixelHeight -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension) { throw 'IMAGE_TOO_LARGE: please use a smaller image' }
  $bmp = AwaitOp ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore)) ([Windows.Graphics.Imaging.SoftwareBitmap])

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
} catch {
  $msg = $_.Exception.Message
  $out = [pscustomobject]@{ ok = $false; error = "$msg" }
  $out | ConvertTo-Json | Out-File -FilePath $OutFile -Encoding utf8
} finally {
  if ($bmp) { $bmp.Dispose() }
  if ($stream) { $stream.Dispose() }
}
