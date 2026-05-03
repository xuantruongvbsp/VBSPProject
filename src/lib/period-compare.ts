// ─────────────────────────────────────────────────────────────────────────────
//  Logic so sánh hai kỳ — toàn bộ thuần (pure), không phụ thuộc React.
//  Mọi chỉ tiêu trong ứng dụng "So sánh giữa hai kỳ" được dẫn xuất từ các
//  hàm trong tệp này. Nhờ đó có thể chạy unit-test ngoài trình duyệt
//  (xem `_inspect/test-period-compare.mjs`).
// ─────────────────────────────────────────────────────────────────────────────

import type { LoanRecord } from './types';
import { computeKpi, isOpenLoan, type PortfolioKpi } from './metrics';

// ─── Khóa nối ────────────────────────────────────────────────────────────────

/**
 * Khóa nối khế ước = `${soKheUoc}\u0000${maKH}`. Sử dụng null-byte làm ký
 * tự ngăn cách vì không khế ước hay mã KH thực nào chứa ký tự này, tránh
 * va chạm với chuỗi tự nhiên ("0001-2024" + "VBSP" vs "0001" + "-2024VBSP").
 *
 * Lý do chọn cặp khóa: ở VBSP, số khế ước được tái sử dụng sau khi tài
 * khoản tất toán; ghép thêm `maKH` đảm bảo không nhầm hai khoản vay khác
 * nhau ở hai kỳ.
 */
export function loanKey(r: { soKheUoc: string; maKH: string }): string {
  return `${r.soKheUoc}\u0000${r.maKH}`;
}

// ─── Phân loại tình trạng món vay ────────────────────────────────────────────

export type LoanStatus = 'th' | 'qh' | 'kh' | 'none';

const STATUS_LABEL: Record<LoanStatus, string> = {
  th: 'Trong hạn',
  qh: 'Quá hạn',
  kh: 'Khoanh',
  none: 'Không dư nợ',
};

export function statusLabel(s: LoanStatus): string {
  return STATUS_LABEL[s];
}

/**
 * Suy ra tình trạng của một khế ước theo các trường dư nợ — không dựa vào
 * `tinhTrangMonVay` text vì nó có thể không nhất quán giữa các kỳ.
 *
 * Ưu tiên: khoanh > quá hạn > trong hạn > không dư nợ.
 */
export function deriveStatus(r: LoanRecord): LoanStatus {
  if (r.duNoKhoanh > 0) return 'kh';
  if (r.duNoQuaHan > 0) return 'qh';
  if (r.duNoTrongHan > 0) return 'th';
  return 'none';
}

// ─── Khớp khế ước giữa hai kỳ ────────────────────────────────────────────────

export interface JoinedLoan {
  key: string;
  prev: LoanRecord | null;
  curr: LoanRecord | null;
  /** 'both' = tồn tại ở cả hai kỳ; 'closed' = chỉ ở prev; 'new' = chỉ ở curr */
  bucket: 'both' | 'closed' | 'new';
}

export interface LoanJoinResult {
  joined: JoinedLoan[];
  /** Số khế ước tồn tại ở cả hai kỳ */
  bothCount: number;
  /** Số khế ước chỉ có ở kỳ trước (đã tất toán hoặc tất nợ) */
  closedCount: number;
  /** Số khế ước chỉ có ở kỳ sau (mới phát sinh) */
  newCount: number;
  /** Số khóa trùng phát hiện được (sau khi đã ghép soKheUoc + maKH) — bằng 0 nghĩa lành mạnh */
  collisions: number;
}

/**
 * Ghép cặp khế ước theo `loanKey`. Trả về danh sách các bản ghi đã ghép
 * cùng số đếm theo nhóm và số trùng khóa.
 *
 * Cảnh báo: nếu dữ liệu nguồn có hai dòng cùng khóa trong CÙNG một kỳ
 * (lẽ ra không có), hàm này gộp chúng vào một bản đại diện cuối cùng và
 * tăng `collisions`. Nên báo lên UI để người dùng chú ý.
 */
export function joinByLoan(
  prevRows: LoanRecord[],
  currRows: LoanRecord[]
): LoanJoinResult {
  const prevMap = new Map<string, LoanRecord>();
  let collisions = 0;
  for (const r of prevRows) {
    const k = loanKey(r);
    if (prevMap.has(k)) collisions++;
    prevMap.set(k, r);
  }
  const currMap = new Map<string, LoanRecord>();
  for (const r of currRows) {
    const k = loanKey(r);
    if (currMap.has(k)) collisions++;
    currMap.set(k, r);
  }

  const joined: JoinedLoan[] = [];
  const seen = new Set<string>();

  for (const [k, p] of prevMap) {
    const c = currMap.get(k) ?? null;
    seen.add(k);
    joined.push({
      key: k,
      prev: p,
      curr: c,
      bucket: c ? 'both' : 'closed',
    });
  }
  for (const [k, c] of currMap) {
    if (seen.has(k)) continue;
    joined.push({ key: k, prev: null, curr: c, bucket: 'new' });
  }

  let bothCount = 0,
    closedCount = 0,
    newCount = 0;
  for (const j of joined) {
    if (j.bucket === 'both') bothCount++;
    else if (j.bucket === 'closed') closedCount++;
    else newCount++;
  }

  return { joined, bothCount, closedCount, newCount, collisions };
}

// ─── Khớp khách hàng giữa hai kỳ ─────────────────────────────────────────────

export interface CustomerSlice {
  maKH: string;
  tenKH: string;
  tenPGD: string;
  tenDVUT: string;
  /** Tên Tổ TK&VV — lấy từ khế ước đầu tiên gặp của khách hàng */
  tenTo: string;
  soKheUoc: number;
  tongDuNo: number;
  /** ngày giao dịch gần nhất tổng hợp từ tất cả khế ước */
  ngayHoatDongCuoi: Date | null;
}

export interface JoinedCustomer {
  maKH: string;
  prev: CustomerSlice | null;
  curr: CustomerSlice | null;
  bucket: 'retained' | 'churned' | 'new';
  /**
   * `reactivated` = true nếu khách hàng có ở kỳ trước nhưng đã ngừng giao
   * dịch ≥ 6 tháng tính tới ngày số liệu kỳ trước, và xuất hiện trở lại
   * ở kỳ sau (bucket = 'retained').
   */
  reactivated?: boolean;
}

function aggregateCustomers(rows: LoanRecord[]): Map<string, CustomerSlice> {
  const map = new Map<string, CustomerSlice>();
  for (const r of rows) {
    if (!r.maKH) continue;
    let s = map.get(r.maKH);
    if (!s) {
      s = {
        maKH: r.maKH,
        tenKH: r.tenKH,
        tenPGD: r.tenPGD,
        tenDVUT: r.tenDVUT,
        tenTo: r.tenTo ?? '',
        soKheUoc: 0,
        tongDuNo: 0,
        ngayHoatDongCuoi: null,
      };
      map.set(r.maKH, s);
    }
    // Nếu slice đã tồn tại nhưng chưa có tenTo (KƯ đầu thiếu), lấy từ KƯ sau
    if (!s.tenTo && r.tenTo) s.tenTo = r.tenTo;
    s.soKheUoc += 1;
    s.tongDuNo += r.tongDuNo;
    if (r.ngayGiaoDichGanNhat) {
      if (!s.ngayHoatDongCuoi || r.ngayGiaoDichGanNhat > s.ngayHoatDongCuoi) {
        s.ngayHoatDongCuoi = r.ngayGiaoDichGanNhat;
      }
    }
  }
  return map;
}

export interface CustomerJoinResult {
  joined: JoinedCustomer[];
  retainedCount: number;
  churnedCount: number;
  newCount: number;
  reactivatedCount: number;
}

export function joinByCustomer(
  prevRows: LoanRecord[],
  currRows: LoanRecord[],
  prevDate: Date | null
): CustomerJoinResult {
  const prevMap = aggregateCustomers(prevRows);
  const currMap = aggregateCustomers(currRows);
  const joined: JoinedCustomer[] = [];
  const seen = new Set<string>();
  const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6;

  for (const [k, p] of prevMap) {
    seen.add(k);
    const c = currMap.get(k) ?? null;
    if (c) {
      // Xét reactivation: ở kỳ trước khách đã im lặng ≥ 6 tháng?
      let reactivated = false;
      if (prevDate && p.ngayHoatDongCuoi) {
        const diff = prevDate.getTime() - p.ngayHoatDongCuoi.getTime();
        if (diff >= sixMonthsMs) reactivated = true;
      }
      joined.push({ maKH: k, prev: p, curr: c, bucket: 'retained', reactivated });
    } else {
      joined.push({ maKH: k, prev: p, curr: null, bucket: 'churned' });
    }
  }
  for (const [k, c] of currMap) {
    if (seen.has(k)) continue;
    joined.push({ maKH: k, prev: null, curr: c, bucket: 'new' });
  }

  let retainedCount = 0,
    churnedCount = 0,
    newCount = 0,
    reactivatedCount = 0;
  for (const j of joined) {
    if (j.bucket === 'retained') {
      retainedCount++;
      if (j.reactivated) reactivatedCount++;
    } else if (j.bucket === 'churned') churnedCount++;
    else newCount++;
  }

  return { joined, retainedCount, churnedCount, newCount, reactivatedCount };
}

// ─── So sánh KPI ─────────────────────────────────────────────────────────────

export interface KpiDelta {
  prev: PortfolioKpi;
  curr: PortfolioKpi;
  delta: PortfolioKpi;
  /** Phần trăm thay đổi tương đối trên 0–1 (0.05 = +5%). null nếu prev=0. */
  pct: Record<keyof PortfolioKpi, number | null>;
}

function countOpen(rows: LoanRecord[]): { soKheUoc: number; soKhachHang: number } {
  const kh = new Set<string>();
  let soKheUoc = 0;
  for (const r of rows) {
    if (!isOpenLoan(r)) continue;
    soKheUoc++;
    if (r.maKH) kh.add(r.maKH);
  }
  return { soKheUoc, soKhachHang: kh.size };
}

export function compareKpi(
  prevRows: LoanRecord[],
  currRows: LoanRecord[]
): KpiDelta {
  const prev = computeKpi(prevRows);
  const curr = computeKpi(currRows);
  const prevOpen = countOpen(prevRows);
  const currOpen = countOpen(currRows);
  prev.soKheUoc = prevOpen.soKheUoc;
  prev.soKhachHang = prevOpen.soKhachHang;
  curr.soKheUoc = currOpen.soKheUoc;
  curr.soKhachHang = currOpen.soKhachHang;
  // Mức vay BQ (So sánh hai kỳ) = Tổng dư nợ / Số khách hàng đang hoạt động.
  prev.mucVayBQ = prev.soKhachHang > 0 ? prev.tongDuNo / prev.soKhachHang : 0;
  curr.mucVayBQ = curr.soKhachHang > 0 ? curr.tongDuNo / curr.soKhachHang : 0;
  const delta = {} as PortfolioKpi;
  const pct = {} as Record<keyof PortfolioKpi, number | null>;
  for (const k of Object.keys(prev) as Array<keyof PortfolioKpi>) {
    delta[k] = curr[k] - prev[k];
    pct[k] = prev[k] === 0 ? null : (curr[k] - prev[k]) / prev[k];
  }
  return { prev, curr, delta, pct };
}

// ─── Ma trận chuyển nhóm ─────────────────────────────────────────────────────

export const STATUS_ORDER: LoanStatus[] = ['th', 'qh', 'kh', 'none'];

export interface MigrationCell {
  fromStatus: LoanStatus;
  toStatus: LoanStatus;
  count: number;
  duNoPrev: number;
  duNoCurr: number;
  /** Khóa của các khế ước thuộc ô — dùng cho drill-down panel */
  loanKeys: string[];
}

export interface MigrationMatrix {
  cells: MigrationCell[];
  totalImproved: number;
  totalWorsened: number;
  totalDuNoImproved: number;
  totalDuNoWorsened: number;
}

/**
 * Tính ma trận chuyển nhóm 4×4. "Improved" = chuyển từ nhóm xấu hơn về
 * nhóm tốt hơn (qh→th, kh→qh, kh→th). "Worsened" = chuyển ngược lại.
 * Khế ước mới (none→x) và đã tất toán (x→none) cũng được tính nhưng
 * không tính vào improved/worsened.
 */
export function migrationMatrix(
  joined: JoinedLoan[]
): MigrationMatrix {
  // Khởi tạo các ô rỗng cho mọi cặp from→to.
  const cells = new Map<string, MigrationCell>();
  const cellKey = (a: LoanStatus, b: LoanStatus) => `${a}|${b}`;
  for (const a of STATUS_ORDER) {
    for (const b of STATUS_ORDER) {
      cells.set(cellKey(a, b), {
        fromStatus: a,
        toStatus: b,
        count: 0,
        duNoPrev: 0,
        duNoCurr: 0,
        loanKeys: [],
      });
    }
  }

  for (const j of joined) {
    const fromStatus: LoanStatus = j.prev ? deriveStatus(j.prev) : 'none';
    const toStatus: LoanStatus = j.curr ? deriveStatus(j.curr) : 'none';
    const cell = cells.get(cellKey(fromStatus, toStatus))!;
    cell.count += 1;
    cell.duNoPrev += j.prev?.tongDuNo ?? 0;
    cell.duNoCurr += j.curr?.tongDuNo ?? 0;
    cell.loanKeys.push(j.key);
  }

  // Xếp hạng theo mức độ "tốt" — chỉ số càng nhỏ càng tốt
  const rank: Record<LoanStatus, number> = { th: 0, qh: 1, kh: 2, none: 3 };
  let totalImproved = 0;
  let totalWorsened = 0;
  let totalDuNoImproved = 0;
  let totalDuNoWorsened = 0;
  for (const cell of cells.values()) {
    if (cell.count === 0) continue;
    if (cell.fromStatus === 'none' || cell.toStatus === 'none') continue;
    if (cell.fromStatus === cell.toStatus) continue;
    if (rank[cell.toStatus] < rank[cell.fromStatus]) {
      totalImproved += cell.count;
      totalDuNoImproved += cell.duNoCurr;
    } else if (rank[cell.toStatus] > rank[cell.fromStatus]) {
      totalWorsened += cell.count;
      totalDuNoWorsened += cell.duNoCurr;
    }
  }

  return {
    cells: Array.from(cells.values()),
    totalImproved,
    totalWorsened,
    totalDuNoImproved,
    totalDuNoWorsened,
  };
}

// ─── Roll rate / Cure rate ───────────────────────────────────────────────────

export interface RollCureRates {
  /** `Σ duNoQuaHan_T (loans Trong hạn ở T-1) / Σ duNoTrongHan_T1` */
  rollRate: number;
  /** `Σ duNoTrongHan_T (loans Quá hạn ở T-1) / Σ duNoQuaHan_T1` */
  cureRate: number;
  /** Số khế ước được tính trong tử số rollRate */
  rollCount: number;
  /** Số khế ước được tính trong tử số cureRate */
  cureCount: number;
  baseTrongHanT1: number;
  baseQuaHanT1: number;
}

export function rollCureRate(joined: JoinedLoan[]): RollCureRates {
  let rollNumerator = 0;
  let cureNumerator = 0;
  let baseTrongHanT1 = 0;
  let baseQuaHanT1 = 0;
  let rollCount = 0;
  let cureCount = 0;

  for (const j of joined) {
    if (!j.prev) continue;
    const fromStatus = deriveStatus(j.prev);
    if (fromStatus === 'th') {
      baseTrongHanT1 += j.prev.duNoTrongHan;
      if (j.curr) {
        rollNumerator += j.curr.duNoQuaHan;
        if (j.curr.duNoQuaHan > 0) rollCount++;
      }
    } else if (fromStatus === 'qh') {
      baseQuaHanT1 += j.prev.duNoQuaHan;
      if (j.curr) {
        cureNumerator += j.curr.duNoTrongHan;
        if (j.curr.duNoTrongHan > 0) cureCount++;
      }
    }
  }

  return {
    rollRate: baseTrongHanT1 > 0 ? rollNumerator / baseTrongHanT1 : 0,
    cureRate: baseQuaHanT1 > 0 ? cureNumerator / baseQuaHanT1 : 0,
    rollCount,
    cureCount,
    baseTrongHanT1,
    baseQuaHanT1,
  };
}

// ─── PAR (Portfolio at Risk) ─────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/**
 * Tính số ngày quá hạn của một khế ước tại ngày chốt số liệu. Dùng ngày
 * đáo hạn theo gia hạn nếu có, ngược lại dùng ngày đáo hạn hợp đồng.
 * Ngày chốt số liệu lấy từ chính bản ghi (`ngaySoLieu`).
 */
export function daysOverdue(r: LoanRecord): number {
  const ref = r.ngaySoLieu;
  const due = r.ngayDHGiaHan ?? r.ngayDHHopDong;
  if (!ref || !due) return 0;
  const diff = (ref.getTime() - due.getTime()) / DAY_MS;
  return diff > 0 ? Math.floor(diff) : 0;
}

export interface ParBreakdown {
  par30: number;
  par90: number;
  par180: number;
  par30Pct: number;
  par90Pct: number;
  par180Pct: number;
  tongDuNo: number;
}

export function par(rows: LoanRecord[]): ParBreakdown {
  let par30 = 0,
    par90 = 0,
    par180 = 0,
    tongDuNo = 0;
  for (const r of rows) {
    tongDuNo += r.tongDuNo;
    const d = daysOverdue(r);
    if (d > 30) par30 += r.tongDuNo;
    if (d > 90) par90 += r.tongDuNo;
    if (d > 180) par180 += r.tongDuNo;
  }
  return {
    par30,
    par90,
    par180,
    par30Pct: tongDuNo > 0 ? par30 / tongDuNo : 0,
    par90Pct: tongDuNo > 0 ? par90 / tongDuNo : 0,
    par180Pct: tongDuNo > 0 ? par180 / tongDuNo : 0,
    tongDuNo,
  };
}

// ─── Vintage NQH theo năm ngày vay ───────────────────────────────────────────

export interface VintageBucket {
  vintageYear: number | null; // null = không có ngayVay
  tongDuNo: number;
  duNoQuaHan: number;
  count: number;
  tyLeNQH: number;
}

export function vintageNQH(rows: LoanRecord[]): VintageBucket[] {
  const map = new Map<number | null, VintageBucket>();
  for (const r of rows) {
    const y = r.ngayVay ? r.ngayVay.getFullYear() : null;
    let v = map.get(y);
    if (!v) {
      v = { vintageYear: y, tongDuNo: 0, duNoQuaHan: 0, count: 0, tyLeNQH: 0 };
      map.set(y, v);
    }
    v.tongDuNo += r.tongDuNo;
    v.duNoQuaHan += r.duNoQuaHan;
    v.count += 1;
  }
  for (const v of map.values()) {
    v.tyLeNQH = v.tongDuNo > 0 ? v.duNoQuaHan / v.tongDuNo : 0;
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.vintageYear === null) return 1;
    if (b.vintageYear === null) return -1;
    return a.vintageYear - b.vintageYear;
  });
}

// ─── HHI (Herfindahl–Hirschman Index) ────────────────────────────────────────

/**
 * Tính HHI trên thang 0–10000 (cao = tập trung). Mỗi đối tượng trong
 * trường `field` đóng góp `(share)^2 * 10000`.
 */
export function hhi(
  rows: LoanRecord[],
  field: keyof LoanRecord | ((r: LoanRecord) => string)
): number {
  const getKey = typeof field === 'function'
    ? field
    : (r: LoanRecord) => String(r[field] ?? '—') || '—';
  let total = 0;
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = getKey(r) || '—';
    map.set(k, (map.get(k) ?? 0) + r.tongDuNo);
    total += r.tongDuNo;
  }
  if (total === 0) return 0;
  let h = 0;
  for (const v of map.values()) {
    const s = v / total;
    h += s * s;
  }
  return h * 10000;
}

// ─── Top movers theo nhóm ────────────────────────────────────────────────────

export type MoverMetric = 'tongDuNo' | 'tyLeNQH' | 'rollRate';

export interface MoverRow {
  key: string;
  prevValue: number;
  currValue: number;
  delta: number;
  pctDelta: number | null;
  prevTongDuNo: number;
  currTongDuNo: number;
}

interface GroupSlice {
  prevTongDuNo: number;
  currTongDuNo: number;
  prevQH: number;
  currQH: number;
  prevTH: number;
  /** Σ duNoQuaHan_T cho khế ước trong nhóm vốn Trong hạn ở T-1 */
  rollNumerator: number;
}

/**
 * Tính top movers theo một dimension (PGD, Xã, ĐVUT, Chương trình, Tổ).
 *
 * - Với metric `tongDuNo`: delta tuyệt đối (curr − prev).
 * - Với metric `tyLeNQH`: delta tuyệt đối tỷ lệ (đơn vị 0–1).
 * - Với metric `rollRate`: tính roll rate trong nhóm (số tuyệt đối 0–1).
 *   Vì roll rate là tỷ lệ chuyển xấu, không có "prevValue" — `prevValue`
 *   được set bằng 0 và `delta` = roll rate, sắp xếp giảm dần.
 */
export function topMovers(
  joined: JoinedLoan[],
  field: keyof LoanRecord | ((r: LoanRecord) => string),
  metric: MoverMetric
): MoverRow[] {
  const getKey = typeof field === 'function'
    ? field
    : (r: LoanRecord) => String(r[field] ?? '—') || '—';
  const groups = new Map<string, GroupSlice>();
  const ensure = (k: string): GroupSlice => {
    let g = groups.get(k);
    if (!g) {
      g = {
        prevTongDuNo: 0,
        currTongDuNo: 0,
        prevQH: 0,
        currQH: 0,
        prevTH: 0,
        rollNumerator: 0,
      };
      groups.set(k, g);
    }
    return g;
  };

  for (const j of joined) {
    // Group key — ưu tiên kỳ sau, fallback kỳ trước (cho khế ước đã đóng)
    const ref = j.curr ?? j.prev;
    if (!ref) continue;
    const k = getKey(ref) || '—';
    const g = ensure(k);
    if (j.prev) {
      g.prevTongDuNo += j.prev.tongDuNo;
      g.prevQH += j.prev.duNoQuaHan;
      g.prevTH += j.prev.duNoTrongHan;
    }
    if (j.curr) {
      g.currTongDuNo += j.curr.tongDuNo;
      g.currQH += j.curr.duNoQuaHan;
    }
    if (metric === 'rollRate' && j.prev && deriveStatus(j.prev) === 'th' && j.curr) {
      g.rollNumerator += j.curr.duNoQuaHan;
    }
  }

  const out: MoverRow[] = [];
  for (const [key, g] of groups) {
    let prevValue = 0;
    let currValue = 0;
    if (metric === 'tongDuNo') {
      prevValue = g.prevTongDuNo;
      currValue = g.currTongDuNo;
    } else if (metric === 'tyLeNQH') {
      prevValue = g.prevTongDuNo > 0 ? g.prevQH / g.prevTongDuNo : 0;
      currValue = g.currTongDuNo > 0 ? g.currQH / g.currTongDuNo : 0;
    } else if (metric === 'rollRate') {
      prevValue = 0;
      currValue = g.prevTH > 0 ? g.rollNumerator / g.prevTH : 0;
    }
    const delta = currValue - prevValue;
    const pctDelta = prevValue === 0 ? null : delta / prevValue;
    out.push({
      key,
      prevValue,
      currValue,
      delta,
      pctDelta,
      prevTongDuNo: g.prevTongDuNo,
      currTongDuNo: g.currTongDuNo,
    });
  }
  return out;
}

// ─── Lifecycle counts (vòng đời khế ước & khách hàng) ────────────────────────

export interface LifecycleCounts {
  prevTotalLoans: number;
  currTotalLoans: number;
  retainedLoans: number;
  closedLoans: number;
  newLoans: number;
  prevTotalCustomers: number;
  currTotalCustomers: number;
  retainedCustomers: number;
  churnedCustomers: number;
  newCustomers: number;
  reactivatedCustomers: number;
}

export function lifecycleCounts(
  loanJoin: LoanJoinResult,
  customerJoin: CustomerJoinResult,
  prevRows: LoanRecord[],
  currRows: LoanRecord[]
): LifecycleCounts {
  const prevKH = new Set<string>();
  const currKH = new Set<string>();
  for (const r of prevRows) if (r.maKH) prevKH.add(r.maKH);
  for (const r of currRows) if (r.maKH) currKH.add(r.maKH);

  return {
    prevTotalLoans: prevRows.length,
    currTotalLoans: currRows.length,
    retainedLoans: loanJoin.bothCount,
    closedLoans: loanJoin.closedCount,
    newLoans: loanJoin.newCount,
    prevTotalCustomers: prevKH.size,
    currTotalCustomers: currKH.size,
    retainedCustomers: customerJoin.retainedCount,
    churnedCustomers: customerJoin.churnedCount,
    newCustomers: customerJoin.newCount,
    reactivatedCustomers: customerJoin.reactivatedCount,
  };
}

// ─── Phân loại biến động khế ước ─────────────────────────────────────────────

export type LoanChangeType =
  | 'new'
  | 'closed'
  | 'increased'
  | 'decreased'
  | 'worsened'
  | 'improved'
  | 'extended'
  | 'unchanged';

export interface LoanChange {
  key: string;
  type: LoanChangeType;
  prev: LoanRecord | null;
  curr: LoanRecord | null;
  duNoDelta: number;
  /** rank "tốt → xấu" delta; >0 là chuyển xấu */
  statusRankDelta: number;
}

export function classifyChanges(joined: JoinedLoan[]): LoanChange[] {
  const rank: Record<LoanStatus, number> = { th: 0, qh: 1, kh: 2, none: 3 };
  const out: LoanChange[] = [];
  for (const j of joined) {
    const prevDuNo = j.prev?.tongDuNo ?? 0;
    const currDuNo = j.curr?.tongDuNo ?? 0;
    const fromStatus: LoanStatus = j.prev ? deriveStatus(j.prev) : 'none';
    const toStatus: LoanStatus = j.curr ? deriveStatus(j.curr) : 'none';
    const statusRankDelta = rank[toStatus] - rank[fromStatus];
    let type: LoanChangeType;
    if (!j.prev) type = 'new';
    else if (!j.curr) type = 'closed';
    else if (statusRankDelta > 0) type = 'worsened';
    else if (statusRankDelta < 0) type = 'improved';
    else if (
      j.prev.ngayDHGiaHan &&
      (!j.prev.ngayDHGiaHan ||
        j.curr.ngayDHGiaHan?.getTime() !== j.prev.ngayDHGiaHan?.getTime())
    )
      type = 'extended';
    else if (currDuNo > prevDuNo) type = 'increased';
    else if (currDuNo < prevDuNo) type = 'decreased';
    else type = 'unchanged';

    out.push({
      key: j.key,
      type,
      prev: j.prev,
      curr: j.curr,
      duNoDelta: currDuNo - prevDuNo,
      statusRankDelta,
    });
  }
  return out;
}

// ─── Lịch đáo hạn 90 ngày tới ────────────────────────────────────────────────

export interface MaturityBucket {
  bucket: '0-30' | '31-60' | '61-90';
  count: number;
  tongDuNo: number;
}

export function loansMaturingNext90(rows: LoanRecord[], asOf: Date | null): MaturityBucket[] {
  const buckets: MaturityBucket[] = [
    { bucket: '0-30', count: 0, tongDuNo: 0 },
    { bucket: '31-60', count: 0, tongDuNo: 0 },
    { bucket: '61-90', count: 0, tongDuNo: 0 },
  ];
  if (!asOf) return buckets;
  const refMs = asOf.getTime();
  for (const r of rows) {
    const due = r.ngayDHGiaHan ?? r.ngayDHHopDong;
    if (!due) continue;
    const diff = Math.floor((due.getTime() - refMs) / DAY_MS);
    if (diff < 0 || diff > 90) continue;
    let idx: number;
    if (diff <= 30) idx = 0;
    else if (diff <= 60) idx = 1;
    else idx = 2;
    buckets[idx].count++;
    buckets[idx].tongDuNo += r.tongDuNo;
  }
  return buckets;
}

// ─── Quality stacked bar (Trong hạn / Quá hạn / Khoanh) ──────────────────────

export interface QualitySnapshot {
  trongHan: number;
  quaHan: number;
  khoanh: number;
  total: number;
}

export function qualitySnapshot(rows: LoanRecord[]): QualitySnapshot {
  let trongHan = 0,
    quaHan = 0,
    khoanh = 0;
  for (const r of rows) {
    trongHan += r.duNoTrongHan;
    quaHan += r.duNoQuaHan;
    khoanh += r.duNoKhoanh;
  }
  return { trongHan, quaHan, khoanh, total: trongHan + quaHan + khoanh };
}
