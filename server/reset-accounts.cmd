@echo off
setlocal enabledelayedexpansion
title Folder Atlas - Reset Default Accounts
cd /d "%~dp0"

echo ============================================================
echo   Reset default accounts (admin/manager/member)
echo   - passwords back to admin123 / manager123 / member123
echo   - device registration cleared
echo   - existing projects/data are KEPT
echo ============================================================
echo.
echo [IMPORTANT] Close the server window first (file lock).
echo.
pause

set "NODE_EXE="
where node >nul 2>nul
if not errorlevel 1 ( set "NODE_EXE=node" & goto :have_node )
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%APPDATA%\fnm\node-versions" (
  for /f "delims=" %%d in ('dir /b /ad "%APPDATA%\fnm\node-versions" 2^>nul') do (
    if exist "%APPDATA%\fnm\node-versions\%%d\installation\node.exe" set "NODE_EXE=%APPDATA%\fnm\node-versions\%%d\installation\node.exe"
  )
)
if not defined NODE_EXE (
  echo [ERROR] Node.js not found. Install Node.js LTS from https://nodejs.org
  pause
  exit /b 1
)
for %%i in ("%NODE_EXE%") do set "NODE_DIR=%%~dpi"
set "PATH=%NODE_DIR%;%PATH%"

:have_node
"%NODE_EXE%" reset-accounts.js
echo.
pause
