import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, 'app');
const preferredPort = Number.parseInt(process.env.VSPPRO_PORT || '4173', 10);

const publishRoutes = new Map([
  ['/__publish/snapshot', { plain: 'published.json', gz: 'published.json.gz' }],
  ['/__publish/period', { plain: 'published-period.json', gz: 'published-period.json.gz' }],
  ['/__publish/catalog', { plain: 'published-catalog.json', gz: 'published-catalog.json.gz' }],
  [
    '/__publish/credit-plan',
    { plain: 'published-credit-plan.json', gz: 'published-credit-plan.json.gz' },
  ],
]);

const maxPublishBodyBytes = 50 * 1024 * 1024;
const attachmentPrefix = '/__publish/decision-attachment/';
const attachmentDir = 'decision-attachments';
const maxAttachmentBytes = 30 * 1024 * 1024;
const safeIdPattern = /^[a-zA-Z0-9-]{1,64}$/;

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

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function readRequestBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error(`Body quá lớn (>${Math.round(maxBytes / 1024 / 1024)} MB)`));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function tryUnlink(filePath) {
  try {
    unlinkSync(filePath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function handlePublishedData(request, response, route) {
  const gzPath = path.join(appDir, route.gz);
  const plainPath = path.join(appDir, route.plain);

  if (request.method === 'POST') {
    const body = await readRequestBody(request, maxPublishBodyBytes);
    if (body.length < 2 || body[0] !== 0x1f || body[1] !== 0x8b) {
      writeJson(response, 400, { error: 'Body không phải gzip' });
      return;
    }

    writeFileSync(gzPath, body);
    tryUnlink(plainPath);
    writeJson(response, 200, { ok: true, bytes: body.length, file: route.gz });
    return;
  }

  if (request.method === 'DELETE') {
    tryUnlink(gzPath);
    tryUnlink(plainPath);
    writeJson(response, 200, { ok: true, file: route.gz });
    return;
  }

  response.writeHead(405, { Allow: 'POST, DELETE' });
  response.end();
}

async function handleAttachment(request, response, decisionId) {
  if (!safeIdPattern.test(decisionId)) {
    writeJson(response, 400, { error: 'id không hợp lệ' });
    return;
  }

  const dir = path.join(appDir, attachmentDir);
  const filePath = path.join(dir, `${decisionId}.pdf`);

  if (request.method === 'POST') {
    const body = await readRequestBody(request, maxAttachmentBytes);
    if (
      body.length < 4 ||
      body[0] !== 0x25 ||
      body[1] !== 0x50 ||
      body[2] !== 0x44 ||
      body[3] !== 0x46
    ) {
      writeJson(response, 400, { error: 'Body không phải PDF' });
      return;
    }

    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, body);
    writeJson(response, 200, {
      ok: true,
      bytes: body.length,
      file: `${attachmentDir}/${decisionId}.pdf`,
    });
    return;
  }

  if (request.method === 'DELETE') {
    tryUnlink(filePath);
    writeJson(response, 200, { ok: true, file: `${attachmentDir}/${decisionId}.pdf` });
    return;
  }

  response.writeHead(405, { Allow: 'POST, DELETE' });
  response.end();
}

async function handlePublishRequest(request, response) {
  const urlPath = (request.url || '').split('?')[0];

  if (urlPath.startsWith(attachmentPrefix)) {
    const decisionId = decodeURIComponent(urlPath.slice(attachmentPrefix.length));
    await handleAttachment(request, response, decisionId);
    return true;
  }

  const route = publishRoutes.get(urlPath);
  if (!route) {
    return false;
  }

  await handlePublishedData(request, response, route);
  return true;
}

function spawnDetached(command, args) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function openDefaultBrowser(url) {
  if (process.platform === 'win32') {
    spawnDetached('cmd', ['/c', 'start', '""', url]);
    return;
  }

  spawnDetached(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
}

function getChromeCandidates() {
  const candidates = [
    process.env.VSPPRO_CHROME_PATH,
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LocalAppData || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];

  return candidates.filter((candidate) => candidate && existsSync(candidate));
}

function openChromeOrDefault(url) {
  const chromePath = getChromeCandidates()[0];

  if (!chromePath) {
    openDefaultBrowser(url);
    return;
  }

  spawnDetached(chromePath, ['--new-window', url]);
}

function openBrowser(url) {
  if (process.env.VSPPRO_NO_OPEN === '1') {
    return;
  }

  if (process.platform === 'win32' && process.env.VSPPRO_BROWSER === 'chrome') {
    openChromeOrDefault(url);
    return;
  }

  openDefaultBrowser(url);
}

function createServer() {
  return http.createServer((request, response) => {
    handlePublishRequest(request, response)
      .then((handled) => {
        if (handled) return;

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
      })
      .catch((error) => {
        writeJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
      });
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
