@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "PORTABLE_NODE=%~dp0portable\VSPPRO\runtime\node.exe"
set "NODE_EXE=%PORTABLE_NODE%"
if exist "%PORTABLE_NODE%" (
  set "TEMP_NODE_DIR=%TEMP%\vsppro-build-node-%RANDOM%%RANDOM%"
  if not exist "!TEMP_NODE_DIR!" mkdir "!TEMP_NODE_DIR!" >nul 2>nul
  copy /Y "%PORTABLE_NODE%" "!TEMP_NODE_DIR!\node.exe" >nul
  if errorlevel 1 (
    echo Cannot prepare temporary Node.js runtime.
    pause
    exit /b 1
  )
  set "NODE_EXE=!TEMP_NODE_DIR!\node.exe"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Cannot find Node.js.
    echo.
    echo This build script can use:
    echo   1. portable\VSPPRO\runtime\node.exe
    echo   2. node.exe from PATH
    echo.
    echo Please install Node.js LTS on the build machine, or keep the portable runtime folder.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
  )
  set "NODE_EXE=node"
)

if not exist "%~dp0node_modules\typescript\bin\tsc" (
  echo Cannot find node_modules.
  echo.
  echo This project needs its dependencies installed before building.
  echo If npm is available, run: npm install
  pause
  exit /b 1
)

echo Building VSPPRO portable package...
echo [1/3] Checking TypeScript...
"%NODE_EXE%" "%~dp0node_modules\typescript\bin\tsc" -b
if errorlevel 1 (
  echo.
  echo TypeScript check failed. Please check the error above.
  pause
  exit /b 1
)

echo [2/3] Building app...
"%NODE_EXE%" "%~dp0node_modules\vite\bin\vite.js" build
if errorlevel 1 (
  echo.
  echo App build failed. Please check the error above.
  pause
  exit /b 1
)

echo [3/3] Creating portable folder...
set "PORT=%VSPPRO_PORT%"
if "%PORT%"=="" set "PORT=4173"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%PORT%"') do (
  echo Stopping running VSPPRO server on port %PORT%...
  taskkill /F /PID %%a >nul 2>nul
)
"%NODE_EXE%" "%~dp0scripts\make-portable.mjs"
if errorlevel 1 (
  echo.
  echo Portable packaging failed. Please check the error above.
  pause
  exit /b 1
)

echo.
echo Done. Copy this folder to another Windows computer:
echo %CD%\portable\VSPPRO
echo.
echo Next: copy the folder below into your shared folder, then on the host
echo machine run VSPPRO.bat -^> 5. Kiem tra cap nhat
echo.
pause
