// Lưu trữ cục bộ "bộ tệp" đã nhập cho ứng dụng "So sánh giữa hai kỳ".
// Mô hình mới (DB v2) lưu tới 3 slot: `lastYear`, `lastMonth`, `now`.
// Mỗi bản ghi giữ nguyên đủ các slot đã nạp, để khi mở lại phục hồi
// chính xác trạng thái ban đầu (không chỉ cặp đang so sánh tại thời
// điểm lưu). Toàn bộ dữ liệu nằm trong IndexedDB của trình duyệt.
//
// Store `data` chia rows của từng slot thành chunk `ROWS_PER_CHUNK` dòng,
// key = `${id}#${slot}#${n}`; `meta.chunked = true` + `slots[k].chunks` cho
// biết số chunk. Bản ghi cũ lưu nguyên khối ở key=id (`meta.chunked` thiếu).
// Lý do chia chunk giống `recent-files.ts`: `put()` một khối 2–3 tệp × 15k
// dòng structured-clone đồng bộ trên main thread nhiều giây → Chrome "Wait
// or Exit".

import type { LoanRecord } from './types';
import { upgradeLegacyRows } from './loan-record-compat';

const ROWS_PER_CHUNK = 2000;

function chunkKey(id: string, slot: PeriodSlotKey, n: number): string {
  return `${id}#${slot}#${n}`;
}

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
  /** Số chunk của slot trong store `data` (chỉ có khi `meta.chunked`). */
  chunks?: number;
}

export interface RecentPeriodPairMeta {
  id: string;
  slots: Partial<Record<PeriodSlotKey, PeriodSlotMeta>>;
  importedAt: number;
  lastOpenedAt: number;
  /** true ⇒ rows nằm ở các chunk `${id}#${slot}#${n}`; thiếu ⇒ nguyên khối key=id. */
  chunked?: true;
}

/** Bản ghi cũ: toàn bộ slot trong một value. */
interface RecentPeriodPairData {
  id: string;
  rows: Partial<Record<PeriodSlotKey, LoanRecord[]>>;
}

/** Bản ghi mới: một chunk của một slot. */
interface RecentPeriodChunk {
  id: string;
  rows: LoanRecord[];
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
  for (const k of SLOT_ORDER) {
    const s = input.slots[k];
    if (!s) continue;
    slotsMeta[k] = {
      filename: s.filename,
      size: s.size ?? 0,
      ngaySoLieu: s.ngaySoLieu,
      totalRows: s.rows.length,
      chunks: Math.ceil(s.rows.length / ROWS_PER_CHUNK),
    };
  }

  const meta: RecentPeriodPairMeta = {
    id,
    slots: slotsMeta,
    importedAt: now,
    lastOpenedAt: now,
    chunked: true,
  };

  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    const metaStore = t.objectStore(META_STORE);
    const dataStore = t.objectStore(DATA_STORE);
    const existing = await reqAsPromise(
      metaStore.get(id) as IDBRequest<RecentPeriodPairMeta | undefined>
    );
    if (existing) {
      meta.importedAt = existing.importedAt;
      await deleteData(dataStore, existing);
    }
    for (const k of SLOT_ORDER) {
      const s = input.slots[k];
      if (!s) continue;
      const chunks = slotsMeta[k]!.chunks!;
      for (let n = 0; n < chunks; n++) {
        const chunk: RecentPeriodChunk = {
          id: chunkKey(id, k, n),
          rows: s.rows.slice(n * ROWS_PER_CHUNK, (n + 1) * ROWS_PER_CHUNK),
        };
        // `await` từng put → mỗi lần chỉ serialize một chunk nhỏ.
        await reqAsPromise(dataStore.put(chunk));
      }
    }
    await reqAsPromise(metaStore.put(meta));
  });
  return meta;
}

/** Xóa toàn bộ dữ liệu (nguyên khối hoặc chunk) thuộc một meta. */
async function deleteData(
  dataStore: IDBObjectStore,
  meta: RecentPeriodPairMeta
): Promise<void> {
  if (!meta.chunked) {
    await reqAsPromise(dataStore.delete(meta.id));
    return;
  }
  for (const k of SLOT_ORDER) {
    const chunks = meta.slots[k]?.chunks ?? 0;
    for (let n = 0; n < chunks; n++) {
      await reqAsPromise(dataStore.delete(chunkKey(meta.id, k, n)));
    }
  }
}

/** Đọc rows của mọi slot — null nếu thiếu dữ liệu. */
async function readData(
  dataStore: IDBObjectStore,
  meta: RecentPeriodPairMeta
): Promise<Partial<Record<PeriodSlotKey, LoanRecord[]>> | null> {
  if (!meta.chunked) {
    const data = await reqAsPromise(
      dataStore.get(meta.id) as IDBRequest<RecentPeriodPairData | undefined>
    );
    return data ? data.rows : null;
  }
  const out: Partial<Record<PeriodSlotKey, LoanRecord[]>> = {};
  for (const k of SLOT_ORDER) {
    const slotMeta = meta.slots[k];
    if (!slotMeta) continue;
    const rows: LoanRecord[] = [];
    for (let n = 0; n < (slotMeta.chunks ?? 0); n++) {
      const chunk = await reqAsPromise(
        dataStore.get(chunkKey(meta.id, k, n)) as IDBRequest<RecentPeriodChunk | undefined>
      );
      if (!chunk) return null;
      for (const r of chunk.rows) rows.push(r);
    }
    out[k] = rows;
  }
  return out;
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
    const rows = await readData(t.objectStore(DATA_STORE), meta);
    if (!rows) return null;
    meta.lastOpenedAt = Date.now();
    await reqAsPromise(t.objectStore(META_STORE).put(meta));
    // Cache cũ còn `raw` (174 cột/dòng) → dọn ngay để không giữ trong RAM.
    for (const k of SLOT_ORDER) {
      const r = rows[k];
      if (r) rows[k] = upgradeLegacyRows(r);
    }
    return { meta, rows };
  });
}

export async function removeRecentPeriodPair(id: string): Promise<void> {
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    const metaStore = t.objectStore(META_STORE);
    const meta = await reqAsPromise(
      metaStore.get(id) as IDBRequest<RecentPeriodPairMeta | undefined>
    );
    await reqAsPromise(metaStore.delete(id));
    if (meta) await deleteData(t.objectStore(DATA_STORE), meta);
  });
}

export async function clearAllRecentPeriodPairs(): Promise<void> {
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    await reqAsPromise(t.objectStore(META_STORE).clear());
    await reqAsPromise(t.objectStore(DATA_STORE).clear());
  });
}
