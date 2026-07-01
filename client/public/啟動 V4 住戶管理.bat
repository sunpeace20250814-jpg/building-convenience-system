@echo off
REM ============================================================
REM   V4 大樓住戶管理 - 一鍵啟動器
REM   用 PowerShell 啟動 HTTP server + Edge App 模式
REM ============================================================

chcp 65001 >nul
title V4 大樓住戶管理

REM 取得 BAT 所在目錄
set "BAT_DIR=%~dp0"
if "%BAT_DIR:~-1%"=="\" set "BAT_DIR=%BAT_DIR:~0,-1%"

REM 啟動 PowerShell 啟動器（避免 cmd 解析中文路徑的問題）
powershell.exe -ExecutionPolicy Bypass -File "%BAT_DIR%\launcher.ps1"

exit /b 0