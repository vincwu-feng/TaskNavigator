@echo off
setlocal
set "BIN=%~dp0node_modules\electron\dist\electron.exe"
if exist "%TASKNAV_ELECTRON%" set "BIN=%TASKNAV_ELECTRON%"
if not exist "%BIN%" (
  echo Electron binary not found. Run "npm install" first or set TASKNAV_ELECTRON.
  exit /b 1
)
start "" "%BIN%" "%~dp0."
exit /b 0
