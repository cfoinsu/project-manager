@echo off
setlocal enabledelayedexpansion
title Folder Atlas Server
cd /d "%~dp0"

echo ============================================================
echo   Folder Atlas - Internal Shared Server
echo ============================================================
echo.

set "NODE_EXE="

REM 1) node on PATH?
where node >nul 2>nul
if not errorlevel 1 (
  set "NODE_EXE=node"
  goto :have_node
)

REM 2) official install locations
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"

REM 3) fnm location (dev machine)
if not defined NODE_EXE if exist "%APPDATA%\fnm\node-versions" (
  for /f "delims=" %%d in ('dir /b /ad "%APPDATA%\fnm\node-versions" 2^>nul') do (
    if exist "%APPDATA%\fnm\node-versions\%%d\installation\node.exe" set "NODE_EXE=%APPDATA%\fnm\node-versions\%%d\installation\node.exe"
  )
)

if not defined NODE_EXE (
  echo [ERROR] Node.js not found.
  echo         Install Node.js LTS from https://nodejs.org then run again.
  echo.
  pause
  exit /b 1
)

REM add node folder to PATH so npm works
for %%i in ("%NODE_EXE%") do set "NODE_DIR=%%~dpi"
set "PATH=%NODE_DIR%;%PATH%"

:have_node
echo [OK] Node version:
"%NODE_EXE%" -v
echo.

REM install deps on first run
if not exist "node_modules" (
  echo [SETUP] First run - installing packages, please wait...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. Check internet connection.
    pause
    exit /b 1
  )
)

REM show this PC's LAN IP for colleagues
echo.
echo [INFO] On colleague PCs, open  Settings - Internal Server URL  and enter:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo         http://%%b:5000
)
echo.
echo [RUN] Starting server. Closing this window stops the server. Keep it open.
echo       Same-PC test: just log in with  admin / admin123  in the app.
echo ============================================================
echo.

REM Internal shared server: disable per-PC device lock (login with id/password only)
set "DISABLE_DEVICE_AUTH=true"

"%NODE_EXE%" index.js

echo.
echo [STOPPED] Server has stopped.
pause
