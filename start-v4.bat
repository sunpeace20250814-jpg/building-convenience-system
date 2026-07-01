@echo off
REM ============================================================
REM V4 住戶管理系統 - 一鍵啟動器
REM
REM 雙擊即開：啟動後端 + 自動開啟瀏覽器
REM ============================================================
title V4 住戶管理系統
setlocal enabledelayedexpansion

REM 確認 Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 找不到 Node.js，請先安裝 https://nodejs.org
    pause
    exit /b 1
)

REM 確認 repo 結構
if not exist "server\package.json" (
    echo [錯誤] 請在 V4 專案根目錄執行此檔案
    pause
    exit /b 1
)

echo.
echo  ================================================
echo   V4 住戶管理系統 啟動中...
echo  ================================================
echo.

REM 建立 data 目錄（如果不存在）
if not exist "data" mkdir data

REM 啟動後端（在新視窗，跑編譯版，不用 tsx）
echo  [1/2] 啟動後端服務...
start "V4 後端" cmd /c "cd /d "%~dp0server" && npm start"

REM 等 server ready
echo  [2/2] 等候服務就緒...
for /L %%i in (1,1,30) do (
    curl -s -o nul -w "" http://localhost:3001/api/health 2>nul
    if !errorlevel! equ 0 goto :ready
    timeout /t 1 /nobreak >nul
)
goto :continue

:ready
echo   後端就緒 (http://localhost:3001)

:continue
REM 開瀏覽器
echo.
echo   開啟 Edge App...
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3001
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3001
) else (
    start http://localhost:3001
)

echo.
echo  ================================================
echo   V4 已啟動完成！
echo.
echo   停止服務：關閉標題為「V4 後端」的命令列視窗
echo  ================================================
echo.
pause