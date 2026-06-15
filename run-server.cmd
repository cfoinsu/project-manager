@echo off
cd /d "%~dp0"
node server/index.js > server-runtime.out.log 2> server-runtime.err.log
