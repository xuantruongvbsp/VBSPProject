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
await copyFile(path.join(repoRoot, 'scripts', 'portable-server.mjs'), path.join(outDir, 'server.mjs'));

if (process.platform === 'win32' && existsSync(process.execPath)) {
  await copyFile(process.execPath, path.join(runtimeDir, 'node.exe'));
}

await writeFile(
  path.join(outDir, 'Mo VSPPRO.bat'),
  `@echo off\r\n` +
    `setlocal\r\n` +
    `cd /d "%~dp0"\r\n` +
    `set "NODE_EXE=%~dp0runtime\\node.exe"\r\n` +
    `if not exist "%NODE_EXE%" set "NODE_EXE=node"\r\n` +
    `"%NODE_EXE%" "%~dp0server.mjs"\r\n` +
    `echo.\r\n` +
    `echo VSPPRO stopped.\r\n` +
    `pause\r\n`,
  'utf8',
);

await writeFile(
  path.join(outDir, 'README.txt'),
  [
    'VSPPRO portable',
    '',
    'Cach dung tren may Windows khac:',
    '1. Copy nguyen thu muc VSPPRO nay sang may can chay.',
    '2. Mo file "Mo VSPPRO.bat".',
    '3. Trinh duyet se tu mo app. Neu khong tu mo, vao dia chi hien trong cua so den.',
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
