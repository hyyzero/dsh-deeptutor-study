<#
.SYNOPSIS
  Copy the bundled skills into the Harness skills directory.
#>
[CmdletBinding()]
param([string]$PluginRoot = (Split-Path -Parent $PSScriptRoot))

$ErrorActionPreference = 'Stop'
$skillsHome = if ($env:DSH_HOME) { Join-Path $env:DSH_HOME 'skills' } else { Join-Path $env:USERPROFILE '.dsh\skills' }
New-Item -ItemType Directory -Force -Path $skillsHome | Out-Null

Get-ChildItem -Directory (Join-Path $PluginRoot 'skills') | ForEach-Object {
    $dest = Join-Path $skillsHome $_.Name
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item (Join-Path $_.FullName '*') $dest -Recurse -Force
    Write-Host "已安装技能：$($_.Name) -> $dest"
}
Write-Host '完成。技能是实时读取的，不需要重启。'
