@echo off
echo ========================================
echo    LX Music Desktop - Dev Server
echo ========================================
echo.

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo [ERROR] Install failed!
        pause
        exit /b 1
    )
    echo.
    echo [INFO] Dependencies installed!
    echo.
)

echo [INFO] Starting dev server...
echo.
call npm run dev