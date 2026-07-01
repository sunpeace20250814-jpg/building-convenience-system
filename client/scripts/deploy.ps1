#Requires -Version 5.1

<#
.SYNOPSIS
    V4 住戶管理系統 - 部署到 Google Drive 鏡像資料夾

.DESCRIPTION
    - 把 client/dist/assets 內所有檔案複製到 Google Drive 鏡像的 assets/
    - 把 client/dist 根目錄的檔案（index.html / icon.svg / start-server.ps1 /
      launcher.ps1 等）複製到 Google Drive 鏡像根目錄
    - 複製前先把 dst/assets 內「不在 src/assets」的舊檔移到回收桶（mavis-trash）
    - 部署完成後等 5 秒讓 Google Drive 同步，再啟動 Edge --app

.EXAMPLE
    .\scripts\deploy.ps1

    從 client/ 目錄直接呼叫。會偵測 Edge 程序、詢問是否關閉、
    清舊 assets、複製新檔、啟動 Edge 視窗模式。

.NOTES
    - 必須先跑過 pnpm build，否則 src assets 不存在
    - 必須安裝 mavis-trash（C:\Users\sunpe\.mavis\bin\mavis-trash.cmd）
    - Google Drive 鏡像路徑寫死為 G:\我的雲端硬碟\V4住戶管理\
#>

# UTF-8 輸出
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

# === 路徑設定 ===
# 腳本位於 client/scripts/deploy.ps1，src dist 在 client/dist
$srcDist = (Resolve-Path (Join-Path $PSScriptRoot '..\dist')).Path
$srcAssets = Join-Path $srcDist 'assets'
$dstRoot = 'G:\我的雲端硬碟\V4住戶管理'
$dstAssets = Join-Path $dstRoot 'assets'

Write-Host ''
Write-Host '=========================================='
Write-Host '  V4 Deploy Script'
Write-Host '=========================================='
Write-Host ("  src:    {0}" -f $srcDist)
Write-Host ("  dst:    {0}" -f $dstRoot)
Write-Host ''

# === 參數檢查 ===
if (-not (Test-Path $srcAssets)) {
    Write-Host "[FAIL] src assets 找不到: $srcAssets" -ForegroundColor Red
    Write-Host '請先跑 pnpm build' -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $dstRoot)) {
    Write-Host "[FAIL] dst 根目錄找不到: $dstRoot" -ForegroundColor Red
    Write-Host '請確認 Google Drive 鏡像已掛載' -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $dstAssets)) {
    New-Item -ItemType Directory -Path $dstAssets -Force | Out-Null
}

# === 詢問是否關閉 Edge ===
$edgeProcs = Get-Process msedge -ErrorAction SilentlyContinue
if ($edgeProcs) {
    Write-Host "[INFO] 目前有 $($edgeProcs.Count) 個 msedge 程序在跑" -ForegroundColor Yellow
    $ans = Read-Host '部署前要關閉 Edge 嗎? (y/N)'
    if ($ans -eq 'y' -or $ans -eq 'Y') {
        try {
            $edgeProcs | Stop-Process -Force -ErrorAction Stop
            Start-Sleep -Seconds 1
            Write-Host '[OK] Edge 已關閉' -ForegroundColor Green
        } catch {
            Write-Host "[WARN] 關 Edge 失敗: $_" -ForegroundColor Yellow
        }
    } else {
        Write-Host '[INFO] 略過關閉 Edge' -ForegroundColor DarkGray
    }
}

# === 1. 清掉 dst/assets 內不在 src 的舊檔 ===
Write-Host ''
Write-Host '[1/3] 清掉 dst/assets 內的舊檔...' -ForegroundColor Cyan
$srcAssetNames = (Get-ChildItem -Path $srcAssets -File -ErrorAction SilentlyContinue).Name
$dstAssetFiles = Get-ChildItem -Path $dstAssets -File -ErrorAction SilentlyContinue
$oldAssets = $dstAssetFiles | Where-Object { $srcAssetNames -notcontains $_.Name }
$trashCount = 0
$trashFail = 0
foreach ($f in $oldAssets) {
    mavis-trash -- $f.FullName
    if ($?) {
        $trashCount++
    } else {
        $trashFail++
        Write-Host "  [WARN] trashed failed: $($f.Name)" -ForegroundColor Yellow
    }
}
if ($trashCount -gt 0) {
    Write-Host "  [OK] 已移到回收桶 $trashCount 個舊檔" -ForegroundColor Green
} else {
    Write-Host '  [OK] 沒有要清的舊檔' -ForegroundColor Green
}
if ($trashFail -gt 0) {
    Write-Host "  [WARN] $trashFail 個檔案 trashed 失敗" -ForegroundColor Yellow
}

# === 2. 複製 src/assets → dst/assets ===
Write-Host ''
Write-Host '[2/3] 複製 assets 到 dst...' -ForegroundColor Cyan
try {
    Copy-Item -Path (Join-Path $srcAssets '*') -Destination $dstAssets -Recurse -Force -ErrorAction Stop
    $newCount = (Get-ChildItem -Path $dstAssets -File).Count
    Write-Host "  [OK] dst/assets 現在共 $newCount 個檔案" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] 複製 assets 失敗: $_" -ForegroundColor Red
    exit 1
}

# === 3. 複製 src/dist 根目錄檔案 → dst 根目錄 ===
Write-Host ''
Write-Host '[3/3] 複製 dist 根目錄檔案到 dst...' -ForegroundColor Cyan
$rootFiles = Get-ChildItem -Path $srcDist -File -ErrorAction SilentlyContinue
$copyCount = 0
$copyFail = 0
foreach ($f in $rootFiles) {
    try {
        Copy-Item -Path $f.FullName -Destination $dstRoot -Force -ErrorAction Stop
        $copyCount++
    } catch {
        $copyFail++
        Write-Host "  [WARN] copy failed: $($f.Name) - $_" -ForegroundColor Yellow
    }
}
Write-Host "  [OK] 已複製 $copyCount 個檔案到 dst 根目錄" -ForegroundColor Green
if ($copyFail -gt 0) {
    Write-Host "  [WARN] $copyFail 個檔案複製失敗" -ForegroundColor Yellow
}

# === 等 Google Drive 同步 ===
Write-Host ''
Write-Host '[INFO] 等待 5 秒讓 Google Drive 同步...' -ForegroundColor Cyan
Start-Sleep -Seconds 5

# === 啟動 Edge --app ===
$edgePath = $null
$edgePaths = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
)
foreach ($p in $edgePaths) {
    if (Test-Path $p) { $edgePath = $p; break }
}

if ($edgePath) {
    Write-Host "[INFO] 啟動 Edge --app=http://localhost:9527/" -ForegroundColor Cyan
    Start-Process -FilePath $edgePath -ArgumentList '--app=http://localhost:9527/'
} else {
    Write-Host '[WARN] 找不到 msedge.exe，請手動開啟 http://localhost:9527/' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '==========================================' -ForegroundColor Green
Write-Host '  Deploy 完成' -ForegroundColor Green
Write-Host ("  dst: {0}" -f $dstRoot) -ForegroundColor Green
Write-Host '==========================================' -ForegroundColor Green
Write-Host ''