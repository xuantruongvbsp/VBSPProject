import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, 'app');
const preferredPort = Number.parseInt(process.env.VSPPRO_PORT || '4173', 10);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.ttf', 'font/ttf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.map', 'application/json; charset=utf-8'],
]);

function safeResolve(urlPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath.split('?')[0] || '/');
  } catch {
    decodedPath = '/';
  }

  const normalized = path.normalize(decodedPath).replace(/^(\.\.[\\/])+/, '');
  const candidate = path.join(appDir, normalized);
  const relative = path.relative(appDir, candidate);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return path.join(appDir, 'index.html');
  }

  return candidate;
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': mimeTypes.get(extension) || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(response);
}

function openBrowser(url) {
  if (process.env.VSPPRO_NO_OPEN === '1') {
    return;
  }

  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '""', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }

  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(opener, [url], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

function createServer() {
  return http.createServer((request, response) => {
    const requestedFile = safeResolve(request.url || '/');
    let filePath = requestedFile;

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!existsSync(filePath)) {
      filePath = path.join(appDir, 'index.html');
    }

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('VSPPRO app files were not found.');
      return;
    }

    sendFile(response, filePath);
  });
}

function start(port) {
  const server = createServer();

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < preferredPort + 20) {
      start(port + 1);
      return;
    }

    console.error(error);
    process.exitCode = 1;
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log('VSPPRO is running locally.');
    console.log(`Open: ${url}`);
    console.log('');
    console.log('Keep this window open while using the app.');
    console.log('Press Ctrl+C to stop.');
    openBrowser(url);
  });
}

if (!existsSync(path.join(appDir, 'index.html'))) {
  console.error('Cannot find app/index.html. Please rebuild the portable package.');
  process.exit(1);
}

start(preferredPort);
