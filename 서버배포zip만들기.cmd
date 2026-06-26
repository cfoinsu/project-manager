@echo off
chcp 65001 >nul
title Make server distribution zip
cd /d "%~dp0"
echo Building build_release\server_dist.zip ...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_server_zip.ps1"
echo.
pause
