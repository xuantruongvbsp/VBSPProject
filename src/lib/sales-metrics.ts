// Doanh số (sales / flow) — phân bổ theo trục BH (ngày vay) → ĐH (ngayDHGDXA).
//
// Quy ước:
//  - Cho vay (disbursement) ghi nhận tại BH: cộng `tongGiaiNgan` vào kỳ chứa `ngayVay`.
//  - Thu nợ dự kiến (scheduled collection): chia đều `tongGiaiNgan` cho số tháng
//    trong khoảng [BH, ĐH] rồi gán mỗi tháng 1 phần. Đây là phân bổ tuyến tính
//    theo lịch hợp đồng — KHÔNG phải số thực thu. Khi không có dữ liệu giao dịch
//    chi tiết, đây là cách duy nhất tái lập trục thời gian thu nợ từ Báo cáo 31.
//  - Net flow = Cho vay − Thu nợ dự kiến.
//  - Loans bị loại khỏi phân bổ thu nợ nếu thiếu BH/ĐH hoặc ĐH ≤ BH (vẫn được
//    đếm cho cho-vay nếu có BH).
//
// Đơn vị tiền: VND nguyên gốc — UI sẽ format ra "tỷ" qua `fmtTy`.

import type { LoanRecord } from '@/lib/types';

export type Granularity = 'month' | 'quarter' | 'year';

/* ── Khóa kỳ ─────────────────────────────────────────────────────────── */
export function periodKey(d: Date, g: Granularity): string {
  const y = d.getFullYear();
  if (g === 'year') return String(y);
  if (g === 'quarter') return `${y}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Nhãn hiển thị ngắn gọn cho trục x. */
export function periodLabel(key: string, g: Granularity): string {
  if (g === 'year') return key;
  if (g === 'quarter') {
    const [y, q] = key.split('-');
    return `${q} ${y}`;
  }
  // month "YYYY-MM" → "MM/YYYY"
  const [y, m] = key.split('-');
  return `${m}/${y}`;
}

/** Chuyển kỳ tháng sang khóa quý / năm tương ứng (dùng để aggregate). */
function rollUp(monthKey: string, g: Granularity): string {
  if (g === 'month') return monthKey;
  const [y, m] = monthKey.split('-');
  if (g === 'year') return y;
  return `${y}-Q${Math.floor((Number(m) - 1) / 3) + 1}`;
}

/** Tạo dãy khóa tháng liên tục giữa hai mốc (bao gồm cả hai đầu). */
function monthRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  let y = from.getFullYear();
  let m = from.getMonth();
  const ey = to.getFullYear();
  const em = to.getMonth();
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out;
}

/* ── Đầu ra ──────────────────────────────────────────────────────────── */
export interface SalesPeriodPoint {
  key: string;
  label: string;
  choVay: number;
  thuNoDuKien: number;
  netFlow: number;
  soMonMoi: number;
  soMonDaoHan: number;
  ticketTB: number;
}

export interface SalesBreakdown {
  key: string;
  label: string;
  choVay: number;
  thuNoDuKien: number;
  netFlow: number;
  soMonMoi: number;
}

export interface SalesStats {
  series: SalesPeriodPoint[];
  /** Số khế ước có BH nhưng không phân bổ được thu nợ (thiếu/không hợp lệ ĐH). */
  excluded: number;
  /** Tổng số khế ước được dùng để phân bổ thu nợ. */
  scheduled: number;
}

/* ── Tính toán chính ─────────────────────────────────────────────────── */

/**
 * Sinh chuỗi doanh số theo kỳ. Trả về tất cả kỳ có dữ liệu (sắp xếp tăng dần).
 * Caller tự cắt cửa sổ hiển thị (last N) sau khi nhận về.
 */
export function salesByPeriod(
  rows: LoanRecord[],
  g: Granularity
): SalesStats {
  const choVayMap = new Map<string, number>(); // key → tổng cho vay
  const thuNoMap = new Map<string, number>(); // key → tổng thu nợ dự kiến
  const newCountMap = new Map<string, number>(); // key → số món mới
  const matureCountMap = new Map<string, number>(); // key → số món đáo hạn

  let excluded = 0;
  let scheduled = 0;

  for (const r of rows) {
    if (r.ngayVay) {
      const k = periodKey(r.ngayVay, g);
      choVayMap.set(k, (choVayMap.get(k) ?? 0) + (r.tongGiaiNgan || 0));
      newCountMap.set(k, (newCountMap.get(k) ?? 0) + 1);
    }

    // Đáo hạn: dùng đúng cột ĐH GDXA (chốt với người dùng).
    if (r.ngayDHGDXA) {
      const k = periodKey(r.ngayDHGDXA, g);
      matureCountMap.set(k, (matureCountMap.get(k) ?? 0) + 1);
    }

    // Phân bổ thu nợ dự kiến: cần cả BH và ĐH GDXA, ĐH > BH, có số tiền.
    if (
      r.ngayVay &&
      r.ngayDHGDXA &&
      r.ngayDHGDXA.getTime() >= r.ngayVay.getTime() &&
      (r.tongGiaiNgan || 0) > 0
    ) {
      const months = monthRange(r.ngayVay, r.ngayDHGDXA);
      if (months.length > 0) {
        const perMonth = r.tongGiaiNgan / months.length;
        for (const mk of months) {
          const bucket = rollUp(mk, g);
          thuNoMap.set(bucket, (thuNoMap.get(bucket) ?? 0) + perMonth);
        }
        scheduled++;
      }
    } else if (r.ngayVay && (r.tongGiaiNgan || 0) > 0) {
      excluded++;
    }
  }

  // Hợp nhất tất cả khóa
  const allKeys = new Set<string>([
    ...choVayMap.keys(),
    ...thuNoMap.keys(),
    ...newCountMap.keys(),
    ...matureCountMap.keys(),
  ]);

  const series: SalesPeriodPoint[] = [];
  for (const k of allKeys) {
    const choVay = choVayMap.get(k) ?? 0;
    const soMonMoi = newCountMap.get(k) ?? 0;
    series.push({
      key: k,
      label: periodLabel(k, g),
      choVay,
      thuNoDuKien: thuNoMap.get(k) ?? 0,
      netFlow: choVay - (thuNoMap.get(k) ?? 0),
      soMonMoi,
      soMonDaoHan: matureCountMap.get(k) ?? 0,
      ticketTB: soMonMoi > 0 ? choVay / soMonMoi : 0,
    });
  }
  series.sort((a, b) => a.key.localeCompare(b.key));
  return { series, excluded, scheduled };
}

/* ── KPI tổng hợp cho 1 kỳ ───────────────────────────────────────────── */
export interface SalesKpi {
  choVay: number;
  thuNoDuKien: number;
  netFlow: number;
  soMonMoi: number;
  soMonDaoHan: number;
  ticketTB: number;
  /** Delta % so với kỳ liền trước; null nếu không có kỳ trước. */
  deltaChoVay: number | null;
  deltaThuNo: number | null;
  deltaSoMonMoi: number | null;
}

/** Lấy KPI cho kỳ mới nhất + kỳ kế trước để tính delta. */
export function latestPeriodKpi(series: SalesPeriodPoint[]): {
  curr: SalesPeriodPoint | null;
  prev: SalesPeriodPoint | null;
  kpi: SalesKpi;
} {
  if (series.length === 0) {
    return {
      curr: null,
      prev: null,
      kpi: {
        choVay: 0,
        thuNoDuKien: 0,
        netFlow: 0,
        soMonMoi: 0,
        soMonDaoHan: 0,
        ticketTB: 0,
        deltaChoVay: null,
        deltaThuNo: null,
        deltaSoMonMoi: null,
      },
    };
  }
  const curr = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const pct = (a: number, b: number | undefined): number | null => {
    if (b === undefined || b === 0) return null;
    return ((a - b) / b) * 100;
  };
  return {
    curr,
    prev,
    kpi: {
      choVay: curr.choVay,
      thuNoDuKien: curr.thuNoDuKien,
      netFlow: curr.netFlow,
      soMonMoi: curr.soMonMoi,
      soMonDaoHan: curr.soMonDaoHan,
      ticketTB: curr.ticketTB,
      deltaChoVay: pct(curr.choVay, prev?.choVay),
      deltaThuNo: pct(curr.thuNoDuKien, prev?.thuNoDuKien),
      deltaSoMonMoi: pct(curr.soMonMoi, prev?.soMonMoi),
    },
  };
}

/* ── Cộng dồn lifetime (tổng toàn bộ data) ───────────────────────────── */
export function lifetimeSalesTotal(rows: LoanRecord[]): {
  choVay: number;
  soMonCoNgayVay: number;
  soMonCoDH: number;
} {
  let choVay = 0;
  let soMonCoNgayVay = 0;
  let soMonCoDH = 0;
  for (const r of rows) {
    if (r.ngayVay) {
      choVay += r.tongGiaiNgan || 0;
      soMonCoNgayVay++;
    }
    if (r.ngayDHGDXA) soMonCoDH++;
  }
  return { choVay, soMonCoNgayVay, soMonCoDH };
}

/* ── Breakdown theo chương trình / xã / PGD ──────────────────────────── */
export type BreakdownDim = 'tenChuongTrinh' | 'maPGD' | 'tenPGD' | 'tenXa' | 'tenDVUT';

/**
 * Tổng cho-vay & số món mới của *kỳ được chỉ định* (key kỳ), broken-down
 * theo dim. Nếu `key=null` → cộng dồn toàn bộ data.
 */
export function salesBreakdown(
  rows: LoanRecord[],
  g: Granularity,
  key: string | null,
  dim: BreakdownDim
): SalesBreakdown[] {
  const map = new Map<
    string,
    { choVay: number; thuNoDuKien: number; soMonMoi: number }
  >();

  for (const r of rows) {
    const dimRaw = (r as unknown as Record<string, unknown>)[dim];
    const label = (typeof dimRaw === 'string' && dimRaw.trim()) || '(Không rõ)';

    // Cho vay + số món mới: gán vào kỳ chứa BH.
    if (r.ngayVay) {
      const inKey = key === null || periodKey(r.ngayVay, g) === key;
      if (inKey) {
        const cur = map.get(label) ?? { choVay: 0, thuNoDuKien: 0, soMonMoi: 0 };
        cur.choVay += r.tongGiaiNgan || 0;
        cur.soMonMoi += 1;
        map.set(label, cur);
      }
    }

    // Thu nợ dự kiến: chỉ tính nếu kỳ được chỉ định nằm trong [BH, ĐH].
    if (
      r.ngayVay &&
      r.ngayDHGDXA &&
      r.ngayDHGDXA.getTime() >= r.ngayVay.getTime() &&
      (r.tongGiaiNgan || 0) > 0
    ) {
      const months = monthRange(r.ngayVay, r.ngayDHGDXA);
      if (months.length === 0) continue;
      const perMonth = r.tongGiaiNgan / months.length;
      let added = 0;
      if (key === null) {
        added = r.tongGiaiNgan;
      } else {
        for (const mk of months) {
          if (rollUp(mk, g) === key) added += perMonth;
        }
      }
      if (added > 0) {
        const cur = map.get(label) ?? { choVay: 0, thuNoDuKien: 0, soMonMoi: 0 };
        cur.thuNoDuKien += added;
        map.set(label, cur);
      }
    }
  }

  const out: SalesBreakdown[] = [];
  for (const [label, v] of map.entries()) {
    out.push({
      key: label,
      label,
      choVay: v.choVay,
      thuNoDuKien: v.thuNoDuKien,
      netFlow: v.choVay - v.thuNoDuKien,
      soMonMoi: v.soMonMoi,
    });
  }
  out.sort((a, b) => b.choVay - a.choVay);
  return out;
}
