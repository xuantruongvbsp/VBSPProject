// Tiện ích "xuất bản dữ liệu" — chuyển bộ dữ liệu hiện tại trên trình
// duyệt của chủ sở hữu thành một tệp JSON tĩnh, rồi đưa qua trình cắm
// vite-plugin-publish để ghi vào thư mục `public/` (hoặc `dist/` khi
// chạy `vite preview`). Người xem sẽ tải lại tệp tĩnh đó khi mở trang.
//
// Nguyên tắc: KHÔNG bao giờ ghi tên tệp gốc, đường dẫn, hay bất kỳ
// trường nào nhận diện nguồn Excel vào dữ liệu đã xuất bản.

import type { LoanRecord, StaffRecord, TxnPointRecord } from './types';
import type {
  ComparePair,
  PeriodSlotKey,
  PeriodSnapshot,
} from '@/store/usePeriodStore';
import type {
  Decision,
  PlanEntry,
  ActualSummary,
  Nq11XaSummary,
  Nq11MatchXa,
  Nq11NoxhXaSummary,
  XaCatalogEntry,
} from './credit-plan-types';
import { DEFAULT_XA_LIST } from './credit-plan-types';
import { upgradeLegacyRows } from './loan-record-compat';

// File xuất bản được nén gzip để giảm kích thước on-wire ~10× (49 MB → ~5 MB).
// Tệp `.json` cũ vẫn được fetch fallback để tương thích ngược trong giai đoạn
// chuyển tiếp — sẽ bỏ sau khi mọi triển khai đã re-publish.
const SNAPSHOT_URL_GZ = '/published.json.gz';
const SNAPSHOT_URL_PLAIN = '/published.json';
const PERIOD_URL_GZ = '/published-period.json.gz';
const PERIOD_URL_PLAIN = '/published-period.json';
const CATALOG_URL_GZ = '/published-catalog.json.gz';
const CATALOG_URL_PLAIN = '/published-catalog.json';
const CREDIT_PLAN_URL_GZ = '/published-credit-plan.json.gz';
const CREDIT_PLAN_URL_PLAIN = '/published-credit-plan.json';
const PUBLISH_API_SNAPSHOT = '/__publish/snapshot';
const PUBLISH_API_PERIOD = '/__publish/period';
const PUBLISH_API_CATALOG = '/__publish/catalog';
const PUBLISH_API_CREDIT_PLAN = '/__publish/credit-plan';

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
  'ngayHetHanKhoanh',
];

// Tệp xuất bản KHÔNG mang `raw` (bản sao 174 cột) — parser đã bỏ trường này.
// Tệp xuất bản cũ còn `raw` được `upgradeLegacyRows` dọn khi viewer nạp.
function rowToJson(row: LoanRecord): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
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

function jsonToRows(rows: Record<string, unknown>[]): LoanRecord[] {
  return upgradeLegacyRows(rows.map(jsonToRow));
}

// ---------------------------------------------------------------------------
// Snapshot ("Phân tích một kỳ")
// ---------------------------------------------------------------------------

export interface SnapshotPublishPayload {
  v: 1;
  ngaySoLieu: string | null;
  /** Thời điểm chủ sở hữu xuất bản (ISO). Dùng để hiển thị cho người xem. */
  publishedAt?: string;
  rows: Record<string, unknown>[];
}

export function serializeSnapshot(
  rows: LoanRecord[],
  ngaySoLieu: Date | null
): string {
  const payload: SnapshotPublishPayload = {
    v: 1,
    ngaySoLieu: ngaySoLieu ? ngaySoLieu.toISOString() : null,
    publishedAt: new Date().toISOString(),
    rows: rows.map(rowToJson),
  };
  return JSON.stringify(payload);
}

export interface DeserializedSnapshot {
  rows: LoanRecord[];
  ngaySoLieu: Date | null;
  publishedAt: string | null;
}

export function deserializeSnapshot(text: string): DeserializedSnapshot {
  const obj = JSON.parse(text) as SnapshotPublishPayload;
  return {
    rows: jsonToRows(obj.rows),
    ngaySoLieu: obj.ngaySoLieu ? new Date(obj.ngaySoLieu) : null,
    publishedAt: typeof obj.publishedAt === 'string' ? obj.publishedAt : null,
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
  /** Thời điểm chủ sở hữu xuất bản (ISO). */
  publishedAt?: string;
}

export type PeriodPublishPayload =
  | PeriodPublishPayloadV1
  | PeriodPublishPayloadV2;

function jsonToSnapshot(j: PeriodSnapshotJson): PeriodSnapshot {
  return {
    rows: jsonToRows(j.rows),
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
    publishedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload);
}

export interface DeserializedPeriod {
  slots: PeriodPublishSlots;
  comparePair: ComparePair;
  publishedAt: string | null;
}

export function deserializePeriod(text: string): DeserializedPeriod {
  const obj = JSON.parse(text) as PeriodPublishPayload;
  const publishedAt =
    typeof obj.publishedAt === 'string' ? obj.publishedAt : null;
  if (obj.v === 2) {
    const slots: PeriodPublishSlots = {
      lastYear: obj.slots.lastYear ? jsonToSnapshot(obj.slots.lastYear) : null,
      lastMonth: obj.slots.lastMonth
        ? jsonToSnapshot(obj.slots.lastMonth)
        : null,
      now: obj.slots.now ? jsonToSnapshot(obj.slots.now) : null,
    };
    return { slots, comparePair: obj.comparePair, publishedAt };
  }
  // v1 legacy: chỉ có prev/curr → đổ vào lastMonth/now (giữ nguyên hành vi cũ).
  const slots: PeriodPublishSlots = {
    lastYear: null,
    lastMonth: jsonToSnapshot(obj.prev),
    now: jsonToSnapshot(obj.curr),
  };
  return { slots, comparePair: { a: 'lastMonth', b: 'now' }, publishedAt };
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
// Lý do KHÔNG dùng Web Worker: structured-clone toàn bộ rows sang worker
// nhân đôi bộ nhớ (thời còn `raw` 174 cột từng làm Chrome OOM kill tab).
// Stringify theo từng "chunk" trên luồng chính + yield giữa các chunk giữ
// UI luôn phản hồi và không nhân bản dữ liệu — chỉ tạo các đoạn JSON nhỏ
// rồi gom thành Blob (Blob lưu nội dung dưới dạng nhị phân, các string
// chunk có thể được GC ngay sau khi dồn vào).
// ---------------------------------------------------------------------------

export interface PublishOptions {
  /** Báo tiến trình hiện tại (đang stringify hay đang upload). */
  onProgress?: (phase: 'serializing' | 'uploading') => void;
}

/** Số dòng mỗi chunk khi stringify — đo trên Báo cáo 31 thực (15k dòng):
 *  500 dòng ≈ 200 ms/chunk (vẫn thấy khựng khi cuộn); 200 dòng ≈ 80 ms. */
const ROWS_PER_CHUNK = 200;

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
  parts.push(',"publishedAt":');
  parts.push(JSON.stringify(new Date().toISOString()));
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
  parts.push(',"publishedAt":');
  parts.push(JSON.stringify(new Date().toISOString()));
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

// ---------------------------------------------------------------------------
// Danh mục Cán bộ + Điểm giao dịch (catalog)
//
// Hai catalog này lưu cục bộ trong localStorage của chủ sở hữu (Zustand
// `persist`). Trước đây không nằm trong payload xuất bản → người xem trên
// laptop khác không thấy bộ chọn "Cán bộ" / "Điểm giao dịch". Nay xuất bản
// cùng dữ liệu chính, người xem hydrate vào store ở chế độ chỉ đọc.
//
// Payload nhỏ (vài KB) — vẫn dùng gzip để đồng nhất với hai endpoint kia
// (server kiểm tra magic bytes 1f 8b).
// ---------------------------------------------------------------------------

export interface CatalogPublishPayload {
  v: 1;
  staff: StaffRecord[];
  txnPoints: TxnPointRecord[];
  /** Thời điểm chủ sở hữu xuất bản (ISO). */
  publishedAt?: string;
}

export interface DeserializedCatalog {
  staff: StaffRecord[];
  txnPoints: TxnPointRecord[];
  publishedAt: string | null;
}

export function serializeCatalog(
  staff: StaffRecord[],
  txnPoints: TxnPointRecord[]
): string {
  const payload: CatalogPublishPayload = {
    v: 1,
    staff,
    txnPoints,
    publishedAt: new Date().toISOString(),
  };
  return JSON.stringify(payload);
}

export function deserializeCatalog(text: string): DeserializedCatalog {
  const obj = JSON.parse(text) as Partial<CatalogPublishPayload>;
  return {
    staff: Array.isArray(obj.staff) ? (obj.staff as StaffRecord[]) : [],
    txnPoints: Array.isArray(obj.txnPoints)
      ? (obj.txnPoints as TxnPointRecord[])
      : [],
    publishedAt: typeof obj.publishedAt === 'string' ? obj.publishedAt : null,
  };
}

export async function publishCatalog(
  staff: StaffRecord[],
  txnPoints: TxnPointRecord[]
): Promise<void> {
  try {
    const blob = new Blob([serializeCatalog(staff, txnPoints)], {
      type: 'application/json',
    });
    await uploadBlob(PUBLISH_API_CATALOG, blob);
  } catch (err) {
    throw new Error(
      `Xuất bản danh mục thất bại: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function fetchPublishedCatalog(): Promise<DeserializedCatalog | null> {
  try {
    const text =
      (await fetchAndMaybeUngzip(CATALOG_URL_GZ)) ??
      (await fetchAndMaybeUngzip(CATALOG_URL_PLAIN));
    if (text === null) return null;
    return deserializeCatalog(text);
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

export async function unpublishCatalog(): Promise<void> {
  await fetch(PUBLISH_API_CATALOG, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Kế hoạch tín dụng (decisions, plans, actuals, NQ11)
//
// Khác hai endpoint trên — dữ liệu Kế hoạch tín dụng KHÔNG đến từ Excel mỗi
// lần. Chủ sở hữu chỉnh sửa decisions/plans qua UI và mỗi lần thay đổi sẽ
// được auto-sync (debounce) lên endpoint này. Người xem fetch một lần lúc
// vào trang; refresh để lấy bản mới.
//
// PDF đính kèm vào quyết định lưu trong IndexedDB của owner — KHÔNG đi kèm
// payload publish (sẽ vượt quota nhanh và mỗi viewer phải có quyền IDB).
// Viewer chỉ thấy metadata `attachment` (fileName/size); UI ẩn nút mở/tải.
// ---------------------------------------------------------------------------

export interface CreditPlanPublishPayload {
  v: 1;
  /** Thời điểm chủ sở hữu xuất bản (ISO). */
  publishedAt?: string;
  /** Danh mục xã. Tùy chọn để tương thích ngược với bản publish cũ (v1 không
   *  có trường này) — khi thiếu, viewer rơi về danh mục mặc định. */
  xaCatalog?: XaCatalogEntry[];
  decisions: Decision[];
  plans: PlanEntry[];
  actuals: ActualSummary[];
  actualDate: string | null;
  actualTotalRows: number;
  actualDiag: {
    scannedRows?: number;
    skippedRows?: number;
    detectedIdCols?: string[];
    duplicateLoanIds?: number;
    hasInvestorCol?: boolean;
    gqvlXaReclassified?: number;
  } | null;
  nq11Summaries: Nq11XaSummary[];
  nq11MonVayIds: string[];
  nq11Date: string | null;
  nq11TotalRows: number;
  nq11MatchByXa: Nq11MatchXa[];
  nq11NoxhSummaries: Nq11NoxhXaSummary[];
  nq11NoxhMonVayIds: string[];
  nq11NoxhDate: string | null;
  nq11NoxhTotalRows: number;
}

export type DeserializedCreditPlan = Omit<
  CreditPlanPublishPayload,
  'publishedAt'
> & { publishedAt: string | null };

export function serializeCreditPlan(
  p: Omit<CreditPlanPublishPayload, 'v' | 'publishedAt'>
): string {
  return JSON.stringify({
    v: 1,
    publishedAt: new Date().toISOString(),
    ...p,
  } satisfies CreditPlanPublishPayload);
}

export function deserializeCreditPlan(text: string): DeserializedCreditPlan | null {
  const obj = JSON.parse(text) as Partial<CreditPlanPublishPayload>;
  if (!obj || obj.v !== 1) return null;
  return {
    v: 1,
    publishedAt: typeof obj.publishedAt === 'string' ? obj.publishedAt : null,
    xaCatalog:
      Array.isArray(obj.xaCatalog) && obj.xaCatalog.length > 0
        ? obj.xaCatalog
        : DEFAULT_XA_LIST,
    decisions: Array.isArray(obj.decisions) ? obj.decisions : [],
    plans: Array.isArray(obj.plans) ? obj.plans : [],
    actuals: Array.isArray(obj.actuals) ? obj.actuals : [],
    actualDate: obj.actualDate ?? null,
    actualTotalRows: typeof obj.actualTotalRows === 'number' ? obj.actualTotalRows : 0,
    actualDiag: obj.actualDiag ?? null,
    nq11Summaries: Array.isArray(obj.nq11Summaries) ? obj.nq11Summaries : [],
    nq11MonVayIds: Array.isArray(obj.nq11MonVayIds) ? obj.nq11MonVayIds : [],
    nq11Date: obj.nq11Date ?? null,
    nq11TotalRows: typeof obj.nq11TotalRows === 'number' ? obj.nq11TotalRows : 0,
    nq11MatchByXa: Array.isArray(obj.nq11MatchByXa) ? obj.nq11MatchByXa : [],
    nq11NoxhSummaries: Array.isArray(obj.nq11NoxhSummaries) ? obj.nq11NoxhSummaries : [],
    nq11NoxhMonVayIds: Array.isArray(obj.nq11NoxhMonVayIds) ? obj.nq11NoxhMonVayIds : [],
    nq11NoxhDate: obj.nq11NoxhDate ?? null,
    nq11NoxhTotalRows: typeof obj.nq11NoxhTotalRows === 'number' ? obj.nq11NoxhTotalRows : 0,
  };
}

export async function publishCreditPlan(
  payload: Omit<CreditPlanPublishPayload, 'v'>
): Promise<void> {
  try {
    const blob = new Blob([serializeCreditPlan(payload)], {
      type: 'application/json',
    });
    await uploadBlob(PUBLISH_API_CREDIT_PLAN, blob);
  } catch (err) {
    throw new Error(
      `Xuất bản Kế hoạch tín dụng thất bại: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

export async function fetchPublishedCreditPlan(): Promise<DeserializedCreditPlan | null> {
  try {
    const text =
      (await fetchAndMaybeUngzip(CREDIT_PLAN_URL_GZ)) ??
      (await fetchAndMaybeUngzip(CREDIT_PLAN_URL_PLAIN));
    if (text === null) return null;
    return deserializeCreditPlan(text);
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}

export async function unpublishCreditPlan(): Promise<void> {
  await fetch(PUBLISH_API_CREDIT_PLAN, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// PDF đính kèm Quyết định — mỗi file lưu tại
// `/decision-attachments/<id>.pdf`. Owner upload nguyên blob (không gzip để
// tránh nén lại file đã nén). Viewer mở/tải bằng URL trực tiếp.
// ---------------------------------------------------------------------------

const PUBLISH_API_ATTACHMENT_PREFIX = '/__publish/decision-attachment/';
const VIEWER_ATTACHMENT_PREFIX = '/decision-attachments/';

/** URL công khai để viewer mở/tải file PDF đã xuất bản. */
export function publicAttachmentUrl(decisionId: string): string {
  return `${VIEWER_ATTACHMENT_PREFIX}${encodeURIComponent(decisionId)}.pdf`;
}

/** Owner gọi sau khi lưu blob vào IndexedDB — đẩy bản sao lên server tĩnh. */
export async function publishAttachment(decisionId: string, blob: Blob): Promise<void> {
  const res = await fetch(`${PUBLISH_API_ATTACHMENT_PREFIX}${encodeURIComponent(decisionId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: blob,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* bỏ qua */
    }
    throw new Error(`Đẩy PDF lên thất bại: ${res.status} ${detail || res.statusText}`);
  }
}

export async function unpublishAttachment(decisionId: string): Promise<void> {
  await fetch(`${PUBLISH_API_ATTACHMENT_PREFIX}${encodeURIComponent(decisionId)}`, {
    method: 'DELETE',
  });
}
