import type { ImportResult } from '../lib/types';

export function parseExcelFile(file: File): Promise<ImportResult> {
  return new Promise(async (resolve, reject) => {
    try {
      const buf = await file.arrayBuffer();
      const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e) => {
        if (e.data?.ok) resolve(e.data.result as ImportResult);
        else reject(new Error(e.data?.error || 'Lỗi không xác định khi đọc tệp'));
        worker.terminate();
      };
      worker.onerror = (e) => {
        reject(new Error(e.message));
        worker.terminate();
      };
      worker.postMessage(buf, [buf]);
    } catch (e) {
      reject(e);
    }
  });
}
