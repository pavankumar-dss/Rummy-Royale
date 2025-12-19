@echo off
echo ============================================
echo   Rummy Royale - Push to GitHub
echo ============================================

echo.
echo Adding all changes...
git add .
echo Committing changes...
git commit -m "Refactor: Full Stack Application with Multiplayer, DnD, and Rules Enforcement"

echo.
echo Pushing to GitHub...
git push origin main

echo.
if %errorlevel% neq 0 (
    echo.
    echo Push failed! You may need to sign in.
    echo Try running: git push origin main
) else (
    echo Successfully pushed to GitHub!
)
pause
