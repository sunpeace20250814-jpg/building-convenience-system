@echo off
REM v4-cli 批次檔
REM 用法：v4.bat <resource> <action> [flags]
REM 例如：v4.bat residents list
REM       v4.bat residents create --ownerName=王大明 --floor=3F --buildingId=b1
REM       v4.bat residents list --from-file=batch.json

chcp 65001 >nul

cd /d "%~dp0"
pnpm cli %*
