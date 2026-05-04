@echo off
REM Khởi động Vite dev server nhanh nhất — bỏ qua wrapper npm script
REM (~300-500 ms tiết kiệm so với "npm run dev"). Mở trình duyệt sẵn ở --open.
cd /d "%~dp0"
"node_modules\.bin\vite.cmd" --open
