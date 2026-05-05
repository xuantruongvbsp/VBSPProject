// Lưu trữ cục bộ các tệp Báo cáo 31 đã từng nhập vào ứng dụng. Nhờ đó người
// dùng không phải tải lại tệp gốc mỗi lần mở trình duyệt — chỉ cần chọn từ
// danh sách "tệp gần đây". Toàn bộ dữ liệu được giữ trong IndexedDB của
// trình duyệt, không gửi lên máy chủ.
//
// Cấu trúc cơ sở dữ liệu:
//   - Object store `meta`  (key=id) — siêu dữ liệu nhẹ, dùng cho danh sách
//   - Object store `data`  (key=id) — bản ghi LoanRecord[] đầy đủ

import type { LoanRecord } from './types';
import { parseVnDate } from './format';

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
  const data: RecentFileData = { id: meta.id, rows };
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    // Giữ nguyên importedAt nếu bản ghi đã tồn tại
    const existing = await reqAsPromise(
      t.objectStore(META_STORE).get(meta.id) as IDBRequest<RecentFileMeta | undefined>
    );
    if (existing) {
      meta.importedAt = existing.importedAt;
    }
    await reqAsPromise(t.objectStore(META_STORE).put(meta));
    await reqAsPromise(t.objectStore(DATA_STORE).put(data));
  });
  return meta;
}

/** Bù các trường được thêm sau khi tệp đã được parse và cache. Đọc giá trị
 * từ `raw` (chứa toàn bộ 174 cột gốc) và gán vào trường đã type-hóa nếu
 * trường đó đang `undefined`. Không thay đổi gì nếu trường đã có giá trị. */
function backfillTypedFields(rows: LoanRecord[]): LoanRecord[] {
  if (rows.length === 0) return rows;
  // Một mẫu cũ sẽ thiếu các field mới — kiểm tra trên row đầu là đủ vì
  // toàn bộ rows đều xuất phát từ cùng một parser snapshot.
  const sample = rows[0];
  const needsDeposit = !('soDuTienGui105' in sample);
  const needsKhoanhDate = !('ngayHetHanKhoanh' in sample);
  if (!needsDeposit && !needsKhoanhDate) return rows;
  return rows.map((r) => {
    const raw = r.raw ?? {};
    const patch: Partial<LoanRecord> = {};
    if (needsDeposit) {
      const v = raw['Số dư tiền gửi 105'];
      patch.soDuTienGui105 = typeof v === 'number' ? v : Number(v) || 0;
    }
    if (needsKhoanhDate) {
      patch.ngayHetHanKhoanh = parseVnDate(raw['Ngày hết hạn Khoanh']);
    }
    return { ...r, ...patch } as LoanRecord;
  });
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
    const data = await reqAsPromise(
      t.objectStore(DATA_STORE).get(id) as IDBRequest<RecentFileData | undefined>
    );
    if (!data) return null;
    // Cập nhật thời điểm mở gần nhất
    meta.lastOpenedAt = Date.now();
    await reqAsPromise(t.objectStore(META_STORE).put(meta));
    return { meta, rows: backfillTypedFields(data.rows) };
  });
}

/** Xóa một tệp khỏi danh sách. */
export async function removeRecentFile(id: string): Promise<void> {
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    await reqAsPromise(t.objectStore(META_STORE).delete(id));
    await reqAsPromise(t.objectStore(DATA_STORE).delete(id));
  });
}

/** Xóa toàn bộ danh sách tệp gần đây. */
export async function clearAllRecentFiles(): Promise<void> {
  await tx([META_STORE, DATA_STORE], 'readwrite', async (t) => {
    await reqAsPromise(t.objectStore(META_STORE).clear());
    await reqAsPromise(t.objectStore(DATA_STORE).clear());
  });
}
