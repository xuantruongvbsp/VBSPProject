@echo off
setlocal

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Cannot find npm. Please install Node.js LTS on the build machine first.
  echo Download: https://nodejs.org/
  pause
  exit /b 1
)

echo Building VSPPRO portable package...
call npm run portable
if errorlevel 1 (
  echo.
  echo Build failed. Please check the error above.
  pause
  exit /b 1
)

echo.
echo Done. Copy this folder to another Windows computer:
echo %CD%\portable\VSPPRO
echo.
pause
