<#
.SYNOPSIS
  Prepare the local DeepTutor environment for dsh-deeptutor-study.

.DESCRIPTION
  Idempotent. Creates a virtual environment under <plugin>\runtime, installs
  DeepTutor and the embedding extra, writes the model configuration wired to the
  DeepSeek credential already stored by the Harness, warms the vector model and
  starts the local embedding service.

  Everything lives inside the plugin folder; deleting that folder undoes it all.
#>
[CmdletBinding()]
param(
    [string]$PluginRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$Mirror = 'https://pypi.tuna.tsinghua.edu.cn/simple',
    [int]$EmbedPort = 8787,
    [switch]$SkipModel
)

$ErrorActionPreference = 'Stop'
function Step($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Info($m) { Write-Host "    $m" }
function Fail($m) { Write-Host "!!  $m" -ForegroundColor Red; throw $m }

$Runtime = Join-Path $PluginRoot 'runtime'
$Venv = Join-Path $Runtime 'venv'
$Python = Join-Path $Venv 'Scripts\python.exe'
$Models = Join-Path $PluginRoot 'models'
$Home_ = if ($env:DEEPTUTOR_HOME) { $env:DEEPTUTOR_HOME } else { Join-Path $PluginRoot 'deeptutor-home' }

New-Item -ItemType Directory -Force -Path $Runtime, $Models | Out-Null
$env:PYTHONIOENCODING = 'utf-8'
$env:NO_PROXY = '127.0.0.1,localhost,::1'
$env:no_proxy = $env:NO_PROXY
$env:HF_ENDPOINT = 'https://hf-mirror.com'

Step '查找 Python 3.11+'
$BasePython = $null
$cand = @(
    (Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'),
    'C:\Python312\python.exe',
    'C:\Python311\python.exe'
)
foreach ($c in $cand) { if (Test-Path $c) { $BasePython = $c; break } }
if (-not $BasePython) {
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) {
        foreach ($v in @('-3.12', '-3.11')) {
            try { $out = & py $v -c "import sys;print(sys.executable)" 2>$null; if ($LASTEXITCODE -eq 0 -and $out) { $BasePython = $out.Trim(); break } } catch {}
        }
    }
}
if (-not $BasePython) { Fail '找不到 Python 3.11 以上版本。装一个再重跑：https://www.python.org/downloads/' }
Info $BasePython

Step '创建虚拟环境'
if (Test-Path $Python) { Info "已存在：$Venv" }
else {
    & $BasePython -m venv $Venv
    if ($LASTEXITCODE -ne 0) { Fail 'venv 创建失败' }
    Info "已创建：$Venv"
}

Step '安装 DeepTutor（可能需要几分钟）'
& $Python -m pip install --disable-pip-version-check --upgrade pip -i $Mirror | Out-Null
& $Python -m pip install --disable-pip-version-check -i $Mirror 'deeptutor==1.7.2' 'deeptutor-books==1.7.2' 'fastembed>=0.3' 'zstandard'
if ($LASTEXITCODE -ne 0) { Fail '依赖安装失败。换成别的镜像重试：-Mirror https://mirrors.aliyun.com/pypi/simple' }
Info '依赖装好了'

Step '写 DeepTutor 配置（复用 Harness 里的 DeepSeek 凭据）'
& $Python (Join-Path $PSScriptRoot 'configure.py') --plugin-root $PluginRoot --home $Home_ --embed-port $EmbedPort
if ($LASTEXITCODE -ne 0) { Fail '配置写入失败，见上面的输出' }

if (-not $SkipModel) {
    Step '下载向量模型（约 95MB）'
    & $Python -c "import os;from fastembed import TextEmbedding;TextEmbedding(model_name='BAAI/bge-small-zh-v1.5',cache_dir=os.path.join(r'$Models','bge'))"
    if ($LASTEXITCODE -ne 0) { Write-Host '!!  模型下载失败，知识库将不可用；可稍后重跑本脚本。' -ForegroundColor Yellow }
    else { Info '模型就绪' }
}

Step '启动 embedding 服务'
$server = Join-Path $PSScriptRoot 'embed_server.py'
$running = $false
try { $running = (Test-NetConnection -ComputerName 127.0.0.1 -Port $EmbedPort -InformationLevel Quiet -WarningAction SilentlyContinue) } catch {}
if ($running) { Info "端口 $EmbedPort 上已有服务，跳过" }
else {
    Start-Process -FilePath $Python -ArgumentList @($server, '--port', "$EmbedPort", '--cache', (Join-Path $Models 'bge')) -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Info "已后台启动（端口 $EmbedPort）"
}

Write-Host ''
Write-Host '完成。接下来：' -ForegroundColor Green
Write-Host '  1. dsh study install-skills   （或运行 scripts\install-skills.ps1）'
Write-Host '  2. 重启 DSH，新建会话时选「学习模式」'
