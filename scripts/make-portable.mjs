import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(repoRoot, 'dist');
const outDir = path.join(repoRoot, 'portable', 'VSPPRO');
const appDir = path.join(outDir, 'app');
const runtimeDir = path.join(outDir, 'runtime');

if (!existsSync(path.join(distDir, 'index.html'))) {
  throw new Error('dist/index.html was not found. Run "npm run build" before packaging.');
}

await rm(outDir, { recursive: true, force: true });
await mkdir(appDir, { recursive: true });
await mkdir(runtimeDir, { recursive: true });

await cp(distDir, appDir, { recursive: true });
if (existsSync(path.join(repoRoot, 'public', 'config.json'))) {
  await copyFile(path.join(repoRoot, 'public', 'config.json'), path.join(appDir, 'config.json'));
}
await copyFile(path.join(repoRoot, 'scripts', 'portable-server.mjs'), path.join(outDir, 'server.mjs'));
await copyFile(path.join(repoRoot, 'scripts', 'check-update.mjs'), path.join(outDir, 'check-update.mjs'));
await copyFile(path.join(repoRoot, 'setup.ps1'), path.join(outDir, 'setup.ps1'));
await copyFile(path.join(repoRoot, 'setup.bat'), path.join(outDir, 'setup.bat'));

if (process.platform === 'win32' && existsSync(process.execPath)) {
  await copyFile(process.execPath, path.join(runtimeDir, 'node.exe'));
}

await writeFile(
  path.join(outDir, 'Mo VSPPRO.bat'),
  `@echo off\r\n` +
    `setlocal\r\n` +
    `cd /d "%~dp0"\r\n` +
    `set "VSPPRO_BROWSER=chrome"\r\n` +
    `set "NODE_EXE=%~dp0runtime\\node.exe"\r\n` +
    `if not exist "%NODE_EXE%" set "NODE_EXE=node"\r\n` +
    `set "FW_PROGRAM=%~dp0runtime\\node.exe"\r\n` +
    `if exist "%FW_PROGRAM%" (\r\n` +
    `  netsh advfirewall firewall show rule name="VSPPRO Portable Server" >nul 2>nul\r\n` +
    `  if errorlevel 1 (\r\n` +
    `    netsh advfirewall firewall add rule name="VSPPRO Portable Server" dir=in action=allow program="%FW_PROGRAM%" enable=yes >nul 2>nul\r\n` +
    `    if errorlevel 1 (\r\n` +
    `      echo.\r\n` +
    `      echo [Luu y] Chua them duoc quy tac tuong lua Windows Firewall.\r\n` +
    `      echo   Neu dong nghiep khong mo duoc app, chay "Them Firewall Rule.bat"\r\n` +
    `      echo   voi quyen Administrator: chuot phai file, chon Run as administrator.\r\n` +
    `    )\r\n` +
    `  )\r\n` +
    `)\r\n` +
    `"%NODE_EXE%" "%~dp0server.mjs"\r\n` +
    `echo.\r\n` +
    `echo VSPPRO stopped.\r\n` +
    `pause\r\n`,
  'utf8',
);

await writeFile(
  path.join(outDir, 'Them Firewall Rule.bat'),
  `@echo off\r\n` +
    `setlocal\r\n` +
    `cd /d "%~dp0"\r\n` +
    `set "FW_PROGRAM=%~dp0runtime\\node.exe"\r\n` +
    `if not exist "%FW_PROGRAM%" (\r\n` +
    `  echo Khong tim thay runtime\\node.exe. Hay chay lai build-portable.bat.\r\n` +
    `  pause\r\n` +
    `  exit /b 1\r\n` +
    `)\r\n` +
    `netsh advfirewall firewall delete rule name="VSPPRO Portable Server" >nul 2>nul\r\n` +
    `netsh advfirewall firewall add rule name="VSPPRO Portable Server" dir=in action=allow program="%FW_PROGRAM%" enable=yes\r\n` +
    `if errorlevel 1 (\r\n` +
    `  echo.\r\n` +
    `  echo KHONG thanh cong. Hay chay file nay voi quyen Administrator:\r\n` +
    `  echo   chuot phai file, chon Run as administrator.\r\n` +
    `) else (\r\n` +
    `  echo.\r\n` +
    `  echo Da them quy tac tuong lua. Dong nghiep cung mang LAN co the truy cap.\r\n` +
    `)\r\n` +
    `pause\r\n`,
  'utf8',
);

await writeFile(
  path.join(outDir, 'update-source.txt'),
  `# Duong dan thu muc chua ban VSPPRO moi (1 dong duy nhat, khong dau ngoac kep).\r\n` +
    `# Vi du: \\\\FILESERVER\\Share\\VSPPRO\r\n` +
    `# Hoac : D:\\Builds\\VSPPRO\r\n`,
  'utf8',
);

await writeFile(
  path.join(outDir, 'VSPPRO.bat'),
  `@echo off\r\n` +
    `setlocal enabledelayedexpansion\r\n` +
    `cd /d "%~dp0"\r\n` +
    `title VSPPRO - Bo dieu khien\r\n` +
    `\r\n` +
    `set "NODE_EXE=%~dp0runtime\\node.exe"\r\n` +
    `if not exist "%NODE_EXE%" set "NODE_EXE=node"\r\n` +
    `\r\n` +
    `:menu\r\n` +
    `cls\r\n` +
    `echo ============================================\r\n` +
    `echo   VSPPRO - Bo dieu khien\r\n` +
    `echo ============================================\r\n` +
    `echo   1. Khoi dong server\r\n` +
    `echo   2. Doi mat khau quan tri\r\n` +
    `echo   3. Dung server\r\n` +
    `echo   4. Them Firewall rule\r\n` +
    `echo   5. Kiem tra cap nhat\r\n` +
    `echo   6. Thoat\r\n` +
    `echo ============================================\r\n` +
    `set /p "chon=Nhap lua chon 1-6: "\r\n` +
    `if "%chon%"=="1" start "VSPPRO Server" "%~dp0Mo VSPPRO.bat"\r\n` +
    `if "%chon%"=="2" call "%~dp0setup.bat"\r\n` +
    `if "%chon%"=="3" call :stopserver\r\n` +
    `if "%chon%"=="4" call "%~dp0Them Firewall Rule.bat"\r\n` +
    `if "%chon%"=="5" call :checkupdate\r\n` +
    `if "%chon%"=="6" exit /b 0\r\n` +
    `goto menu\r\n` +
    `\r\n` +
    `:checkupdate\r\n` +
    `"%NODE_EXE%" "%~dp0check-update.mjs"\r\n` +
    `if errorlevel 3 ( echo Loi khi kiem tra. & pause & goto menu )\r\n` +
    `if errorlevel 2 ( echo. & pause & goto menu )\r\n` +
    `if errorlevel 1 (\r\n` +
    `  set "SRC_PATH="\r\n` +
    `  for /f "delims=" %%p in ('"%NODE_EXE%" "%~dp0check-update.mjs" --print-source') do set "SRC_PATH=%%p"\r\n` +
    `  if not defined SRC_PATH ( echo Khong doc duoc nguon cap nhat. & pause & goto menu )\r\n` +
    `  set /p "ans=Cap nhat ngay? (Y/N): "\r\n` +
    `  if /i "!ans!"=="Y" call "%~dp0update.bat" "!SRC_PATH!"\r\n` +
    `  goto menu\r\n` +
    `)\r\n` +
    `echo.\r\n` +
    `pause\r\n` +
    `goto menu\r\n` +
    `\r\n` +
    `:stopserver\r\n` +
    `set "PORT=%VSPPRO_PORT%"\r\n` +
    `if "%PORT%"=="" set "PORT=4173"\r\n` +
    `for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%PORT%"') do taskkill /F /PID %%a >nul 2>nul\r\n` +
    `echo.\r\n` +
    `echo Da dung server (neu dang chay).\r\n` +
    `pause\r\n` +
    `goto :eof\r\n`,
  'utf8',
);

await writeFile(
  path.join(outDir, 'update.bat'),
  `@echo off\r\n` +
    `setlocal enabledelayedexpansion\r\n` +
    `cd /d "%~dp0"\r\n` +
    `\r\n` +
    `set "PORT=%VSPPRO_PORT%"\r\n` +
    `if "%PORT%"=="" set "PORT=4173"\r\n` +
    `\r\n` +
    `set "SRC=%~1"\r\n` +
    `if "%SRC%"=="" (\r\n` +
    `  echo Cach dung: keo-tha thu muc VSPPRO moi vao file nay, hoac chay:\r\n` +
    `  echo   update.bat "D:\\duong-dan\\den\\VSPPRO-moi"\r\n` +
    `  echo.\r\n` +
    `  pause\r\n` +
    `  exit /b 1\r\n` +
    `)\r\n` +
    `\r\n` +
    `if not exist "%SRC%\\app\\index.html" (\r\n` +
    `  echo Thu muc moi khong hop le - thieu app\\index.html.\r\n` +
    `  pause\r\n` +
    `  exit /b 1\r\n` +
    `)\r\n` +
    `\r\n` +
    `rem Dung server neu dang chay de tranh node.exe bi lock khi robocopy.\r\n` +
    `echo Kiem tra server dang chay (port %PORT%)...\r\n` +
    `set "RUNNING="\r\n` +
    `for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%PORT%"') do set "RUNNING=%%a"\r\n` +
    `if defined RUNNING (\r\n` +
    `  echo Server dang chay. Can dung truoc khi cap nhat.\r\n` +
    `  set /p "ans=Dung server va tiep tuc? (Y/N): "\r\n` +
    `  if /i not "!ans!"=="Y" (\r\n` +
    `    echo Da huy. Khong co gi thay doi.\r\n` +
    `    pause\r\n` +
    `    exit /b 0\r\n` +
    `  )\r\n` +
    `  for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":%PORT%"') do taskkill /F /PID %%a >nul 2>nul\r\n` +
    `)\r\n` +
    `\r\n` +
    `set "BAK=%~dp0_backup_tmp"\r\n` +
    `if exist "%BAK%" rmdir /S /Q "%BAK%"\r\n` +
    `mkdir "%BAK%\\app" 2>nul\r\n` +
    `\r\n` +
    `echo [1/4] Sao luu du lieu da xuat ban va mat khau quan tri...\r\n` +
    `for %%F in (published.json published.json.gz published-period.json published-period.json.gz published-catalog.json published-catalog.json.gz published-credit-plan.json published-credit-plan.json.gz config.json) do (\r\n` +
    `  if exist "%~dp0app\\%%F" copy /Y "%~dp0app\\%%F" "%BAK%\\app\\%%F" >nul\r\n` +
    `)\r\n` +
    `if exist "%~dp0app\\decision-attachments" (\r\n` +
    `  robocopy "%~dp0app\\decision-attachments" "%BAK%\\app\\decision-attachments" /E /NFL /NDL /NJH /NJS /NP >nul\r\n` +
    `)\r\n` +
    `if exist "%~dp0update-source.txt" copy /Y "%~dp0update-source.txt" "%BAK%\\update-source.txt" >nul\r\n` +
    `\r\n` +
    `echo [2/4] Chep ban moi...\r\n` +
    `robocopy "%SRC%\\app" "%~dp0app" /MIR /NFL /NDL /NJH /NJS /NP >nul\r\n` +
    `if errorlevel 8 goto :rollback\r\n` +
    `\r\n` +
    `if exist "%SRC%\\runtime\\node.exe" (\r\n` +
    `  robocopy "%SRC%\\runtime" "%~dp0runtime" /MIR /NFL /NDL /NJH /NJS /NP >nul\r\n` +
    `  if errorlevel 8 goto :rollback\r\n` +
    `)\r\n` +
    `\r\n` +
    `copy /Y "%SRC%\\server.mjs" "%~dp0server.mjs" >nul 2>nul\r\n` +
    `copy /Y "%SRC%\\check-update.mjs" "%~dp0check-update.mjs" >nul 2>nul\r\n` +
    `copy /Y "%SRC%\\setup.ps1" "%~dp0setup.ps1" >nul 2>nul\r\n` +
    `copy /Y "%SRC%\\setup.bat" "%~dp0setup.bat" >nul 2>nul\r\n` +
    `copy /Y "%SRC%\\Mo VSPPRO.bat" "%~dp0Mo VSPPRO.bat" >nul 2>nul\r\n` +
    `copy /Y "%SRC%\\VSPPRO.bat" "%~dp0VSPPRO.bat" >nul 2>nul\r\n` +
    `copy /Y "%SRC%\\Them Firewall Rule.bat" "%~dp0Them Firewall Rule.bat" >nul 2>nul\r\n` +
    `\r\n` +
    `echo [3/4] Khoi phuc du lieu da xuat ban...\r\n` +
    `call :restore\r\n` +
    `\r\n` +
    `rmdir /S /Q "%BAK%" 2>nul\r\n` +
    `echo.\r\n` +
    `echo Cap nhat xong. Hay chay "VSPPRO.bat" de su dung.\r\n` +
    `pause\r\n` +
    `exit /b 0\r\n` +
    `\r\n` +
    `:rollback\r\n` +
    `echo.\r\n` +
    `echo LOI khi chep ban moi (robocopy). Khoi phuc du lieu da xuat ban...\r\n` +
    `call :restore\r\n` +
    `rmdir /S /Q "%BAK%" 2>nul\r\n` +
    `echo Cap nhat THAT BAI. Du lieu da duoc giu nguyen.\r\n` +
    `pause\r\n` +
    `exit /b 1\r\n` +
    `\r\n` +
    `:restore\r\n` +
    `for %%F in (published.json published.json.gz published-period.json published-period.json.gz published-catalog.json published-catalog.json.gz published-credit-plan.json published-credit-plan.json.gz config.json) do (\r\n` +
    `  if exist "%BAK%\\app\\%%F" copy /Y "%BAK%\\app\\%%F" "%~dp0app\\%%F" >nul\r\n` +
    `)\r\n` +
    `if exist "%BAK%\\app\\decision-attachments" (\r\n` +
    `  robocopy "%BAK%\\app\\decision-attachments" "%~dp0app\\decision-attachments" /E /NFL /NDL /NJH /NJS /NP >nul\r\n` +
    `)\r\n` +
    `if exist "%BAK%\\update-source.txt" copy /Y "%BAK%\\update-source.txt" "%~dp0update-source.txt" >nul\r\n` +
    `goto :eof\r\n`,
  'utf8',
);

await writeFile(
  path.join(outDir, 'README.txt'),
  [
    'VSPPRO portable',
    '',
    'Cach dung tren may Windows khac:',
    '1. Copy nguyen thu muc VSPPRO nay sang may can chay.',
    '2. (Lan dau) Chay "setup.bat" de dat mat khau quan tri.',
    '3. Mo file "VSPPRO.bat" (menu) - chon 1 de khoi dong server.',
    '4. Trinh duyet se tu mo app. Neu khong tu mo, vao dia chi hien trong cua so den.',
    '',
    'Cap nhat phien ban moi (giu nguyen du lieu da xuat ban va mat khau):',
    '1. May dev chay build-portable.bat roi copy thu muc portable\\VSPPRO moi',
    '   vao thu muc chia se, vi du \\\\FILESERVER\\Share\\VSPPRO.',
    '2. May chu: mo "VSPPRO.bat" -> chon "5. Kiem tra cap nhat" -> go Y neu co ban moi.',
    '   (Truoc do ghi dung mot dong duong dan thu muc chia se vao file update-source.txt)',
    '3. Dong nghiep thay banner "Chu may da cap nhat ban moi" -> bam "Tai lai".',
    '',
    'Xem phien ban dang chay:',
    '- Trong app, nhin dong "v... - ..." o cuoi thanh ben trai.',
    '- Hoac nhin dong "Version: ..." trong cua so den cua server.',
    '',
    'Chia se cho dong nghiep cung mang LAN (cung van phong):',
    '- Trong cua so den co danh sach dia chi LAN (dang http://192.168.x.x:4173/).',
    '- Dong nghiep mo mot dia chi LAN do tren trinh duyet cua ho.',
    '- Neu dong nghiep khong truy cap duoc, chay "Them Firewall Rule.bat" (Run as administrator) mot lan.',
    '',
    'Bao mat:',
    '- Chi may chu (localhost) moi xuat ban duoc du lieu. Dong nghiep chi xem.',
    '- Mat khau quan tri khong duoc gui ra LAN. Nen dat mat khau tu 8 ky tu tro len.',
    '',
    'Luu y:',
    '- Khong xoa thu muc app, runtime hoac file server.mjs.',
    '- Cua so den phai duoc giu mo trong luc dung app.',
    '- Du lieu Excel duoc xu ly tren trinh duyet cua may dang chay app.',
    '',
  ].join('\r\n'),
  'utf8',
);

console.log(`Portable package created: ${outDir}`);
