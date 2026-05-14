@echo off
REM Khoi dong Vite dev server. --host 0.0.0.0 cho phep truy cap qua localhost
REM lan dia chi LAN, du cho ca hai truong hop.

cd /d "%~dp0"
npm run dev -- --host 0.0.0.0
