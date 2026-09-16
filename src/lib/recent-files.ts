// Lưu trữ cục bộ các tệp Báo cáo 31 đã từng nhập vào ứng dụng. Nhờ đó người
// dùng không phải tải lại tệp gốc mỗi lần mở trình duyệt — chỉ cần chọn từ
// danh sách "tệp gần đây". Toàn bộ dữ liệu được giữ trong IndexedDB của
// trình duyệt, không gửi lên máy chủ.
//
// Cấu trúc cơ sở dữ liệu:
//   - Object store `meta`  (key=id) — siêu dữ liệu nhẹ, dùng cho danh sách
//   - Object store `data`  (key=`${id}#${n}`) — LoanRecord[] chia thành từng
//     chunk `ROWS_PER_CHUNK` dòng. `meta.chunks` cho biết số chunk.
//     Bản ghi cũ (trước khi chia chunk) nằm ở key=id, không có `meta.chunks`.
//
// Vì sao chia chunk: `IDBObjectStore.put()` structured-clone giá trị NGAY
// trên main thread, đồng bộ. Ghi cả 15k–30k dòng trong một `put` là một
// khối chặn vài giây (kèm 1 value hàng chục MB cho LevelDB) → Chrome hiện
// "Wait or Exit". Chia nhỏ + `await` từng put để event loop được thở giữa
// các chunk; toàn bộ vẫn nằm trong MỘT transaction nên hoặc lưu đủ hoặc
// không lưu gì.

import type { LoanRecord } from './types';
import { upgradeLegacyRows } from './loan-record-compat';

/** Số dòng mỗi chunk — ~2–3 MB serialized, mỗi put ≈ vài chục ms. */
const ROWS_PER_CHUNK = 2000;

function chunkKey(id: string, n: number): string {
  return `${id}#${n}`;
}

const DB_NAME = 'vsppro-recent-files';
const DB_VERSION = 1;
const META_STORE = 'meta';
const DATA_STORE = 'data';

/** Siêu dữ liệu của một tệp đã nhập — đủ để hiển thị trong danh sách. */
export interface RecentFileMeta {
  id: string;
  filename: string;
  size: number;
  lastModified: number;
  importedAt: number;
  lastOpenedAt: number;
  totalRows: number;
  ngaySoLieu: Date | null;
  /** Số chunk trong store `data`. Thiếu ⇒ bản ghi cũ lưu nguyên khối ở key=id. */
  chunks?: number;
}

interface RecentFileData {
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

/** Sinh ID ổn định từ tên tệp + kích thước + thời gian sửa. */
export function makeRecentFileId(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

/** Liệt kê toàn bộ tệp gần đây, sắp xếp theo lần mở gần nhất giảm dần. */
export async function listRecentFiles(): Promise<RecentFileMeta[]> {
  return tx([META_STORE], 'readonly', async (t) => {
    const store = t.objectStore(META_STORE);
    const all = await reqAsPromise(store.getAll() as IDBRequest<RecentFileMeta[]>);
    return all.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  });
}

/** Lưu (hoặc cập nhật) một tệp vừa nhập thành công. */
export async function saveRecentFile(
  file: File,
  rows: LoanRecord[],
  ngaySoLieu: Date | null
): Promise<RecentFileMeta> {
  const now = Date.now();
  const meta: RecentFileMeta = {
    id: makeRecentFileId(file),
    filename: file.name,
    size: file.size,
    lastModified: file.lastModified,
    importedAt: now,
    lastOpenedAt: now,
    totalRows: rows.length,
    ngaySoLieu,
  };
  const chunks = Math.ceil(rows.length / ROWS_PER_CHUNK);
  meta.chunks = chunks;
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    const metaStore = t.objectStore(META_STORE);
    const dataStore = t.objectStore(DATA_STORE);
    // Giữ nguyên importedAt nếu bản ghi đã tồn tại; dọn dữ liệu cũ của cùng id
    // (bản nguyên khối hoặc các chunk dư nếu lần trước có nhiều chunk hơn).
    const existing = await reqAsPromise(
      metaStore.get(meta.id) as IDBRequest<RecentFileMeta | undefined>
    );
    if (existing) {
      meta.importedAt = existing.importedAt;
      await deleteData(dataStore, existing);
    }
    for (let n = 0; n < chunks; n++) {
      const data: RecentFileData = {
        id: chunkKey(meta.id, n),
        rows: rows.slice(n * ROWS_PER_CHUNK, (n + 1) * ROWS_PER_CHUNK),
      };
      // `await` từng put → serialize từng chunk nhỏ, giữa hai chunk event loop
      // vẫn kịp render/nhận input.
      await reqAsPromise(dataStore.put(data));
    }
    await reqAsPromise(metaStore.put(meta));
  });
  return meta;
}

/** Xóa toàn bộ dữ liệu (nguyên khối hoặc chunk) thuộc một meta. */
async function deleteData(dataStore: IDBObjectStore, meta: RecentFileMeta): Promise<void> {
  if (meta.chunks === undefined) {
    await reqAsPromise(dataStore.delete(meta.id));
    return;
  }
  for (let n = 0; n < meta.chunks; n++) {
    await reqAsPromise(dataStore.delete(chunkKey(meta.id, n)));
  }
}

/** Đọc toàn bộ rows của một meta — null nếu thiếu dữ liệu. */
async function readData(
  dataStore: IDBObjectStore,
  meta: RecentFileMeta
): Promise<LoanRecord[] | null> {
  if (meta.chunks === undefined) {
    const data = await reqAsPromise(
      dataStore.get(meta.id) as IDBRequest<RecentFileData | undefined>
    );
    return data ? data.rows : null;
  }
  const out: LoanRecord[] = [];
  for (let n = 0; n < meta.chunks; n++) {
    const data = await reqAsPromise(
      dataStore.get(chunkKey(meta.id, n)) as IDBRequest<RecentFileData | undefined>
    );
    if (!data) return null;
    for (const r of data.rows) out.push(r);
  }
  return out;
}

/** Tải lại một tệp đã lưu — trả về null nếu không tìm thấy. */
export async function loadRecentFile(id: string): Promise<{
  meta: RecentFileMeta;
  rows: LoanRecord[];
} | null> {
  return tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    const meta = await reqAsPromise(
      t.objectStore(META_STORE).get(id) as IDBRequest<RecentFileMeta | undefined>
    );
    if (!meta) return null;
    const rows = await readData(t.objectStore(DATA_STORE), meta);
    if (!rows) return null;
    // Cập nhật thời điểm mở gần nhất
    meta.lastOpenedAt = Date.now();
    await reqAsPromise(t.objectStore(META_STORE).put(meta));
    return { meta, rows: upgradeLegacyRows(rows) };
  });
}

/** Xóa một tệp khỏi danh sách. */
export async function removeRecentFile(id: string): Promise<void> {
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    const metaStore = t.objectStore(META_STORE);
    const meta = await reqAsPromise(
      metaStore.get(id) as IDBRequest<RecentFileMeta | undefined>
    );
    await reqAsPromise(metaStore.delete(id));
    if (meta) await deleteData(t.objectStore(DATA_STORE), meta);
  });
}

/** Xóa toàn bộ danh sách tệp gần đây. */
export async function clearAllRecentFiles(): Promise<void> {
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    await reqAsPromise(t.objectStore(META_STORE).clear());
    await reqAsPromise(t.objectStore(DATA_STORE).clear());
  });
}
