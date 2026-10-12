$ErrorActionPreference = 'Stop'
# Models and runtime belong to this Windows account, outside the application.
$runtimeDir = Join-Path $env:LOCALAPPDATA 'Feimo/model-runtime/rapid'
if (-not (Test-Path -LiteralPath (Join-Path $runtimeDir 'Scripts/python.exe'))) {
    python -m venv $runtimeDir
    if ($LASTEXITCODE -ne 0) { throw '请先安装 Python 3.11 或 3.12，再运行此脚本。' }
}
$pythonExe = Join-Path $runtimeDir 'Scripts/python.exe'
& $pythonExe -m ensurepip --upgrade
if ($LASTEXITCODE -ne 0) { throw 'Python pip 准备失败。' }
& $pythonExe -m pip install 'rapidocr==3.10.0' 'rapid-table==3.0.2' 'rapid-latex-ocr==0.0.9' 'onnxruntime==1.24.4'
if ($LASTEXITCODE -ne 0) { throw '快速 OCR 依赖安装失败。' }
$worker = Join-Path $runtimeDir 'feimo-worker.py'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../assets/scripts/rapid-ocr-worker.py') -Destination $worker
& $pythonExe -u $worker --prepare
if ($LASTEXITCODE -ne 0) { throw '快速 OCR 模型准备失败，请检查下载网络。' }
Write-Output '快速本机 OCR 已就绪。斐墨设置 → 区域截图与识别 → 快速本机 OCR。'
