// Lưu trữ cục bộ "bộ tệp" đã nhập cho ứng dụng "So sánh giữa hai kỳ".
// Mô hình mới (DB v2) lưu tới 3 slot: `lastYear`, `lastMonth`, `now`.
// Mỗi bản ghi giữ nguyên đủ các slot đã nạp, để khi mở lại phục hồi
// chính xác trạng thái ban đầu (không chỉ cặp đang so sánh tại thời
// điểm lưu). Toàn bộ dữ liệu nằm trong IndexedDB của trình duyệt.

import type { LoanRecord } from './types';

const DB_NAME = 'vsppro-period-pairs';
// v2: schema 3 slot. Khi nâng cấp từ v1, các bản ghi cặp cũ bị xóa —
// chấp nhận mất lịch sử (chỉ là cache cục bộ).
const DB_VERSION = 2;
const META_STORE = 'meta';
const DATA_STORE = 'data';

export type PeriodSlotKey = 'lastYear' | 'lastMonth' | 'now';

export interface PeriodSlotMeta {
  filename: string;
  size: number;
  ngaySoLieu: Date | null;
  totalRows: number;
}

export interface RecentPeriodPairMeta {
  id: string;
  slots: Partial<Record<PeriodSlotKey, PeriodSlotMeta>>;
  importedAt: number;
  lastOpenedAt: number;
}

interface RecentPeriodPairData {
  id: string;
  rows: Partial<Record<PeriodSlotKey, LoanRecord[]>>;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Xóa stores cũ (schema v1 dạng prev/curr) nếu có và tạo lại sạch.
      for (const name of Array.from(db.objectStoreNames)) {
        db.deleteObjectStore(name);
      }
      db.createObjectStore(META_STORE, { keyPath: 'id' });
      db.createObjectStore(DATA_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Không mở được IndexedDB'));
  });
  return dbPromise;
}

function tx<T>(
  stores: string[],
  mode: IDBTransactionMode,
  fn: (t: IDBTransaction) => Promise<T> | T
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(stores, mode);
        let result: T;
        let settled = false;
        t.oncomplete = () => {
          if (!settled) {
            settled = true;
            resolve(result);
          }
        };
        t.onerror = () => {
          if (!settled) {
            settled = true;
            reject(t.error ?? new Error('Giao dịch IndexedDB thất bại'));
          }
        };
        t.onabort = () => {
          if (!settled) {
            settled = true;
            reject(t.error ?? new Error('Giao dịch IndexedDB bị hủy'));
          }
        };
        Promise.resolve(fn(t)).then(
          (r) => {
            result = r;
          },
          (err) => {
            if (!settled) {
              settled = true;
              try {
                t.abort();
              } catch {
                /* ignore */
              }
              reject(err);
            }
          }
        );
      })
  );
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Yêu cầu IndexedDB thất bại'));
  });
}

const SLOT_ORDER: readonly PeriodSlotKey[] = ['lastYear', 'lastMonth', 'now'] as const;

/** Sinh ID ổn định từ tên tệp + ngày số liệu của từng slot — đủ để cùng
 *  một bộ tệp luôn ra cùng ID, đồng thời cho phép tính lại ID từ
 *  PeriodSnapshot trong store (không cần đối tượng File). */
export function makeTripleId(
  slots: Partial<Record<PeriodSlotKey, { filename: string; ngaySoLieu: Date | null }>>
): string {
  const parts: string[] = [];
  for (const k of SLOT_ORDER) {
    const s = slots[k];
    if (!s) {
      parts.push(`${k}:-`);
    } else {
      const ts = s.ngaySoLieu ? s.ngaySoLieu.toISOString().slice(0, 10) : '';
      parts.push(`${k}:${s.filename}::${ts}`);
    }
  }
  return parts.join('|');
}

export async function listRecentPeriodPairs(): Promise<RecentPeriodPairMeta[]> {
  return tx([META_STORE], 'readonly', async (t) => {
    const all = await reqAsPromise(
      t.objectStore(META_STORE).getAll() as IDBRequest<RecentPeriodPairMeta[]>
    );
    return all.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  });
}

export interface SaveRecentTripleSlot {
  filename: string;
  /** Kích thước tệp gốc (byte) — tùy chọn, dùng để hiển thị; không tham gia ID. */
  size?: number;
  rows: LoanRecord[];
  ngaySoLieu: Date | null;
}

export interface SaveRecentTripleInput {
  slots: Partial<Record<PeriodSlotKey, SaveRecentTripleSlot>>;
}

export async function saveRecentPeriodPair(
  input: SaveRecentTripleInput
): Promise<RecentPeriodPairMeta> {
  const idInput: Partial<Record<PeriodSlotKey, { filename: string; ngaySoLieu: Date | null }>> = {};
  for (const k of SLOT_ORDER) {
    const s = input.slots[k];
    if (s) idInput[k] = { filename: s.filename, ngaySoLieu: s.ngaySoLieu };
  }
  const id = makeTripleId(idInput);
  const now = Date.now();

  const slotsMeta: Partial<Record<PeriodSlotKey, PeriodSlotMeta>> = {};
  const rowsBySlot: Partial<Record<PeriodSlotKey, LoanRecord[]>> = {};
  for (const k of SLOT_ORDER) {
    const s = input.slots[k];
    if (!s) continue;
    slotsMeta[k] = {
      filename: s.filename,
      size: s.size ?? 0,
      ngaySoLieu: s.ngaySoLieu,
      totalRows: s.rows.length,
    };
    rowsBySlot[k] = s.rows;
  }

  const meta: RecentPeriodPairMeta = {
    id,
    slots: slotsMeta,
    importedAt: now,
    lastOpenedAt: now,
  };
  const data: RecentPeriodPairData = { id, rows: rowsBySlot };

  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    const existing = await reqAsPromise(
      t.objectStore(META_STORE).get(id) as IDBRequest<RecentPeriodPairMeta | undefined>
    );
    if (existing) meta.importedAt = existing.importedAt;
    await reqAsPromise(t.objectStore(META_STORE).put(meta));
    await reqAsPromise(t.objectStore(DATA_STORE).put(data));
  });
  return meta;
}

export interface LoadRecentTripleResult {
  meta: RecentPeriodPairMeta;
  rows: Partial<Record<PeriodSlotKey, LoanRecord[]>>;
}

export async function loadRecentPeriodPair(
  id: string
): Promise<LoadRecentTripleResult | null> {
  return tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    const meta = await reqAsPromise(
      t.objectStore(META_STORE).get(id) as IDBRequest<RecentPeriodPairMeta | undefined>
    );
    if (!meta) return null;
    const data = await reqAsPromise(
      t.objectStore(DATA_STORE).get(id) as IDBRequest<RecentPeriodPairData | undefined>
    );
    if (!data) return null;
    meta.lastOpenedAt = Date.now();
    await reqAsPromise(t.objectStore(META_STORE).put(meta));
    return { meta, rows: data.rows };
  });
}

export async function removeRecentPeriodPair(id: string): Promise<void> {
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    await reqAsPromise(t.objectStore(META_STORE).delete(id));
    await reqAsPromise(t.objectStore(DATA_STORE).delete(id));
  });
}

export async function clearAllRecentPeriodPairs(): Promise<void> {
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    await reqAsPromise(t.objectStore(META_STORE).clear());
    await reqAsPromise(t.objectStore(DATA_STORE).clear());
  });
}
