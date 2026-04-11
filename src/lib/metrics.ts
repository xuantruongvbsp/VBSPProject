import type { LoanRecord } from './types';

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
    if (r.maKH) kh.add(r.maKH);
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
    mucVayBQ: rows.length > 0 ? tongGiaiNgan / rows.length : 0,
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
}

export function histogramMucVay(rows: LoanRecord[]): HistogramBucket[] {
  const buckets: { name: string; min: number; max: number }[] = [
    { name: '< 10tr', min: 0, max: 10e6 },
    { name: '10–30tr', min: 10e6, max: 30e6 },
    { name: '30–50tr', min: 30e6, max: 50e6 },
    { name: '50–100tr', min: 50e6, max: 100e6 },
    { name: '100–200tr', min: 100e6, max: 200e6 },
    { name: '≥ 200tr', min: 200e6, max: Infinity },
  ];
  const counts = new Array(buckets.length).fill(0);
  for (const r of rows) {
    const v = r.mucVay;
    for (let i = 0; i < buckets.length; i++) {
      if (v < buckets[i].max) {
        counts[i]++;
        break;
      }
    }
  }
  return buckets.map((b, i) => ({
    bucket: b.name,
    count: counts[i],
    min: b.min,
    max: b.max,
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
    const d = r.ngayDHGiaHan ?? r.ngayDHHopDong;
    if (!d) continue;
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const cur = map.get(key) ?? { count: 0, tongDuNo: 0 };
    cur.count++;
    cur.tongDuNo += r.tongDuNo;
    map.set(key, cur);
  }
  return Array.from(map.entries())
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
  tenDVUT: string;
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
        tenDVUT: r.tenDVUT,
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
