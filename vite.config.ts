import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { publishPlugin } from './vite-plugin-publish';

export default defineConfig({
  plugins: [react(), publishPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
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
