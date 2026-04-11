// Trình cắm Vite mở hai endpoint nội bộ để chủ sở hữu xuất bản dữ liệu:
//
//   POST   /__publish/snapshot      → ghi public/published.json
//   POST   /__publish/period        → ghi public/published-period.json
//   DELETE /__publish/snapshot      → xóa published.json
//   DELETE /__publish/period        → xóa published-period.json
//
// Khi chạy `vite preview` (sau khi build), tệp được ghi vào dist/ thay vì
// public/ để được phục vụ ngay lập tức cho người xem.

import type { Plugin, ViteDevServer, PreviewServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROUTES: Record<string, string> = {
  '/__publish/snapshot': 'published.json',
  '/__publish/period': 'published-period.json',
};

// 200 MB tối đa — đủ cho ~15k khế ước với toàn bộ raw fields
const MAX_BODY_BYTES = 200 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (c: Buffer) => {
      total += c.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Tệp xuất bản quá lớn (>200 MB)'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function writeJson(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  targetDir: string
): Promise<void> {
  const url = (req.url || '').split('?')[0];
  const filename = ROUTES[url];
  if (!filename) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const filepath = path.join(targetDir, filename);

  try {
    if (req.method === 'POST') {
      const buf = await readBody(req);
      // Xác thực đây là JSON hợp lệ trước khi ghi
      try {
        JSON.parse(buf.toString('utf-8'));
      } catch {
        writeJson(res, 400, { error: 'Body không phải JSON hợp lệ' });
        return;
      }
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(filepath, buf);
      writeJson(res, 200, { ok: true, bytes: buf.length, file: filename });
      return;
    }
    if (req.method === 'DELETE') {
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
      writeJson(res, 200, { ok: true, file: filename });
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
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url in ROUTES) {
          handle(req, res, publicDir);
          return;
        }
        next();
      });
    },

    configurePreviewServer(server: PreviewServer) {
      // Chế độ preview: ghi vào dist/ vì public/ không còn được phục vụ
      const distDir = server.config.build.outDir || path.resolve('dist');
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        if (url in ROUTES) {
          handle(req, res, distDir);
          return;
        }
        next();
      });
    },
  };
}
