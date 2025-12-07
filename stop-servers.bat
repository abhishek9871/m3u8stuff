@echo off
echo.
echo ========================================
echo Stopping FlixNest Servers
echo ========================================
echo.

REM Kill all node processes (this will stop both backend and frontend)
echo Stopping all Node.js processes...
taskkill /F /IM node.exe /T 2>nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✓ Servers stopped successfully!
) else (
    echo.
    echo No running servers found.
)

echo.
timeout /t 2
exit
