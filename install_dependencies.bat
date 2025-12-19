@echo off
echo ============================================
echo   Rummy Royale - Dependency Installer
echo ============================================

echo.
echo [1/2] Installing Backend (Server) dependencies...
cd server
call npm install
if %errorlevel% neq 0 (
    echo Error installing server dependencies!
    pause
    exit /b %errorlevel%
)
cd ..

echo.
echo [2/2] Installing Frontend (Client) dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo Error installing client dependencies!
    pause
    exit /b %errorlevel%
)
cd ..

echo.
echo ============================================
echo   Success! All dependencies installed.
echo ============================================
echo.
echo To start the project:
echo 1. Open Terminal 1: node server/index.js
echo 2. Open Terminal 2: cd client ^&^& npm run dev
echo.
pause
