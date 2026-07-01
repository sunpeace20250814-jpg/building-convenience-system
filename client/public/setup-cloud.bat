@echo off
REM ============================================================
REM   V4 大樓住戶管理 - 雲端版安裝腳本
REM   把 dist/ 安裝到 OneDrive / Google Drive / Dropbox
REM   之後雲端硬碟會自動同步整個資料夾
REM ============================================================

chcp 65001 >nul
title V4 雲端版安裝

echo.
echo ===========================================================
echo   V4 大樓住戶管理 - 雲端版安裝
echo ===========================================================
echo.
echo   此腳本會把 V4 安裝到你的雲端硬碟資料夾
echo   之後雲端硬碟會自動同步，換電腦只要登入就有完整 App
echo.
echo ===========================================================
echo.

REM 取得此 BAT 所在目錄（dist/ 的位置）
set "SRC_DIR=%~dp0"
if "%SRC_DIR:~-1%"=="\" set "SRC_DIR=%SRC_DIR:~0,-1%"

REM 用 PowerShell 偵測所有雲端硬碟（支援整槽鏡像、預設資料夾、多帳號）
echo [偵測中] 掃描你的雲端硬碟...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference = 'SilentlyContinue'; " ^
    "$results = New-Object System.Collections.ArrayList; " ^
    "$idx = 0; " ^
    "$addOption = { param($name, $path, $note) " ^
    "    $script:idx++; " ^
    "    $results.Add([PSCustomObject]@{ Index = $script:idx; Name = $name; Path = $path; Note = $note }) | Out-Null " ^
    "}; " ^
    "$driveFS = 'HKCU:\Software\Google\DriveFS'; " ^
    "$hasGoogleDrive = Test-Path $driveFS; " ^
    "if ($hasGoogleDrive) { " ^
    "    $found = $false; " ^
    "    Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue | Where-Object { $_.Description -match 'Google Drive' } | ForEach-Object { " ^
    "        & $addOption ('Google Drive（整槽鏡像 ' + $_.Name + ':）') $_.Root '鏡像磁碟，所有寫入自動同步'; " ^
    "        $found = $true " ^
    "    }; " ^
    "    if (-not $found) { " ^
    "        $paths = @(\"$env:USERPROFILE\Google Drive\", \"D:\Google Drive\", \"D:\My Drive\", \"$env:USERPROFILE\My Drive\"); " ^
    "        foreach ($p in $paths) { " ^
    "            if (Test-Path $p) { & $addOption 'Google Drive' $p '已偵測到登入帳號與此資料夾'; $found = $true; break } " ^
    "        } " ^
    "    }; " ^
    "    if (-not $found) { & $addOption 'Google Drive（已登入但找不到鏡像資料夾）' '' '需要打開 Google Drive for Desktop 設定鏡像位置' } " ^
    "}; " ^
    "$oneDrivePaths = @( " ^
    "    @{ Name = 'OneDrive'; Path = \"$env:USERPROFILE\OneDrive\" }, " ^
    "    @{ Name = 'OneDrive 個人'; Path = \"$env:USERPROFILE\OneDrive - 個人\" }, " ^
    "    @{ Name = 'OneDrive 公司'; Path = \"$env:USERPROFILE\OneDrive - 公司\" }, " ^
    "    @{ Name = 'OneDrive'; Path = \"$env:OneDrive\" }, " ^
    "    @{ Name = 'OneDrive 商用'; Path = \"$env:OneDriveCommercial\" } " ^
    "); " ^
    "foreach ($od in $oneDrivePaths) { " ^
    "    if (Test-Path $od.Path) { & $addOption $od.Name $od.Path 'OneDrive 同步資料夾' } " ^
    "}; " ^
    "$dropboxPaths = @(\"$env:USERPROFILE\Dropbox\", \"D:\Dropbox\", \"$env:USERPROFILE\Dropbox (Personal)\"); " ^
    "foreach ($dp in $dropboxPaths) { " ^
    "    if (Test-Path $dp) { & $addOption 'Dropbox' $dp 'Dropbox 同步資料夾' } " ^
    "}; " ^
    "$results | Format-Table -AutoSize Index, Name, @{Name='路徑';Expression={ if ($_.Path) { $_.Path } else { '(無)' } }, Note; " ^
    "$results | Export-Clixml -Path \"$env:TEMP\v4_cloud_options.xml\"; " ^
    "Write-Host ''; " ^
    "Write-Host ('  [0] 取消（不安裝到雲端）') -ForegroundColor Yellow; " ^
    "Write-Host ''; " ^
    "Write-Host ('  找到 ' + $results.Count + ' 個雲端硬碟') -ForegroundColor Cyan"

if errorlevel 1 (
    echo.
    echo [錯誤] 偵測失敗
    pause
    exit /b 1
)

echo.

REM 讀回選項數量
for /f "usebackq" %%I in (`powershell -NoProfile -Command "Import-Clixml '$env:TEMP\v4_cloud_options.xml' | Measure-Object | Select-Object -ExpandProperty Count"`) do set "CLOUD_COUNT=%%I"

if "%CLOUD_COUNT%"=="0" (
    echo [警告] 沒偵測到任何雲端硬碟
    echo.
    echo 請確認你已安裝並登入以下任一雲端硬碟：
    echo   - Microsoft OneDrive（Windows 10/11 通常已內建）
    echo   - Google Drive for Desktop（需登入 Google 帳號）
    echo   - Dropbox
    echo.
    echo 安裝好雲端硬碟後，重新執行此腳本
    echo.
    pause
    exit /b 1
)

REM 詢問選擇
set /p CHOICE="請選擇雲端硬碟（輸入數字，0 = 取消）: "

REM 驗證輸入
if "%CHOICE%"=="0" exit /b 0
if "%CHOICE%"=="" (
    echo [取消] 沒有選擇
    pause
    exit /b 1
)

powershell -NoProfile -Command ^
    "$choice = [int]'%CHOICE%'; " ^
    "$count = [int]'%CLOUD_COUNT%'; " ^
    "if ($choice -lt 1 -or $choice -gt $count) { exit 1 } else { exit 0 }"
if errorlevel 1 (
    echo [錯誤] 選擇無效
    pause
    exit /b 1
)

REM 取得選擇的雲端路徑和名稱
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "(Import-Clixml '$env:TEMP\v4_cloud_options.xml' | Select-Object -Skip (%CHOICE%-1) -First 1).Path"`) do set "CLOUD_PATH=%%P"
for /f "usebackq delims=" %%N in (`powershell -NoProfile -Command "(Import-Clixml '$env:TEMP\v4_cloud_options.xml' | Select-Object -Skip (%CHOICE%-1) -First 1).Name"`) do set "CLOUD_NAME=%%N"

REM 如果選擇了「無路徑」（Google Drive 已登入但找不到資料夾）
if "%CLOUD_PATH%"=="" (
    echo.
    echo [警告] 已偵測到 %CLOUD_NAME%，但找不到鏡像資料夾
    echo.
    echo 請打開 Google Drive for Desktop：
    echo   1. 工作列右下角找到 Google Drive 圖示
    echo   2. 點齒輪 → 偏好設定 → 「我的筆記型電腦」
    echo   3. 選擇資料夾位置（或切換到「鏡像我電腦的所有檔案」）
    echo   4. 設定好後重新執行此腳本
    echo.
    pause
    exit /b 1
)

REM 組合安裝目標
set "INSTALL_DIR=%CLOUD_PATH%\V4 住戶管理"

echo.
echo ===========================================================
echo   安裝設定確認
echo ===========================================================
echo.
echo   雲端硬碟：%CLOUD_NAME%
echo   安裝位置：%INSTALL_DIR%
echo.
echo   ※ 此資料夾建立後，雲端硬碟會自動把它同步到雲端
echo   ※ 之後這個資料夾內的所有變更都會自動同步
echo.

set /p CONFIRM="確認開始安裝？(Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo [取消] 使用者取消安裝
    pause
    exit /b 0
)

REM 檢查目標是否已存在
if exist "%INSTALL_DIR%" (
    echo.
    echo [警告] 目標資料夾已存在：%INSTALL_DIR%
    echo.
    set /p OVERWRITE="是否覆蓋？(Y=覆蓋 / N=取消) "
    if /i not "%OVERWRITE%"=="Y" (
        echo [取消] 不覆蓋
        pause
        exit /b 0
    )
)

echo.
echo [1/5] 建立資料夾...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if errorlevel 1 (
    echo [錯誤] 無法建立資料夾
    pause
    exit /b 1
)

echo [2/5] 複製程式檔案...
xcopy /E /I /Y /Q "%SRC_DIR%\*" "%INSTALL_DIR%\" >nul
if errorlevel 1 (
    echo [錯誤] 複製失敗
    pause
    exit /b 1
)

echo [3/5] 建立 backups 子資料夾...
if not exist "%INSTALL_DIR%\backups" mkdir "%INSTALL_DIR%\backups"

echo [4/5] 建立桌面捷徑...
powershell -NoProfile -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
    "$shortcut = $ws.CreateShortcut((Join-Path $desktop 'V4 大樓住戶管理.lnk')); " ^
    "$shortcut.TargetPath = '%INSTALL_DIR%\啟動 V4 住戶管理.bat'; " ^
    "$shortcut.WorkingDirectory = '%INSTALL_DIR%'; " ^
    "$shortcut.WindowStyle = 7; " ^
    "$shortcut.IconLocation = '%INSTALL_DIR%\icon.svg'; " ^
    "$shortcut.Description = 'V4 大樓住戶管理（雲端版，自動同步）'; " ^
    "$shortcut.Save()"

echo [5/5] 清理暫存...
del "%TEMP%\v4_cloud_options.xml" >nul 2>&1

echo.
echo ===========================================================
echo   安裝完成！
echo ===========================================================
echo.
echo   安裝位置：%INSTALL_DIR%
echo   桌面捷徑：V4 大樓住戶管理.lnk
echo.
echo   接下來：
echo   1. 確認 %CLOUD_NAME% 正在執行（工作列右下方有圖示）
echo   2. 雙擊桌面「V4 大樓住戶管理」捷徑啟動
echo   3. 首次啟動後，進入 V4 「備份」模組
echo   4. 開啟「每日自動備份」，備份位置選：
echo      %INSTALL_DIR%\backups
echo.
echo   換電腦流程：
echo   1. 在新電腦登入 %CLOUD_NAME%
echo   2. 雲端硬碟會自動下載 V4 資料夾
echo   3. 雙擊「啟動 V4 住戶管理.bat」
echo   4. 首次進入「備份」模組匯入最新備份即可
echo.
echo ===========================================================
echo.

pause
exit /b 0