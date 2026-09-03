@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:48763/api/health' -TimeoutSec 2; if ($r.ok -eq $true) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath 'node' -ArgumentList 'daemon/index.js' -WorkingDirectory '%ROOT%' -WindowStyle Hidden"
  timeout /t 2 /nobreak >nul
)

start "" "%ROOT%node_modules\electron\dist\electron.exe" "%ROOT%."
exit /b 0
