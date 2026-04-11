// Lưu trữ cục bộ các cặp tệp Báo cáo 31 đã được nhập cho ứng dụng
// "So sánh giữa hai kỳ". Hai slot (`prev`, `curr`) được lưu trong cùng một
// bản ghi để mở lại đúng cặp ban đầu. Nguyên tắc kế thừa từ
// `recent-files.ts` — mọi dữ liệu nằm hoàn toàn trong IndexedDB của
// trình duyệt, không gửi lên máy chủ.

import type { LoanRecord } from './types';

const DB_NAME = 'vsppro-period-pairs';
const DB_VERSION = 1;
const META_STORE = 'meta';
const DATA_STORE = 'data';

export interface RecentPeriodPairMeta {
  id: string;
  prevFilename: string;
  currFilename: string;
  prevSize: number;
  currSize: number;
  prevNgaySoLieu: Date | null;
  currNgaySoLieu: Date | null;
  prevTotalRows: number;
  currTotalRows: number;
  importedAt: number;
  lastOpenedAt: number;
}

interface RecentPeriodPairData {
  id: string;
  prevRows: LoanRecord[];
  currRows: LoanRecord[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE, { keyPath: 'id' });
      }
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

export function makePairId(prev: File, curr: File): string {
  return `${prev.name}::${prev.size}::${prev.lastModified}|${curr.name}::${curr.size}::${curr.lastModified}`;
}

export async function listRecentPeriodPairs(): Promise<RecentPeriodPairMeta[]> {
  return tx([META_STORE], 'readonly', async (t) => {
    const all = await reqAsPromise(
      t.objectStore(META_STORE).getAll() as IDBRequest<RecentPeriodPairMeta[]>
    );
    return all.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  });
}

export interface SaveRecentPairInput {
  prev: { file: File; rows: LoanRecord[]; ngaySoLieu: Date | null };
  curr: { file: File; rows: LoanRecord[]; ngaySoLieu: Date | null };
}

export async function saveRecentPeriodPair(
  input: SaveRecentPairInput
): Promise<RecentPeriodPairMeta> {
  const { prev, curr } = input;
  const now = Date.now();
  const meta: RecentPeriodPairMeta = {
    id: makePairId(prev.file, curr.file),
    prevFilename: prev.file.name,
    currFilename: curr.file.name,
    prevSize: prev.file.size,
    currSize: curr.file.size,
    prevNgaySoLieu: prev.ngaySoLieu,
    currNgaySoLieu: curr.ngaySoLieu,
    prevTotalRows: prev.rows.length,
    currTotalRows: curr.rows.length,
    importedAt: now,
    lastOpenedAt: now,
  };
  const data: RecentPeriodPairData = {
    id: meta.id,
    prevRows: prev.rows,
    currRows: curr.rows,
  };
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    const existing = await reqAsPromise(
      t.objectStore(META_STORE).get(meta.id) as IDBRequest<RecentPeriodPairMeta | undefined>
    );
    if (existing) meta.importedAt = existing.importedAt;
    await reqAsPromise(t.objectStore(META_STORE).put(meta));
    await reqAsPromise(t.objectStore(DATA_STORE).put(data));
  });
  return meta;
}

export async function loadRecentPeriodPair(id: string): Promise<{
  meta: RecentPeriodPairMeta;
  prevRows: LoanRecord[];
  currRows: LoanRecord[];
} | null> {
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
    return { meta, prevRows: data.prevRows, currRows: data.currRows };
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
