# ============================================================
#   V4 啟動器 (PowerShell) - 一鍵啟動 HTTP server + Edge
#   雙擊 BAT 或 PS1 都會跑這個腳本
# ============================================================

param(
    [int]$Port = 9527,
    [string]$Root = ""
)

# Force UTF-8
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

if ($Root -eq "") {
    $Root = $PSScriptRoot
}

# Window title (for identification)
$Host.UI.RawUI.WindowTitle = 'V4 Launcher'

# ========== Step 0: 清理舊 process ==========
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  V4 Launcher" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Kill existing V4 server (by title)
$existingServers = Get-Process -Name "powershell" -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -eq 'V4 HTTP Server' }
if ($existingServers) {
    Write-Host "Stopping existing V4 HTTP Server..." -ForegroundColor Yellow
    $existingServers | Stop-Process -Force
    Start-Sleep -Seconds 1
}

# Kill stale Edge V4 instances
$staleEdge = Get-Process -Name "msedge" -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -like '*V4*' -or $_.MainWindowTitle -like '*住戶*' }
if ($staleEdge) {
    Write-Host "Stopping $($staleEdge.Count) stale Edge windows..." -ForegroundColor Yellow
    $staleEdge | Stop-Process -Force
    Start-Sleep -Seconds 1
}

# ========== Step 1: 啟動 HTTP server (background) ==========
Write-Host ""
Write-Host "[1/3] Starting HTTP server..." -ForegroundColor Yellow

$serverScript = Join-Path $Root "start-server.ps1"
if (-not (Test-Path $serverScript)) {
    Write-Host "[ERROR] Cannot find start-server.ps1 at $serverScript" -ForegroundColor Red
    Write-Host "Press any key to close..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Launch server (hidden window)
$serverProc = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$serverScript`"",
    "-Port", $Port,
    "-Root", "`"$Root`""
) -WindowStyle Hidden -PassThru

Write-Host "  Server PID: $($serverProc.Id)"

# Wait for server to be ready (poll port)
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    $conn = Test-NetConnection -ComputerName "localhost" -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($conn) {
        $ready = $true
        break
    }
}

if (-not $ready) {
    Write-Host "[ERROR] Server did not start within 15 seconds" -ForegroundColor Red
    Write-Host "Try running start-server.ps1 directly to see the error." -ForegroundColor Yellow
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Press any key to close..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "  Server ready on port $Port" -ForegroundColor Green

# ========== Step 2: 啟動 Edge ==========

# Detect Edge
$edgePath = $null
$edgeCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
)
foreach ($p in $edgeCandidates) {
    if (Test-Path $p) { $edgePath = $p; break }
}

if (-not $edgePath) {
    Write-Host "[ERROR] Microsoft Edge not found" -ForegroundColor Red
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Press any key to close..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "[2/3] Launching Edge (App mode)..." -ForegroundColor Yellow

$edgeProc = Start-Process -FilePath $edgePath -ArgumentList @(
    "--app=http://localhost:$Port/",
    "--window-size=1400,900",
    "--window-position=center"
) -PassThru

Write-Host "  Edge PID: $($edgeProc.Id)"

# ========== Step 3: 等 Edge 結束（穩定版偵測）============
Write-Host ""
Write-Host "[3/3] V4 is running." -ForegroundColor Green
Write-Host "  Close the Edge window to stop the server." -ForegroundColor Gray
Write-Host "  Or press Ctrl+C here to force quit." -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan

# Poll edge process by PID - simplest, most reliable
while ($true) {
    Start-Sleep -Seconds 2

    # Check if Edge process still exists
    $stillRunning = Get-Process -Id $edgeProc.Id -ErrorAction SilentlyContinue
    if (-not $stillRunning) {
        Write-Host ""
        Write-Host "Edge closed. Stopping server..." -ForegroundColor Yellow
        break
    }
}

# Cleanup
try {
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
} catch {}

# Also kill any remaining V4 server processes
Get-Process -Name "powershell" -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -eq 'V4 HTTP Server' } |
    Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Done." -ForegroundColor Green