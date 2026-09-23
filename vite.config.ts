import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { publishPlugin } from './vite-plugin-publish';

// Tính một lần khi load config để dev/build/preview dùng chung một giá trị,
// tránh mỗi lần gọi lại ra một buildId khác nhau.
const BUILD_TS = Date.now();

// buildId dùng giờ LOCAL (không dùng toISOString vì sẽ ra giờ UTC, lệch 7 giờ
// so với Việt Nam → người dùng thấy buildId "sai").
function formatBuildId(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

const BUILD_ID = formatBuildId(new Date(BUILD_TS));

// ISO string theo giờ LOCAL kèm offset (vd 2026-09-21T14:35:22+07:00) để đồng
// nhất với buildId; toISOString() sẽ ra giờ UTC (Z) gây khó hiểu cho người xem.
function formatLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const offH = pad(Math.floor(abs / 60));
  const offM = pad(abs % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${offH}:${offM}`
  );
}

const BUILT_AT = formatLocalIso(new Date(BUILD_TS));

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};
const version = pkg.version;

// gitCommit là tùy chọn — không có git / không phải repo thì bỏ field,
// tuyệt đối không được làm fail build.
let gitCommit: string | undefined;
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim() || undefined;
} catch {
  gitCommit = undefined;
}

// Plugin ghi dist/version.json sau khi build xong (closeBundle). Chỉ có ở
// lúc build thật; dev/preview không chạy hook này nên version.json chỉ tồn
// tại trong bản portable/preview đã build.
function vspproVersionPlugin() {
  return {
    name: 'vsppro-version',
    closeBundle() {
      const content = {
        version,
        buildId: BUILD_ID,
        buildTs: BUILD_TS,
        builtAt: BUILT_AT,
        ...(gitCommit ? { gitCommit } : {}),
      };
      writeFileSync(
        path.resolve(__dirname, 'dist', 'version.json'),
        JSON.stringify(content, null, 2),
        'utf8',
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), publishPlugin(), vspproVersionPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  define: {
    // Bake phiên bản vào bundle. Không fetch /version.json để biết version
    // của chính mình — nếu fetch thì sau khi chủ máy cập nhật, file trên
    // server đã mới trong khi JS đang chạy vẫn cũ → so sánh ra "bằng nhau"
    // → banner không bao giờ hiện.
    __APP_BUILD__: JSON.stringify({ version, buildId: BUILD_ID, buildTs: BUILD_TS }),
  },
  server: {
    // Allow Cloudflare quick-tunnel hostnames (random *.trycloudflare.com per run)
    // and any LAN access. The quick-tunnel subdomain changes every restart so we
    // can't pin a single host — accept the whole trycloudflare.com suffix.
    allowedHosts: ['.trycloudflare.com'],
    // Báo cáo Excel thường được đặt ngay cạnh dự án và có thể đang mở trong
    // Excel. Không theo dõi các tệp dữ liệu để tránh lỗi EBUSY làm dừng Vite.
    watch: {
      ignored: [
        '**/*.xlsx',
        '**/*.xls',
        '**/*.csv',
        '**/*.pdf',
        '**/portable/**',
        '**/dist/**',
      ],
    },
  },
  preview: {
    allowedHosts: ['.trycloudflare.com'],
  },
});
