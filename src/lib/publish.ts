// Tiện ích "xuất bản dữ liệu" — chuyển bộ dữ liệu hiện tại trên trình
// duyệt của chủ sở hữu thành một tệp JSON tĩnh, rồi đưa qua trình cắm
// vite-plugin-publish để ghi vào thư mục `public/` (hoặc `dist/` khi
// chạy `vite preview`). Người xem sẽ tải lại tệp tĩnh đó khi mở trang.
//
// Nguyên tắc: KHÔNG bao giờ ghi tên tệp gốc, đường dẫn, hay bất kỳ
// trường nào nhận diện nguồn Excel vào dữ liệu đã xuất bản.

import type { LoanRecord } from './types';
import type { PeriodSnapshot } from '@/store/usePeriodStore';

const SNAPSHOT_URL = '/published.json';
const PERIOD_URL = '/published-period.json';
const PUBLISH_API_SNAPSHOT = '/__publish/snapshot';
const PUBLISH_API_PERIOD = '/__publish/period';

// ---------------------------------------------------------------------------
// Tuần tự hóa: chuyển Date → ISO string + đánh dấu để khôi phục lại sau.
// ---------------------------------------------------------------------------

const DATE_FIELDS: ReadonlyArray<keyof LoanRecord> = [
  'ngaySinh',
  'ngayVay',
  'ngayDHHopDong',
  'ngayDHGiaHan',
  'ngayGiaoDichGanNhat',
  'ngaySoLieu',
];

function rowToJson(row: LoanRecord): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const f of DATE_FIELDS) {
    const v = row[f] as Date | null;
    out[f] = v ? v.toISOString() : null;
  }
  return out;
}

function jsonToRow(j: Record<string, unknown>): LoanRecord {
  const out: Record<string, unknown> = { ...j };
  for (const f of DATE_FIELDS) {
    const v = j[f];
    out[f] = typeof v === 'string' ? new Date(v) : null;
  }
  return out as unknown as LoanRecord;
}

// ---------------------------------------------------------------------------
// Snapshot ("Phân tích một kỳ")
// ---------------------------------------------------------------------------

export interface SnapshotPublishPayload {
  v: 1;
  ngaySoLieu: string | null;
  rows: Record<string, unknown>[];
}

export function serializeSnapshot(
  rows: LoanRecord[],
  ngaySoLieu: Date | null
): string {
  const payload: SnapshotPublishPayload = {
    v: 1,
    ngaySoLieu: ngaySoLieu ? ngaySoLieu.toISOString() : null,
    rows: rows.map(rowToJson),
  };
  return JSON.stringify(payload);
}

export interface DeserializedSnapshot {
  rows: LoanRecord[];
  ngaySoLieu: Date | null;
}

export function deserializeSnapshot(text: string): DeserializedSnapshot {
  const obj = JSON.parse(text) as SnapshotPublishPayload;
  return {
    rows: obj.rows.map(jsonToRow),
    ngaySoLieu: obj.ngaySoLieu ? new Date(obj.ngaySoLieu) : null,
  };
}

/** Tải dữ liệu đã xuất bản. Trả về null khi chưa có (HTTP 404). */
export async function fetchPublishedSnapshot(): Promise<DeserializedSnapshot | null> {
  try {
    const res = await fetch(`${SNAPSHOT_URL}?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return deserializeSnapshot(text);
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Period ("So sánh giữa hai kỳ")
// ---------------------------------------------------------------------------

interface PeriodSnapshotJson {
  ngaySoLieu: string | null;
  rows: Record<string, unknown>[];
}

export interface PeriodPublishPayload {
  v: 1;
  prev: PeriodSnapshotJson;
  curr: PeriodSnapshotJson;
}

function snapshotToJson(s: PeriodSnapshot): PeriodSnapshotJson {
  return {
    ngaySoLieu: s.ngaySoLieu ? s.ngaySoLieu.toISOString() : null,
    rows: s.rows.map(rowToJson),
  };
}

function jsonToSnapshot(j: PeriodSnapshotJson): PeriodSnapshot {
  return {
    rows: j.rows.map(jsonToRow),
    ngaySoLieu: j.ngaySoLieu ? new Date(j.ngaySoLieu) : null,
    // Bỏ tên tệp gốc — người xem không cần biết
    filename: '',
    source: 'recent',
  };
}

export function serializePeriod(
  prev: PeriodSnapshot,
  curr: PeriodSnapshot
): string {
  const payload: PeriodPublishPayload = {
    v: 1,
    prev: snapshotToJson(prev),
    curr: snapshotToJson(curr),
  };
  return JSON.stringify(payload);
}

export interface DeserializedPeriod {
  prev: PeriodSnapshot;
  curr: PeriodSnapshot;
}

export function deserializePeriod(text: string): DeserializedPeriod {
  const obj = JSON.parse(text) as PeriodPublishPayload;
  return {
    prev: jsonToSnapshot(obj.prev),
    curr: jsonToSnapshot(obj.curr),
  };
}

export async function fetchPublishedPeriod(): Promise<DeserializedPeriod | null> {
  try {
    const res = await fetch(`${PERIOD_URL}?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return deserializePeriod(text);
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Gửi tệp xuất bản đến vite-plugin-publish.
// Gọi POST tới endpoint của trình cắm; trình cắm ghi tệp tĩnh trong public/
// (hoặc dist/ khi chạy preview).
// ---------------------------------------------------------------------------

async function postPayload(url: string, body: string): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Xuất bản thất bại: HTTP ${res.status} ${msg}`);
  }
}

export async function publishSnapshot(
  rows: LoanRecord[],
  ngaySoLieu: Date | null
): Promise<void> {
  const body = serializeSnapshot(rows, ngaySoLieu);
  await postPayload(PUBLISH_API_SNAPSHOT, body);
}

export async function publishPeriod(
  prev: PeriodSnapshot,
  curr: PeriodSnapshot
): Promise<void> {
  const body = serializePeriod(prev, curr);
  await postPayload(PUBLISH_API_PERIOD, body);
}

/** Xóa tệp xuất bản (gửi DELETE — trình cắm xóa file tĩnh). */
export async function unpublishSnapshot(): Promise<void> {
  await fetch(PUBLISH_API_SNAPSHOT, { method: 'DELETE' });
}
export async function unpublishPeriod(): Promise<void> {
  await fetch(PUBLISH_API_PERIOD, { method: 'DELETE' });
}
