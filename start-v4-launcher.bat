@echo off
REM ============================================================
REM V4 啟動器（雙擊即開，自動開瀏覽器）
REM ============================================================
title V4 啟動器
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH
  pause
  exit /b 1
)

node start-v4-launcher.mjs

if errorlevel 1 (
  echo [ERROR] launcher crashed
  pause
)