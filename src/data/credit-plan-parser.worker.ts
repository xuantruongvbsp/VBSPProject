/// <reference lib="webworker" />
// Worker parse Báo cáo 31 cho "Kế hoạch tín dụng → Thực tế". Cùng lý do với
// `parser.worker.ts`: đọc XLSX ~15 MB mất 30–45 s CPU, không được chạy trên
// main thread.
import { parseActualBuffer } from './credit-plan-parser';

export interface ActualParseRequest {
  buf: ArrayBuffer;
  /** Set không postMessage được gọn → truyền mảng, worker dựng lại Set. */
  nq11Ids: string[] | null;
  gqvlXaNdt: string[] | null;
  nq11NoxhIds: string[] | null;
}

self.onmessage = (e: MessageEvent<ActualParseRequest>) => {
  try {
    const { buf, nq11Ids, gqvlXaNdt, nq11NoxhIds } = e.data;
    const result = parseActualBuffer(
      buf,
      nq11Ids ? new Set(nq11Ids) : undefined,
      gqvlXaNdt ? new Set(gqvlXaNdt) : undefined,
      nq11NoxhIds ? new Set(nq11NoxhIds) : undefined
    );
    (self as unknown as Worker).postMessage({ ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export {};
