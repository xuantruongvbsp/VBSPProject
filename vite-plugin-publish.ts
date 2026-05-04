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
};

// Body đã được trình duyệt nén → giới hạn 50 MB là dư cho ~30k khế ước × 2 kỳ.
// (Plain JSON 99 MB → gzip ~10 MB; để 50 MB phòng dữ liệu phình to.)
const MAX_BODY_BYTES = 50 * 1024 * 1024;

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

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  targetDir: string
): Promise<void> {
  const url = (req.url || '').split('?')[0];
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
