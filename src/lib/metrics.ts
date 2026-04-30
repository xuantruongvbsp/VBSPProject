import type { LoanRecord } from './types';

// Khế ước "đang hoạt động": có `tinhTrangMonVay` và khác "close"/"closed".
// Dùng để loại các khế ước trống trạng thái hoặc đã tất toán ra khỏi
// các chỉ tiêu đếm/bình quân cấp khách hàng.
export function isOpenLoan(r: LoanRecord): boolean {
  const s = (r.tinhTrangMonVay ?? '').trim().toLowerCase();
  if (s === '') return false;
  return s !== 'close' && s !== 'closed';
}

export interface PortfolioKpi {
  soKheUoc: number;
  soKhachHang: number;
  tongDuNo: number;
  tongGiaiNgan: number;
  duNoQuaHan: number;
  tyLeNoQuaHan: number;
  duNoKhoanh: number;
  laiTonTH: number;
  thuLaiTHThang: number;
  laiSuatBQ: number;
  mucVayBQ: number;
}

export function computeKpi(rows: LoanRecord[]): PortfolioKpi {
  if (!rows.length) {
    return {
      soKheUoc: 0,
      soKhachHang: 0,
      tongDuNo: 0,
      tongGiaiNgan: 0,
      duNoQuaHan: 0,
      tyLeNoQuaHan: 0,
      duNoKhoanh: 0,
      laiTonTH: 0,
      thuLaiTHThang: 0,
      laiSuatBQ: 0,
      mucVayBQ: 0,
    };
  }
  let tongDuNo = 0;
  let tongGiaiNgan = 0;
  let duNoQuaHan = 0;
  let duNoKhoanh = 0;
  let laiTonTH = 0;
  let thuLaiTHThang = 0;
  let weightedRate = 0;
  const kh = new Set<string>();

  for (const r of rows) {
    tongDuNo += r.tongDuNo;
    tongGiaiNgan += r.tongGiaiNgan;
    duNoQuaHan += r.duNoQuaHan;
    duNoKhoanh += r.duNoKhoanh;
    laiTonTH += r.laiTonTH;
    thuLaiTHThang += r.thuLaiTHThang;
    weightedRate += r.laiSuat * r.tongDuNo;
    if (r.maKH && isOpenLoan(r)) kh.add(r.maKH);
  }

  return {
    soKheUoc: rows.length,
    soKhachHang: kh.size,
    tongDuNo,
    tongGiaiNgan,
    duNoQuaHan,
    tyLeNoQuaHan: tongDuNo > 0 ? (duNoQuaHan / tongDuNo) * 100 : 0,
    duNoKhoanh,
    laiTonTH,
    thuLaiTHThang,
    laiSuatBQ: tongDuNo > 0 ? weightedRate / tongDuNo : 0,
    mucVayBQ: kh.size > 0 ? tongDuNo / kh.size : 0,
  };
}

export interface GroupAgg {
  key: string;
  label: string;
  soKheUoc: number;
  soKhachHang: number;
  tongDuNo: number;
  duNoTrongHan: number;
  duNoQuaHan: number;
  duNoKhoanh: number;
  tyLeNoQH: number;
  laiTonTH: number;
  thuLaiTHThang: number;
  /**
   * Danh sách maKH thuộc nhóm — chỉ set ở các groupBy dẫn xuất (ví dụ theo
   * độ tuổi), để phục vụ drill-down khi key không phải là trường của LoanRecord.
   */
  maKHs?: string[];
}

export function groupBy(
  rows: LoanRecord[],
  field: keyof LoanRecord
): GroupAgg[] {
  const map = new Map<string, GroupAgg & { _kh: Set<string> }>();
  for (const r of rows) {
    const key = String(r[field] ?? '—') || '—';
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        label: key,
        soKheUoc: 0,
        soKhachHang: 0,
        tongDuNo: 0,
        duNoTrongHan: 0,
        duNoQuaHan: 0,
        duNoKhoanh: 0,
        tyLeNoQH: 0,
        laiTonTH: 0,
        thuLaiTHThang: 0,
        _kh: new Set<string>(),
      };
      map.set(key, g);
    }
    g.soKheUoc += 1;
    g.tongDuNo += r.tongDuNo;
    g.duNoTrongHan += r.duNoTrongHan;
    g.duNoQuaHan += r.duNoQuaHan;
    g.duNoKhoanh += r.duNoKhoanh;
    g.laiTonTH += r.laiTonTH;
    g.thuLaiTHThang += r.thuLaiTHThang;
    if (r.maKH) g._kh.add(r.maKH);
  }
  const out: GroupAgg[] = [];
  for (const g of map.values()) {
    g.soKhachHang = g._kh.size;
    g.tyLeNoQH = g.tongDuNo > 0 ? (g.duNoQuaHan / g.tongDuNo) * 100 : 0;
    const { _kh, ...rest } = g;
    out.push(rest);
  }
  return out.sort((a, b) => b.tongDuNo - a.tongDuNo);
}

/* ── Cơ cấu khách hàng theo độ tuổi ──────────────────────────────────── */

/**
 * Các khoảng độ tuổi (năm trọn), bám theo quy ước phân tích khách hàng VBSP:
 *  - "< 25" (thanh niên khởi nghiệp)
 *  - "25–34", "35–44", "45–54", "55–64"
 *  - "≥ 65" (người cao tuổi)
 *  - "Không rõ" dành cho khế ước không có ngày sinh.
 * Khoảng nửa mở [min, max) → không đếm trùng giữa các nhóm liền kề.
 */
const AGE_BUCKETS: { key: string; label: string; min: number; max: number }[] = [
  { key: 'lt25', label: '< 25', min: 0, max: 25 },
  { key: '25-34', label: '25–34', min: 25, max: 35 },
  { key: '35-44', label: '35–44', min: 35, max: 45 },
  { key: '45-54', label: '45–54', min: 45, max: 55 },
  { key: '55-64', label: '55–64', min: 55, max: 65 },
  { key: 'gte65', label: '≥ 65', min: 65, max: Infinity },
];
const AGE_UNKNOWN = { key: 'unknown', label: 'Không rõ' };

/** Tính tuổi trọn năm tại `ref` (năm + tháng + ngày). Trả null nếu thiếu DOB. */
function ageYears(dob: Date | null, ref: Date): number | null {
  if (!dob) return null;
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

function ageBucketKey(age: number | null): string {
  if (age == null) return AGE_UNKNOWN.key;
  for (const b of AGE_BUCKETS) {
    if (age >= b.min && age < b.max) return b.key;
  }
  return AGE_UNKNOWN.key;
}

/**
 * Gom khế ước theo độ tuổi của khách hàng tại ngày tham chiếu (thường là
 * `ngaySoLieu`). Mỗi bucket giữ lại danh sách `maKHs` để phục vụ drill-down
 * xuống trang Tra cứu chi tiết (tất cả khế ước thuộc các KH trong bucket).
 *
 * Thứ tự output giữ nguyên theo tuổi tăng dần — không sort theo `tongDuNo`
 * như `groupBy` để các nhóm tuổi hiển thị liên tục.
 */
export function groupByAge(rows: LoanRecord[], refDate: Date): GroupAgg[] {
  const labels = new Map<string, string>();
  for (const b of AGE_BUCKETS) labels.set(b.key, b.label);
  labels.set(AGE_UNKNOWN.key, AGE_UNKNOWN.label);

  const order = [...AGE_BUCKETS.map((b) => b.key), AGE_UNKNOWN.key];
  const map = new Map<string, GroupAgg & { _kh: Set<string>; _maKHs: Set<string> }>();

  for (const r of rows) {
    const key = ageBucketKey(ageYears(r.ngaySinh, refDate));
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        label: labels.get(key) ?? key,
        soKheUoc: 0,
        soKhachHang: 0,
        tongDuNo: 0,
        duNoTrongHan: 0,
        duNoQuaHan: 0,
        duNoKhoanh: 0,
        tyLeNoQH: 0,
        laiTonTH: 0,
        thuLaiTHThang: 0,
        _kh: new Set<string>(),
        _maKHs: new Set<string>(),
      };
      map.set(key, g);
    }
    g.soKheUoc += 1;
    g.tongDuNo += r.tongDuNo;
    g.duNoTrongHan += r.duNoTrongHan;
    g.duNoQuaHan += r.duNoQuaHan;
    g.duNoKhoanh += r.duNoKhoanh;
    g.laiTonTH += r.laiTonTH;
    g.thuLaiTHThang += r.thuLaiTHThang;
    if (r.maKH) {
      g._kh.add(r.maKH);
      g._maKHs.add(r.maKH);
    }
  }

  const out: GroupAgg[] = [];
  for (const key of order) {
    const g = map.get(key);
    if (!g) continue;
    g.soKhachHang = g._kh.size;
    g.tyLeNoQH = g.tongDuNo > 0 ? (g.duNoQuaHan / g.tongDuNo) * 100 : 0;
    const { _kh, _maKHs, ...rest } = g;
    out.push({ ...rest, maKHs: Array.from(_maKHs) });
  }
  return out;
}

export function timeSeriesGiaiNgan(
  rows: LoanRecord[]
): { month: string; giaiNgan: number; soKheUoc: number }[] {
  const map = new Map<string, { giaiNgan: number; soKheUoc: number }>();
  for (const r of rows) {
    if (!r.ngayVay) continue;
    const key =
      r.ngayVay.getFullYear() +
      '-' +
      String(r.ngayVay.getMonth() + 1).padStart(2, '0');
    const cur = map.get(key) ?? { giaiNgan: 0, soKheUoc: 0 };
    cur.giaiNgan += r.tongGiaiNgan;
    cur.soKheUoc += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));
}

export interface HistogramBucket {
  bucket: string;
  count: number;
  min: number;
  max: number;
  /** Danh sách maKH thuộc bucket — chỉ có ở mode='customer' để phục vụ drill-down */
  maKHs?: string[];
}

export type HistogramMode = 'loan' | 'customer';

/**
 * Phân bố tổng dư nợ theo khoảng giá trị (số dư hiện tại của khế ước/khách).
 * - `mode = 'loan'` (mặc định): mỗi khế ước là 1 đơn vị, bucket theo `tongDuNo` của khế ước.
 * - `mode = 'customer'`: gom theo `maKH`, cộng tổng `tongDuNo` của tất cả khế ước của khách hàng,
 *   rồi bucket theo tổng đó — đếm số khách hàng riêng biệt trong từng khoảng.
 */
export function histogramTongDuNo(
  rows: LoanRecord[],
  mode: HistogramMode = 'loan'
): HistogramBucket[] {
  const buckets: { name: string; min: number; max: number }[] = [
    { name: '< 10tr', min: 0, max: 10e6 },
    { name: '10–30tr', min: 10e6, max: 30e6 },
    { name: '30–50tr', min: 30e6, max: 50e6 },
    { name: '50–100tr', min: 50e6, max: 100e6 },
    { name: '100–200tr', min: 100e6, max: 200e6 },
    { name: '≥ 200tr', min: 200e6, max: Infinity },
  ];
  // Loại các khế ước rỗng "Tình trạng món vay" — đây là dữ liệu rác hay rơi
  // vào bucket "<10tr" và làm sai lệch phân bố thực tế.
  const cleaned = rows.filter((r) => (r.tinhTrangMonVay ?? '').trim() !== '');
  const counts = new Array(buckets.length).fill(0);
  const keysPerBucket: string[][] | null =
    mode === 'customer' ? buckets.map(() => [] as string[]) : null;

  if (mode === 'customer') {
    const perKH = new Map<string, number>();
    for (const r of cleaned) {
      const key = r.maKH || `__${r.soKheUoc}`; // khế ước không có maKH → tự đếm như 1 KH
      perKH.set(key, (perKH.get(key) ?? 0) + r.tongDuNo);
    }
    for (const [key, v] of perKH.entries()) {
      for (let i = 0; i < buckets.length; i++) {
        if (v < buckets[i].max) {
          counts[i]++;
          keysPerBucket![i].push(key);
          break;
        }
      }
    }
  } else {
    for (const r of cleaned) {
      const v = r.tongDuNo;
      for (let i = 0; i < buckets.length; i++) {
        if (v < buckets[i].max) {
          counts[i]++;
          break;
        }
      }
    }
  }

  return buckets.map((b, i) => ({
    bucket: b.name,
    count: counts[i],
    min: b.min,
    max: b.max,
    ...(keysPerBucket ? { maKHs: keysPerBucket[i] } : {}),
  }));
}

/**
 * Sinh dữ liệu lịch đáo hạn theo tháng — gom toàn bộ các năm có khế ước
 * đáo hạn (kể cả các năm cũ và rất xa). Component hiển thị sẽ tự cuộn
 * dọc nếu danh sách năm quá dài.
 */
export function heatmapDaoHan(
  rows: LoanRecord[]
): { ym: string; count: number; tongDuNo: number }[] {
  const map = new Map<string, { count: number; tongDuNo: number }>();
  for (const r of rows) {
    // Bỏ qua các khế ước đã tất toán (Tình trạng món vay = "close").
    const status = (r.tinhTrangMonVay ?? '').trim().toLowerCase();
    if (status === 'close' || status === 'closed') continue;
    const d = r.ngayDHGDXA;
    if (!d) continue;
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const cur = map.get(key) ?? { count: 0, tongDuNo: 0 };
    cur.count++;
    cur.tongDuNo += r.tongDuNo;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.tongDuNo > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, v]) => ({ ym, ...v }));
}

export function distinctValues(
  rows: LoanRecord[],
  field: keyof LoanRecord
): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    const v = r[field];
    if (v !== null && v !== undefined && v !== '') s.add(String(v));
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, 'vi'));
}

// ─── Khách hàng ngừng giao dịch ────────────────────────────────────────────

export interface DormantCustomer {
  maKH: string;
  tenKH: string;
  tenPGD: string;
  tenXa: string;
  tenDVUT: string;
  tenTo: string;
  tenChuongTrinh: string;
  soKheUoc: number;
  tongDuNo: number;
  /** Tổng lãi tồn (trong hạn + quá hạn) cộng dồn từ tất cả khế ước của KH */
  laiTon: number;
  ngayHoatDongCuoi: Date | null;
  daysSince: number;
}

/**
 * Liệt kê các khách hàng đã ngừng phát sinh giao dịch trong khoảng
 * `[minMonths, maxMonths)` tháng tính tới `referenceDate` (ngày chốt số liệu).
 *
 * - `minMonths` là chặn dưới (≥): khách phải im lặng ít nhất chừng đó tháng.
 * - `maxMonths` là chặn trên (<, không bao gồm): nếu null/undefined thì
 *   không giới hạn — tương đương "ngừng giao dịch ≥ minMonths tháng".
 *
 * Logic: gom nhóm theo mã khách hàng, lấy ngày giao dịch gần nhất trong tất cả
 * khế ước của khách. Khách không có ngày giao dịch gần nhất (dữ liệu trống) sẽ
 * bị bỏ qua.
 */
export function dormantCustomers(
  rows: LoanRecord[],
  minMonths: number,
  referenceDate: Date | null,
  maxMonths?: number | null
): DormantCustomer[] {
  if (!referenceDate || rows.length === 0) return [];

  const minCutoff = new Date(referenceDate);
  minCutoff.setMonth(minCutoff.getMonth() - minMonths);
  const minCutoffMs = minCutoff.getTime();

  let maxCutoffMs: number | null = null;
  if (maxMonths != null) {
    const maxCutoff = new Date(referenceDate);
    maxCutoff.setMonth(maxCutoff.getMonth() - maxMonths);
    maxCutoffMs = maxCutoff.getTime();
  }

  const refMs = referenceDate.getTime();
  const dayMs = 86_400_000;

  const map = new Map<string, DormantCustomer>();
  for (const r of rows) {
    if (!r.maKH) continue;
    let entry = map.get(r.maKH);
    if (!entry) {
      entry = {
        maKH: r.maKH,
        tenKH: r.tenKH,
        tenPGD: r.tenPGD,
        tenXa: r.tenXa,
        tenDVUT: r.tenDVUT,
        tenTo: r.tenTo,
        tenChuongTrinh: r.tenChuongTrinh,
        soKheUoc: 0,
        tongDuNo: 0,
        laiTon: 0,
        ngayHoatDongCuoi: null,
        daysSince: 0,
      };
      map.set(r.maKH, entry);
    }
    entry.soKheUoc += 1;
    entry.tongDuNo += r.tongDuNo;
    entry.laiTon += (r.laiTonTH ?? 0) + (r.laiTonQH ?? 0);
    const last = r.ngayGiaoDichGanNhat;
    if (last && (!entry.ngayHoatDongCuoi || last > entry.ngayHoatDongCuoi)) {
      entry.ngayHoatDongCuoi = last;
    }
  }

  const out: DormantCustomer[] = [];
  for (const e of map.values()) {
    if (!e.ngayHoatDongCuoi) continue;
    const t = e.ngayHoatDongCuoi.getTime();
    if (t > minCutoffMs) continue;
    if (maxCutoffMs !== null && t <= maxCutoffMs) continue;
    e.daysSince = Math.floor((refMs - t) / dayMs);
    out.push(e);
  }
  return out.sort((a, b) => b.daysSince - a.daysSince);
}
