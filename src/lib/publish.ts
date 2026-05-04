// Tiện ích "xuất bản dữ liệu" — chuyển bộ dữ liệu hiện tại trên trình
// duyệt của chủ sở hữu thành một tệp JSON tĩnh, rồi đưa qua trình cắm
// vite-plugin-publish để ghi vào thư mục `public/` (hoặc `dist/` khi
// chạy `vite preview`). Người xem sẽ tải lại tệp tĩnh đó khi mở trang.
//
// Nguyên tắc: KHÔNG bao giờ ghi tên tệp gốc, đường dẫn, hay bất kỳ
// trường nào nhận diện nguồn Excel vào dữ liệu đã xuất bản.

import type { LoanRecord } from './types';
import type {
  ComparePair,
  PeriodSlotKey,
  PeriodSnapshot,
} from '@/store/usePeriodStore';

// File xuất bản được nén gzip để giảm kích thước on-wire ~10× (49 MB → ~5 MB).
// Tệp `.json` cũ vẫn được fetch fallback để tương thích ngược trong giai đoạn
// chuyển tiếp — sẽ bỏ sau khi mọi triển khai đã re-publish.
const SNAPSHOT_URL_GZ = '/published.json.gz';
const SNAPSHOT_URL_PLAIN = '/published.json';
const PERIOD_URL_GZ = '/published-period.json.gz';
const PERIOD_URL_PLAIN = '/published-period.json';
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
  'ngayDHGDXA',
  'ngayGiaoDichGanNhat',
  'ngaySoLieu',
];

/**
 * Báo cáo 31 có 174 cột — `LoanRecord.raw` giữ nguyên cả 174 để hiển thị
 * chi tiết khế ước. Tuy nhiên người xem chỉ mở `LoanDetailDrawer`, và
 * drawer chỉ đọc một tập nhỏ ~49 khóa. Nếu serialize toàn bộ raw, payload
 * "So sánh hai kỳ" (2 × ~30k dòng) phình lên ~200 MB và làm Chrome OOM.
 *
 * Danh sách dưới đây phải khớp với các trường được khai trong
 * `src/components/detail/LoanDetailDrawer.tsx` (`sections`). Nếu drawer
 * thêm trường mới → cập nhật cả ở đây.
 */
const RAW_KEYS_FOR_VIEWER: ReadonlyArray<string> = [
  // Đơn vị quản lý
  'Mã CN', 'Mã PGD', 'Tên PGD', 'Mã xã', 'Tên xã', 'Tên thôn',
  // Khách hàng
  'Mã KH', 'Tên KH', 'Ngày sinh', 'Giới tính', 'Phân loại', 'Loại KH',
  'Tên DT', 'Số CMND', 'Nơi cấp CMND', 'Địa chỉ', 'Số điện thoại',
  // Tổ TK&VV và Đơn vị ủy thác
  'Mã tổ', 'Tên tổ', 'Loại tổ', 'Mã ĐVUT', 'Tên ĐVUT',
  // Khế ước
  'Số khế ước', 'Ngày vay', 'Ngày ĐH theo hợp đồng', 'Ngày ĐH theo Gia hạn',
  'Thời hạn vay', 'Lãi suất', 'Hình thức vay', 'Tình trạng món vay',
  // Số dư & Giải ngân
  'Mức vay', 'Tổng giải ngân', 'Dư nợ trong hạn', 'Dư nợ quá hạn',
  'Dư nợ khoanh', 'Tổng dư nợ', 'Gốc đã trả', 'Giải ngân trong tháng',
  // Lãi & Thu nợ
  'Tổng thu lãi TH', 'Lãi tồn TH', 'Tổng thu lãi QH', 'Lãi tồn QH',
  'Lãi DT chưa đến hạn', 'Thu lãi TH tháng', 'Thu nợ TH tháng',
  // Chương trình tín dụng
  'Mã chương trình', 'Tên chương trình', 'Tên Quyết định', 'Nguồn vốn',
  'Tên ĐTTH',
];

function pickRawForViewer(raw: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  for (const k of RAW_KEYS_FOR_VIEWER) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

function rowToJson(row: LoanRecord): Record<string, unknown> {
  const { raw, ...rest } = row;
  const out: Record<string, unknown> = { ...rest, raw: pickRawForViewer(raw) };
  for (const f of DATE_FIELDS) {
    const v = row[f];
    // Cứng tay: chỉ chấp nhận Date hợp lệ, mọi thứ khác → null. Tránh
    // JSON.stringify gặp số ngày Excel hay 'Invalid Date' rồi sản xuất
    // chuỗi không thể parse lại.
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      out[f] = v.toISOString();
    } else {
      out[f] = null;
    }
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

/**
 * Tải `url` rồi giải nén nếu cần. Khó là: Vite (và nhiều static server)
 * tự đặt `Content-Encoding: gzip` cho file `.gz` → trình duyệt đã giải nén
 * sẵn body khi `fetch` trả về. Nếu mình lại chạy `DecompressionStream`
 * lần nữa thì lỗi "incorrect header check" và viewer hiển thị "không có
 * dữ liệu". Ngược lại, có server chỉ trả thẳng bytes gzip mà không đặt
 * header → cần tự giải nén.
 *
 * Giải pháp: đọc ArrayBuffer rồi nhìn 2 byte đầu — gzip magic là `1f 8b`.
 * Còn `1f 8b` ⇒ vẫn là gzip thô, tự giải. Khác ⇒ trình duyệt đã giải
 * sẵn, decode UTF-8 trực tiếp. Không phụ thuộc header `Content-Encoding`
 * (trình duyệt thường strip header này sau khi auto-decompress).
 */
async function fetchAndMaybeUngzip(url: string): Promise<string | null> {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b) {
    const stream = new Blob([buf])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }
  return new TextDecoder('utf-8').decode(buf);
}

/** Tải dữ liệu đã xuất bản. Ưu tiên `.gz`, fallback `.json` cho dữ liệu cũ. */
export async function fetchPublishedSnapshot(): Promise<DeserializedSnapshot | null> {
  try {
    const text =
      (await fetchAndMaybeUngzip(SNAPSHOT_URL_GZ)) ??
      (await fetchAndMaybeUngzip(SNAPSHOT_URL_PLAIN));
    if (text === null) return null;
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

/** Payload v1 (cũ): chỉ có prev + curr — chỉ giữ lại để đọc tệp legacy. */
export interface PeriodPublishPayloadV1 {
  v: 1;
  prev: PeriodSnapshotJson;
  curr: PeriodSnapshotJson;
}

/**
 * Payload v2: 3 slot dữ liệu (lastYear, lastMonth, now) + cặp đang so sánh
 * (`comparePair`). Mỗi slot là tùy chọn — chủ sở hữu có thể chỉ nạp 2/3 tệp.
 * Người xem hydrate y nguyên 3 slot, giữ được toggle "Cuối năm trước".
 */
export interface PeriodPublishPayloadV2 {
  v: 2;
  slots: {
    lastYear?: PeriodSnapshotJson | null;
    lastMonth?: PeriodSnapshotJson | null;
    now?: PeriodSnapshotJson | null;
  };
  comparePair: ComparePair;
}

export type PeriodPublishPayload =
  | PeriodPublishPayloadV1
  | PeriodPublishPayloadV2;

function jsonToSnapshot(j: PeriodSnapshotJson): PeriodSnapshot {
  return {
    rows: j.rows.map(jsonToRow),
    ngaySoLieu: j.ngaySoLieu ? new Date(j.ngaySoLieu) : null,
    // Bỏ tên tệp gốc — người xem không cần biết
    filename: '',
    source: 'recent',
  };
}

function snapshotToJsonInline(s: PeriodSnapshot): PeriodSnapshotJson {
  return {
    ngaySoLieu: s.ngaySoLieu ? s.ngaySoLieu.toISOString() : null,
    rows: s.rows.map(rowToJson),
  };
}

export interface PeriodPublishSlots {
  lastYear: PeriodSnapshot | null;
  lastMonth: PeriodSnapshot | null;
  now: PeriodSnapshot | null;
}

export function serializePeriod(
  slots: PeriodPublishSlots,
  comparePair: ComparePair
): string {
  // Lưu ý: hàm này chỉ dùng cho test/back-compat. Đường gửi thực tế
  // (`publishPeriod`) sử dụng bản streaming bên dưới để tránh OOM.
  const payload: PeriodPublishPayloadV2 = {
    v: 2,
    slots: {
      lastYear: slots.lastYear ? snapshotToJsonInline(slots.lastYear) : null,
      lastMonth: slots.lastMonth ? snapshotToJsonInline(slots.lastMonth) : null,
      now: slots.now ? snapshotToJsonInline(slots.now) : null,
    },
    comparePair,
  };
  return JSON.stringify(payload);
}

export interface DeserializedPeriod {
  slots: PeriodPublishSlots;
  comparePair: ComparePair;
}

export function deserializePeriod(text: string): DeserializedPeriod {
  const obj = JSON.parse(text) as PeriodPublishPayload;
  if (obj.v === 2) {
    const slots: PeriodPublishSlots = {
      lastYear: obj.slots.lastYear ? jsonToSnapshot(obj.slots.lastYear) : null,
      lastMonth: obj.slots.lastMonth
        ? jsonToSnapshot(obj.slots.lastMonth)
        : null,
      now: obj.slots.now ? jsonToSnapshot(obj.slots.now) : null,
    };
    return { slots, comparePair: obj.comparePair };
  }
  // v1 legacy: chỉ có prev/curr → đổ vào lastMonth/now (giữ nguyên hành vi cũ).
  const slots: PeriodPublishSlots = {
    lastYear: null,
    lastMonth: jsonToSnapshot(obj.prev),
    now: jsonToSnapshot(obj.curr),
  };
  return { slots, comparePair: { a: 'lastMonth', b: 'now' } };
}

export async function fetchPublishedPeriod(): Promise<DeserializedPeriod | null> {
  try {
    const text =
      (await fetchAndMaybeUngzip(PERIOD_URL_GZ)) ??
      (await fetchAndMaybeUngzip(PERIOD_URL_PLAIN));
    if (text === null) return null;
    return deserializePeriod(text);
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Gửi tệp xuất bản đến vite-plugin-publish.
//
// Lý do KHÔNG dùng Web Worker: structured-clone toàn bộ rows (30k × 174
// trường, kèm `raw`) sang worker đã ngốn vài trăm MB và làm Chrome kill tab
// vì OOM TRƯỚC khi worker kịp stringify. Gửi theo từng "chunk" trên luồng
// chính + yield giữa các chunk giữ UI luôn phản hồi và không nhân bản dữ
// liệu — chỉ tạo các đoạn JSON nhỏ rồi gom thành Blob (Blob lưu nội dung
// dưới dạng nhị phân, ngay khi dồn xong các string chunks có thể được GC).
// ---------------------------------------------------------------------------

export interface PublishOptions {
  /** Báo tiến trình hiện tại (đang stringify hay đang upload). */
  onProgress?: (phase: 'serializing' | 'uploading') => void;
}

/** Số dòng mỗi chunk khi stringify — chọn đủ lớn để overhead nhỏ, đủ nhỏ
 *  để mỗi vòng yield giữ UI mượt (~50 ms/chunk trên dữ liệu thực). */
const ROWS_PER_CHUNK = 500;

/** Chờ tick kế tiếp để main thread xử lý input/UI. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/**
 * Stringify từng phần `rows` rồi đẩy vào danh sách Blob. KHÔNG dồn về một
 * chuỗi khổng lồ — Blob giữ nội dung dưới dạng nhị phân, mỗi chunk string
 * có thể được GC sau khi nuốt vào Blob.
 */
async function pushRowsAsJson(
  rows: LoanRecord[],
  parts: BlobPart[]
): Promise<void> {
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) parts.push(',');
    parts.push(JSON.stringify(rowToJson(rows[i])));
    if ((i + 1) % ROWS_PER_CHUNK === 0) {
      await yieldToEventLoop();
    }
  }
}

async function buildSnapshotBlob(
  rows: LoanRecord[],
  ngaySoLieu: Date | null
): Promise<Blob> {
  const parts: BlobPart[] = [];
  parts.push('{"v":1,"ngaySoLieu":');
  parts.push(JSON.stringify(ngaySoLieu ? ngaySoLieu.toISOString() : null));
  parts.push(',"rows":[');
  await pushRowsAsJson(rows, parts);
  parts.push(']}');
  return new Blob(parts, { type: 'application/json' });
}

/** Đẩy một slot (có thể null) thành đoạn JSON `"<key>":<obj|null>`. */
async function pushSlotAsJson(
  key: PeriodSlotKey,
  snap: PeriodSnapshot | null,
  parts: BlobPart[],
  isFirst: boolean
): Promise<void> {
  if (!isFirst) parts.push(',');
  parts.push(`"${key}":`);
  if (!snap) {
    parts.push('null');
    return;
  }
  parts.push('{"ngaySoLieu":');
  parts.push(JSON.stringify(snap.ngaySoLieu ? snap.ngaySoLieu.toISOString() : null));
  parts.push(',"rows":[');
  await pushRowsAsJson(snap.rows, parts);
  parts.push(']}');
}

async function buildPeriodBlob(
  slots: PeriodPublishSlots,
  comparePair: ComparePair
): Promise<Blob> {
  const parts: BlobPart[] = [];
  parts.push('{"v":2,"comparePair":');
  parts.push(JSON.stringify(comparePair));
  parts.push(',"slots":{');
  await pushSlotAsJson('lastYear', slots.lastYear, parts, true);
  await pushSlotAsJson('lastMonth', slots.lastMonth, parts, false);
  await pushSlotAsJson('now', slots.now, parts, false);
  parts.push('}}');
  return new Blob(parts, { type: 'application/json' });
}

/**
 * Nén blob bằng CompressionStream('gzip') của trình duyệt — lossless, native,
 * không phụ thuộc thư viện. Tỉ lệ nén thực tế trên payload Báo cáo 31: ~10×
 * (49 MB → ~5 MB), giảm tải mạng và bộ nhớ Node khi server.writeFileSync.
 */
async function gzipBlob(blob: Blob): Promise<Blob> {
  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
  return await new Response(stream).blob();
}

async function uploadBlob(url: string, blob: Blob): Promise<void> {
  const gz = await gzipBlob(blob);
  const res = await fetch(url, {
    method: 'POST',
    // Báo server biết body đã gzip → ghi nguyên bytes vào file `.json.gz`,
    // không bị nhầm là JSON cần parse.
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'gzip',
    },
    body: gz,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* bỏ qua */
    }
    throw new Error(`HTTP ${res.status} ${detail || res.statusText}`);
  }
}

export async function publishSnapshot(
  rows: LoanRecord[],
  ngaySoLieu: Date | null,
  opts?: PublishOptions
): Promise<void> {
  try {
    opts?.onProgress?.('serializing');
    const blob = await buildSnapshotBlob(rows, ngaySoLieu);
    opts?.onProgress?.('uploading');
    await uploadBlob(PUBLISH_API_SNAPSHOT, blob);
  } catch (err) {
    throw new Error(
      `Xuất bản thất bại: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function publishPeriod(
  slots: PeriodPublishSlots,
  comparePair: ComparePair,
  opts?: PublishOptions
): Promise<void> {
  try {
    opts?.onProgress?.('serializing');
    const blob = await buildPeriodBlob(slots, comparePair);
    opts?.onProgress?.('uploading');
    await uploadBlob(PUBLISH_API_PERIOD, blob);
  } catch (err) {
    throw new Error(
      `Xuất bản thất bại: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Xóa tệp xuất bản (gửi DELETE — trình cắm xóa cả `.json` lẫn `.json.gz`). */
export async function unpublishSnapshot(): Promise<void> {
  await fetch(PUBLISH_API_SNAPSHOT, { method: 'DELETE' });
}
export async function unpublishPeriod(): Promise<void> {
  await fetch(PUBLISH_API_PERIOD, { method: 'DELETE' });
}
