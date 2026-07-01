# 大樓住戶系統 V4 啟動器
# 使用方式：在 PowerShell 中執行 .\start.ps1

param(
    [switch]$BuildOnly,   # 只建置不安裝
    [switch]$SkipInstall  # 跳過 pnpm install
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerUrl = "http://localhost:9527"
$ClientUrl = "http://localhost:9527"

function Write-Status($msg, $type = "info") {
    $timestamp = Get-Date -Format "HH:mm:ss"
    $colors = @{
        info    = "Cyan"
        success = "Green"
        warning = "Yellow"
        error   = "Red"
    }
    $color = $colors[$type]
    Write-Host "[$timestamp] $msg" -ForegroundColor $color
}

function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

function Start-Server {
    Write-Status "啟動後端服務器 (Port 9527)..." "info"
    $env:PORT = "9527"
    $serverJob = Start-Job -ScriptBlock {
        param($dir, $port)
        Set-Location $dir
        $env:PORT = $port
        pnpm --filter @v4-resident/server run dev
    } -ArgumentList $ProjectRoot, "9527"
    return $serverJob
}

function Start-Client {
    Write-Status "啟動前端開發伺服器 (Port 9527)..." "info"
    $clientJob = Start-Job -ScriptBlock {
        param($dir)
        Set-Location $dir
        pnpm --filter @v4-resident/client run dev
    } -ArgumentList $ProjectRoot
    return $clientJob
}

function Wait-ForUrl($url, $timeoutSec = 30) {
    Write-Status "等待 $url 就緒..." "info"
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        try {
            $resp = Invoke-WebRequest -Uri $url/api/health -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) {
                Write-Status "後端已就緒 ($url)" "success"
                return $true
            }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    Write-Status "後端啟動超時 ($timeoutSec 秒)" "error"
    return $false
}

function Open-Browser {
    Write-Status "開啟瀏覽器..." "info"
    Start-Process "http://localhost:9527"
}

# ===== 主程式 =====

Push-Location $ProjectRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  大樓住戶系統 V4 啟動器" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# 檢查 pnpm
if (-not (Test-Command pnpm)) {
    Write-Status "錯誤：找不到 pnpm。請先安裝：npm install -g pnpm" "error"
    Pop-Location
    exit 1
}

# 安裝依賴（如果還沒有 node_modules）
if (-not $SkipInstall) {
    if (-not (Test-Path "node_modules") -and -not (Test-Path "server/node_modules") -and -not (Test-Path "client/node_modules")) {
        Write-Status "安裝依賴..." "info"
        pnpm install
        if ($LASTEXITCODE -ne 0) {
            Write-Status "pnpm install 失敗" "error"
            Pop-Location
            exit 1
        }
        Write-Status "依賴安裝完成" "success"
    } else {
        Write-Status "依賴已存在，跳過安裝" "info"
    }
}

# 建置檢查
if (-not (Test-Path "server/dist") -or -not (Test-Path "shared/dist")) {
    Write-Status "建置 shared 與 server..." "info"
    pnpm --filter @v4-resident/shared run build
    pnpm --filter @v4-resident/server run build
    if ($LASTEXITCODE -ne 0) {
        Write-Status "建置失敗" "error"
        Pop-Location
        exit 1
    }
    Write-Status "建置完成" "success"
}

if ($BuildOnly) {
    Write-Status "BuildOnly 模式，完成後退出" "success"
    Pop-Location
    exit 0
}

# 啟動後端
$serverJob = Start-Server
Write-Status "後端已啟動 (背景)" "info"

# 等待後端就緒
if (-not (Wait-ForUrl $ServerUrl)) {
    Write-Status "後端啟動失敗，正在停止..." "error"
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -ErrorAction SilentlyContinue
    Pop-Location
    exit 1
}

# 啟動前端
$clientJob = Start-Client
Write-Status "前端已啟動 (背景)" "info"

# 等待前端
    Write-Status "等待前端就緒 (Port 9527)..." "info"
Start-Sleep -Seconds 5

# 開瀏覽器
Open-Browser

Write-Host ""
Write-Status "========================================" "success"
Write-Status " 系統已啟動！" "success"
Write-Status "  前端：http://localhost:9527" "success"
Write-Status "  後端：http://localhost:9527" "success"
Write-Status "========================================" "success"
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服務" -ForegroundColor Yellow

# 等待 Ctrl+C
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host ""
    Write-Status "正在停止服務..." "warning"
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Stop-Job $clientJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob, $clientJob -ErrorAction SilentlyContinue
    Write-Status "已停止" "success"
    Pop-Location
}
