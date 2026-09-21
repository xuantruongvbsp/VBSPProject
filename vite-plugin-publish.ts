// Trình cắm Vite mở hai endpoint nội bộ để chủ sở hữu xuất bản dữ liệu:
//
//   POST   /__publish/snapshot      → ghi public/published.json[.gz]
//   POST   /__publish/period        → ghi public/published-period.json[.gz]
//   DELETE /__publish/snapshot      → xóa cả published.json và .json.gz
//   DELETE /__publish/period        → xóa cả published-period.json và .json.gz
//
// Phía trình duyệt (`src/lib/publish.ts`) gửi body đã nén gzip kèm header
// `Content-Encoding: gzip` → server ghi nguyên bytes vào tệp `.json.gz`,
// không cần giải nén / parse lại. Tỉ lệ ~10× giảm dung lượng on-disk và
// on-wire so với plain JSON cũ.
//
// Khi chạy `vite preview` (sau khi build), tệp được ghi vào dist/ thay vì
// public/ để được phục vụ ngay lập tức cho người xem.

import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface RouteSpec {
  /** Tên file plain (cũ) — vẫn xoá khi DELETE và khi POST gzip mới. */
  plain: string;
  /** Tên file gzip (mới). */
  gz: string;
}

const ROUTES: Record<string, RouteSpec> = {
  '/__publish/snapshot': { plain: 'published.json', gz: 'published.json.gz' },
  '/__publish/period': {
    plain: 'published-period.json',
    gz: 'published-period.json.gz',
  },
  '/__publish/catalog': {
    plain: 'published-catalog.json',
    gz: 'published-catalog.json.gz',
  },
  '/__publish/credit-plan': {
    plain: 'published-credit-plan.json',
    gz: 'published-credit-plan.json.gz',
  },
};

// Body đã được trình duyệt nén → giới hạn 50 MB là dư cho ~30k khế ước × 2 kỳ.
// (Plain JSON 99 MB → gzip ~10 MB; để 50 MB phòng dữ liệu phình to.)
const MAX_BODY_BYTES = 50 * 1024 * 1024;

const ATTACHMENT_PREFIX = '/__publish/decision-attachment/';
const ATTACHMENT_DIR = 'decision-attachments';
// Giới hạn cao hơn cho PDF — phù hợp với MAX_ATTACHMENT_SIZE=25 MB ở client.
const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024;
// Whitelist id: chỉ cho phép a-z, A-Z, 0-9, dấu gạch ngang. Khớp với
// crypto.randomUUID() dạng v4. Loại trừ '/', '..', null bytes → tránh path
// traversal khi nhận id từ URL ngoài.
const SAFE_ID_REGEX = /^[a-zA-Z0-9-]{1,64}$/;

// Khi dev/preview server được expose ra mạng (`--host` / host 0.0.0.0 hoặc IP
// cụ thể), chỉ cho phép máy chủ (loopback) ghi publish — tránh người khác cùng
// LAN ghi đè/xóa dữ liệu. Mặc định Vite chỉ bind localhost nên không cần siết.
function isLoopback(req: IncomingMessage): boolean {
  const addr = req.socket?.remoteAddress || '';
  const normalized = addr.replace(/^::ffff:/i, '');
  return normalized === '127.0.0.1' || normalized === '::1';
}

function isWriteMethod(method: string | undefined): boolean {
  const m = (method || 'GET').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'DELETE';
}

function isExposedHost(host: unknown): boolean {
  if (host === true) return true;
  if (typeof host === 'string') {
    return host !== '127.0.0.1' && host !== 'localhost' && host !== '::1';
  }
  return false;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (c: Buffer) => {
      total += c.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Tệp xuất bản quá lớn (>50 MB sau gzip)'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Xoá file nếu tồn tại; ENOENT là bình thường và bỏ qua. */
function tryUnlink(filepath: string): void {
  try {
    fs.unlinkSync(filepath);
  } catch (e: unknown) {
    if (
      !(
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code?: string }).code === 'ENOENT'
      )
    ) {
      throw e;
    }
  }
}

function writeJson(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readAttachmentBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (c: Buffer) => {
      total += c.length;
      if (total > MAX_ATTACHMENT_BYTES) {
        reject(new Error('File PDF quá lớn (>30 MB)'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  targetDir: string,
  id: string
): Promise<void> {
  if (!SAFE_ID_REGEX.test(id)) {
    writeJson(res, 400, { error: 'id không hợp lệ' });
    return;
  }
  const dir = path.join(targetDir, ATTACHMENT_DIR);
  const filepath = path.join(dir, `${id}.pdf`);

  if (req.method === 'POST') {
    const buf = await readAttachmentBody(req);
    // Body PDF bắt đầu bằng "%PDF" — magic bytes 0x25 0x50 0x44 0x46.
    // Server không bắt buộc nhận đúng PDF (client đã validate), nhưng kiểm
    // tra rẻ tiền để chặn upload nhầm file.
    if (
      buf.length < 4 ||
      buf[0] !== 0x25 ||
      buf[1] !== 0x50 ||
      buf[2] !== 0x44 ||
      buf[3] !== 0x46
    ) {
      writeJson(res, 400, { error: 'Body không phải PDF' });
      return;
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filepath, buf);
    writeJson(res, 200, { ok: true, bytes: buf.length, file: `${ATTACHMENT_DIR}/${id}.pdf` });
    return;
  }
  if (req.method === 'DELETE') {
    tryUnlink(filepath);
    writeJson(res, 200, { ok: true, file: `${ATTACHMENT_DIR}/${id}.pdf` });
    return;
  }
  res.statusCode = 405;
  res.end();
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  targetDir: string,
  enforceLocalOnly = false
): Promise<void> {
  const url = (req.url || '').split('?')[0];

  if (enforceLocalOnly && isWriteMethod(req.method) && !isLoopback(req)) {
    writeJson(res, 403, {
      error: 'Chỉ chủ máy (localhost) mới được xuất bản dữ liệu.',
    });
    return;
  }

  // Routes động cho file đính kèm PDF: /__publish/decision-attachment/<id>
  if (url.startsWith(ATTACHMENT_PREFIX)) {
    const id = url.slice(ATTACHMENT_PREFIX.length);
    try {
      await handleAttachment(req, res, targetDir, id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      writeJson(res, 500, { error: msg });
    }
    return;
  }

  const route = ROUTES[url];
  if (!route) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const gzPath = path.join(targetDir, route.gz);
  const plainPath = path.join(targetDir, route.plain);

  try {
    if (req.method === 'POST') {
      const buf = await readBody(req);
      // Body phải bắt đầu bằng magic bytes của gzip (1f 8b). Kiểm tra rẻ
      // tiền — không tự giải nén, vì server chỉ ghi nguyên bytes.
      if (buf.length < 2 || buf[0] !== 0x1f || buf[1] !== 0x8b) {
        writeJson(res, 400, {
          error: 'Body không phải gzip (cần Content-Encoding: gzip)',
        });
        return;
      }
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(gzPath, buf);
      // Xoá biến thể plain cũ (nếu còn) để viewer không tải nhầm phiên bản
      // dữ liệu cũ qua đường fallback `.json`.
      tryUnlink(plainPath);
      writeJson(res, 200, { ok: true, bytes: buf.length, file: route.gz });
      return;
    }
    if (req.method === 'DELETE') {
      tryUnlink(gzPath);
      tryUnlink(plainPath);
      writeJson(res, 200, { ok: true, file: route.gz });
      return;
    }
    res.statusCode = 405;
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    writeJson(res, 500, { error: msg });
  }
}

export function publishPlugin(): Plugin {
  return {
    name: 'vsppro-publish',
    apply: () => true,

    configureServer(server: ViteDevServer) {
      // Chế độ dev: ghi vào public/ — Vite sẽ tự phục vụ ngay
      const publicDir = server.config.publicDir || path.resolve('public');
      const enforce = isExposedHost(server.config.server.host) &&
        process.env.VSPPRO_ALLOW_REMOTE_PUBLISH !== '1';
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url in ROUTES || url.startsWith(ATTACHMENT_PREFIX)) {
          handle(req, res, publicDir, enforce);
          return;
        }
        next();
      });
    },

    configurePreviewServer(server: PreviewServer) {
      // Chế độ preview: ghi vào dist/ vì public/ không còn được phục vụ
      const distDir = server.config.build.outDir || path.resolve('dist');
      const enforce = isExposedHost(server.config.preview.host) &&
        process.env.VSPPRO_ALLOW_REMOTE_PUBLISH !== '1';
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url in ROUTES || url.startsWith(ATTACHMENT_PREFIX)) {
          handle(req, res, distDir, enforce);
          return;
        }
        next();
      });
    },
  };
}
