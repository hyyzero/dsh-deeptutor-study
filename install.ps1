<#
.SYNOPSIS
  把 dsh-deeptutor-study（本地增强版）安装到这台电脑的 DeepSeek Harness。

.DESCRIPTION
  做了三件事：
    1. 用 dsh CLI 把同目录的 tgz 装进指定 profile（自动登记 bundle）
    2. 把插件自带的技能复制到 <DSH_HOME>\skills
    3. 把 DEEPTUTOR_LOCAL_BIN / DEEPTUTOR_HOME 设成用户环境变量（指向装好的插件）

  运行时环境（约 500MB 的 Python 依赖与向量模型）不在包里，装完再点「准备学习环境」。

.PARAMETER Profile
  DSH profile 名，桌面版固定是 desktop。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\install.ps1
#>
[CmdletBinding()]
param(
  [string]$Profile = 'desktop',
  [switch]$SkipSkills,
  [switch]$SkipEnv
)

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $PSCommandPath
$tgz = Get-ChildItem -LiteralPath $here -Filter 'dsh-deeptutor-study-*.tgz' | Select-Object -First 1
if (-not $tgz) {
  throw "找不到 dsh-deeptutor-study-*.tgz。请把 install.ps1 和 tgz 放在同一个目录里。"
}

function Find-DshCli {
  $cmd = Get-Command dsh -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $roots = @(
    'C:\Program Files\DeepSeek Harness',
    'C:\Program Files (x86)\DeepSeek Harness',
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
    (Join-Path $env:LOCALAPPDATA 'DeepSeek Harness'),
    $env:ProgramFiles
  ) | Where-Object { $_ -and (Test-Path $_) }
  foreach ($root in $roots) {
    $candidate = Join-Path $root 'resources\runtime\cli\bin\dsh.cmd'
    if (Test-Path $candidate) { return $candidate }
  }
  foreach ($drive in (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -match '^[A-Za-z]:\\$' })) {
    foreach ($name in @('DS', 'DSH', 'DeepSeek Harness')) {
      $candidate = Join-Path $drive.Root "$name\resources\runtime\cli\bin\dsh.cmd"
      if (Test-Path $candidate) { return $candidate }
    }
  }
  return $null
}

$cli = Find-DshCli
if (-not $cli) {
  Write-Host '找不到 dsh CLI。请手动执行下面这条命令，然后重跑本脚本并加 -SkipEnv 之前的两步：' -ForegroundColor Yellow
  Write-Host "  dsh plugin --profile $Profile add `"file:$($tgz.FullName)`""
  exit 1
}

Write-Host "dsh CLI: $cli"
Write-Host "安装包  : $($tgz.Name)" -ForegroundColor Cyan
& $cli plugin --profile $Profile add "file:$($tgz.FullName)"
if ($LASTEXITCODE -ne 0) { throw "dsh plugin add 失败（退出码 $LASTEXITCODE）" }

$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$plugin = Join-Path $dshHome "profiles\$Profile\node_modules\dsh-deeptutor-study"
if (-not (Test-Path $plugin)) { throw "插件目录没找到：$plugin（profile 名对吗？）" }
Write-Host "插件目录: $plugin" -ForegroundColor Cyan

if (-not $SkipSkills) {
  $skills = Join-Path $plugin 'scripts\install-skills.ps1'
  if (Test-Path $skills) { & $skills }
}

if (-not $SkipEnv) {
  $deeptutor = Join-Path $plugin 'runtime\venv\Scripts\deeptutor.exe'
  $home_ = Join-Path $plugin 'deeptutor-home'
  [Environment]::SetEnvironmentVariable('DEEPTUTOR_LOCAL_BIN', $deeptutor, 'User')
  [Environment]::SetEnvironmentVariable('DEEPTUTOR_HOME', $home_, 'User')
  Write-Host '已设置用户环境变量 DEEPTUTOR_LOCAL_BIN / DEEPTUTOR_HOME（重启 DSH 后生效）' -ForegroundColor Green
  Write-Host "  DEEPTUTOR_LOCAL_BIN = $deeptutor"
  Write-Host "  DEEPTUTOR_HOME      = $home_"
}

Write-Host ''
Write-Host '安装完成。接下来：' -ForegroundColor Green
Write-Host '  1. 完全退出 DSH（托盘图标 → 退出）再启动'
Write-Host '  2. 左侧栏出现「知识库管理 / 温习 / 错题本」'
Write-Host '  3. 知识库管理顶部点「准备学习环境」（首次约 500MB，几分钟）'
Write-Host '  4. 新建会话时选「学习模式」'
