@echo off
setlocal

cd /d "%~dp0"

if exist "%~dp0portable\VSPPRO\Mo VSPPRO.bat" (
  call "%~dp0portable\VSPPRO\Mo VSPPRO.bat"
  exit /b %ERRORLEVEL%
)

echo Khong tim thay ban portable tai:
echo %~dp0portable\VSPPRO
echo.
echo Hay chay build-portable.bat truoc, sau do mo lai file nay.
pause
exit /b 1
