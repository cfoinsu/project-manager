@echo off
setlocal enabledelayedexpansion
title Folder Atlas Dev
cd /d "%~dp0"

echo ============================================================
echo   Folder Atlas - Dev Launcher
echo ============================================================
echo.

set "NODE_EXE="

where node >nul 2>nul
if not errorlevel 1 (
  set "NODE_EXE=node"
  goto :have_node
)

if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE_EXE if exist "%APPDATA%\fnm\node-versions" (
  for /f "delims=" %%d in ('dir /b /ad "%APPDATA%\fnm\node-versions" 2^>nul') do (
    if exist "%APPDATA%\fnm\node-versions\%%d\installation\node.exe" set "NODE_EXE=%APPDATA%\fnm\node-versions\%%d\installation\node.exe"
  )
)

if not defined NODE_EXE (
  echo [ERROR] Node.js not found.
  echo         Install Node.js LTS from https://nodejs.org then run this file again.
  echo.
  pause
  exit /b 1
)

for %%i in ("%NODE_EXE%") do set "NODE_DIR=%%~dpi"
set "PATH=%NODE_DIR%;%PATH%"

:have_node
echo [OK] Node:
"%NODE_EXE%" -v
echo.

if not exist "node_modules" (
  echo [SETUP] Installing frontend packages...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Frontend npm install failed.
    pause
    exit /b 1
  )
)

if not exist "server\node_modules" (
  echo [SETUP] Installing server packages...
  pushd server
  call npm install
  if errorlevel 1 (
    popd
    echo [ERROR] Server npm install failed.
    pause
    exit /b 1
  )
  popd
)

echo [RUN] Starting backend server in a new window...
start "Folder Atlas Server" cmd /k "%~dp0server\start-server.cmd"
echo.
echo [RUN] Starting frontend dev server...
echo       Open: http://localhost:5174
echo       Login: admin / admin123
echo ============================================================
echo.

call npm run dev -- --host 0.0.0.0

echo.
echo [STOPPED] Frontend server has stopped.
pause
