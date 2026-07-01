@echo off
chcp 65001 >nul
title 大樓住戶系統 V4

echo.
echo ========================================
echo   大樓住戶系統 V4
echo ========================================
echo.

cd /d "%~dp0"

where pnpm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [錯誤] 找不到 pnpm，請先執行：npm install -g pnpm
    pause
    exit /b 1
)

REM 安裝依賴（如需要）
if not exist "node_modules" (
    echo [安裝] 依賴...
    call pnpm install
)

REM 建置 shared + server
echo [建置] shared + server...
call pnpm --filter @v4-resident/shared run build
call pnpm --filter @v4-resident/server run build

REM 開兩個視窗
echo.
echo [啟動] 後端 (Port 9527)...
start "V4-後端" cmd /k "pnpm --filter @v4-resident/server run dev"

timeout /t 3 /nobreak >nul

echo [啟動] 前端 (Port 9527)...
start "V4-前端" cmd /k "pnpm --filter @v4-resident/client run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   系統已啟動！
echo   前端：http://localhost:9527
echo   後端：http://localhost:9527
echo ========================================
echo.
echo 關閉此視窗不會停止系統。
echo 要停止請關閉「V4-後端」和「V4-前端」兩個視窗。
pause
