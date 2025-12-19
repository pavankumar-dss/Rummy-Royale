@echo off
echo ============================================
echo   Rummy Royale - Stop Servers
echo ============================================

echo.
echo Stopping Backend Server (Port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo Stopping Frontend Client (Port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo.
echo Done. Servers stopped.
pause
