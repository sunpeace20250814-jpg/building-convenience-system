# V4 開機自啟 + 桌面捷徑註冊腳本（管理員權限執行一次）
#
# 功能：
#   1. 建立桌面捷徑「V4 啟動」（雙擊即開 Edge App mode）
#   2. 註冊 Windows Task Scheduler 開機自動啟動（無頭，背景跑 server + vite）
#   3. 可選：卸載（--uninstall）

param(
  [switch]$Uninstall = $false
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$startBat = Join-Path $repoRoot 'start-v4.bat'
$startMjs = Join-Path $repoRoot 'start-v4.mjs'
$logDir = Join-Path $repoRoot 'logs'

if (-not (Test-Path $startBat)) {
  Write-Error "找不到 $startBat"
  exit 1
}

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

$taskName = 'V4-ResidentSystem-AutoStart'

function Uninstall-Task {
  if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "[uninstall] 已移除排程: $taskName" -ForegroundColor Yellow
  } else {
    Write-Host "[uninstall] 排程不存在，跳過" -ForegroundColor Yellow
  }

  $desktop = [Environment]::GetFolderPath('Desktop')
  $shortcut = Join-Path $desktop 'V4 啟動.lnk'
  if (Test-Path $shortcut) {
    Remove-Item $shortcut -Force
    Write-Host "[uninstall] 已移除桌面捷徑: $shortcut" -ForegroundColor Yellow
  }
}

function Install-Task {
  # 1) 桌面捷徑（雙擊即開 App）
  $shell = New-Object -ComObject WScript.Shell
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shortcut = $shell.CreateShortcut((Join-Path $desktop 'V4 啟動.lnk'))
  $shortcut.TargetPath = $startBat
  $shortcut.WorkingDirectory = $repoRoot
  $shortcut.IconLocation = "shell32.dll,13"  # 預設 app 圖示
  $shortcut.Description = '啟動 V4 住戶管理系統（Edge App mode）'
  $shortcut.Save()
  Write-Host "[install] 桌面捷徑已建立: $($shortcut.FullName)" -ForegroundColor Green

  # 2) 開機自動啟動（背景 headless，不開瀏覽器）
  $action = New-ScheduledTaskAction `
    -Execute 'cmd.exe' `
    -Argument "/c `"$startBat`" --no-browser" `
    -WorkingDirectory $repoRoot

  $trigger = New-ScheduledTaskTrigger -AtLogOn

  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)  # 無限制

  Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description 'V4 住戶管理系統 — 開機自動啟動（背景跑 server + vite preview）' `
    -User $env:USERNAME `
    -RunLevel Limited `
    -Force | Out-Null

  Write-Host "[install] 開機排程已註冊: $taskName" -ForegroundColor Green
}

if ($Uninstall) {
  Uninstall-Task
  Write-Host "`n[done] 卸載完成" -ForegroundColor Yellow
} else {
  Install-Task
  Write-Host "`n[done] 安裝完成" -ForegroundColor Green
  Write-Host "  桌面捷徑「V4 啟動」: 雙擊即開 Edge App" -ForegroundColor Cyan
  Write-Host "  開機排程: 登入後自動啟動 server + vite（不開瀏覽器）" -ForegroundColor Cyan
  Write-Host "  卸載: powershell -ExecutionPolicy Bypass -File install-autostart.ps1 -Uninstall" -ForegroundColor Cyan
}