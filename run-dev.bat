@echo off
chcp 65001 >nul
title StorageHub Frontend Dev Server
cd /d "%~dp0"

REM Tự động bổ sung các thư mục cài đặt Node.js phổ biến vào PATH
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%LOCALAPPDATA%\Programs\node;%ProgramFiles%\nodejs;%PATH%"

echo ========================================================
echo   KHỞI ĐỘNG STORAGEHUB FRONTEND (VITE DEV)
echo   URL: http://localhost:5173
echo ========================================================

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [LỖI] Không tìm thấy Node.js/npm trên hệ thống.
    echo Hãy đảm bảo máy tính đã cài đặt Node.js (tải tại: https://nodejs.org)
    echo Hoặc mở một Terminal mới sau khi cài đặt.
    echo.
    pause
    exit /b 1
)

echo Đang khởi chạy Vite dev server...
call npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [THÔNG BÁO] Nếu chưa cài dependencies, đang tự động chạy npm install...
    call npm install
    call npm run dev
)
pause
