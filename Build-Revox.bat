@echo off
setlocal enabledelayedexpansion
title Revox Client - Build

rem  Double-click this file to build Revox Client into a Windows .exe.
rem  It checks the two prerequisites, installs them if they are missing, and
rem  then produces the installer and the portable exe.

cd /d "%~dp0"

echo.
echo   ==========================================
echo     Revox Client - Build
echo   ==========================================
echo.

rem ---------------------------------------------------------------- Node.js --
where node >nul 2>nul
if errorlevel 1 (
    echo   [ ] Node.js is missing.
    echo.
    where winget >nul 2>nul
    if errorlevel 1 (
        echo   Install it from https://nodejs.org  ^(LTS^), then run this file again.
        goto :fail
    )
    echo   Installing Node.js...
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    set NEEDS_RESTART=1
) else (
    for /f "tokens=*" %%v in ('node -v') do echo   [x] Node.js %%v
)

rem ------------------------------------------------------------------ Rust --
rem  This is what the "cargo metadata ... program not found" error means:
rem  Tauri compiles a Rust program, so the Rust toolchain has to be installed.
where cargo >nul 2>nul
if errorlevel 1 (
    echo   [ ] Rust is missing.  ^(This is what "program not found" was about.^)
    echo.
    where winget >nul 2>nul
    if errorlevel 1 (
        echo   Install it from https://rustup.rs , then run this file again.
        goto :fail
    )
    echo   Installing Rust...
    winget install -e --id Rustlang.Rustup --accept-source-agreements --accept-package-agreements
    set NEEDS_RESTART=1
) else (
    for /f "tokens=*" %%v in ('cargo --version') do echo   [x] %%v
)

if defined NEEDS_RESTART (
    echo.
    echo   ------------------------------------------------------------------
    echo    Something was just installed. Windows only picks up new programs
    echo    in a NEW window, so:
    echo.
    echo      close this window and double-click Build-Revox.bat again.
    echo   ------------------------------------------------------------------
    echo.
    pause
    exit /b 0
)

rem -------------------------------------------------------------- the build --
echo.
echo   Installing dependencies...
call npm install
if errorlevel 1 goto :fail

echo.
echo   Building. The first run compiles Rust from scratch and takes
echo   10 to 20 minutes. Later runs take about a minute.
echo.
call npm run tauri build
if errorlevel 1 goto :fail

set "OUT=src-tauri\target\release"
set "NSIS=%OUT%\bundle\nsis"

echo.
echo   ==========================================
echo     Done.
echo   ==========================================
echo.
if exist "%NSIS%" (
    echo   Installer:  %NSIS%
)
if exist "%OUT%\revox-client.exe" (
    echo   Portable:   %OUT%\revox-client.exe
)
echo.

if exist "%NSIS%" (
    start "" "%NSIS%"
) else if exist "%OUT%" (
    start "" "%OUT%"
)
pause
exit /b 0

:fail
echo.
echo   ------------------------------------------------------------------
echo    The build stopped. The last lines above say why.
echo   ------------------------------------------------------------------
echo.
pause
exit /b 1
