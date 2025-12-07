@echo off
echo.
echo ========================================
echo Starting FlixNest Servers
echo ========================================
echo.

REM Start Backend Server
echo Starting Backend Server...
start "FlixNest Backend" cmd /k "cd /d "%~dp0backend" && npm start"

REM Wait 2 seconds before starting frontend
timeout /t 2 /nobreak >nul

REM Start Frontend Server
echo Starting Frontend Server...
start "FlixNest Frontend" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo ========================================
echo Both servers are starting!
echo Backend: http://localhost:3001
echo Frontend: Check the Frontend window for URL
echo ========================================
echo.
echo You can close this window now.
timeout /t 3
exit
