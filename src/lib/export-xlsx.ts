// Xuất báo cáo Excel (.xlsx) cho webapp VSPPRO
//
// Sử dụng SheetJS (`xlsx`) — hỗ trợ nguyên bản tiếng Việt có dấu, không cần
// xử lý font như PDF. Tất cả định dạng số / tiền / ngày đều đi qua các hàm
// trong `@/lib/format` để đảm bảo nhất quán với giao diện.

import * as XLSX from 'xlsx';
import type { LoanRecord } from '@/lib/types';
import type { DormantCustomer, PortfolioKpi } from '@/lib/metrics';
import { fmtCurrency, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';

export interface XlsxExportInput {
  /** Danh sách khế ước đã lọc theo bộ lọc hiện hành */
  rows: LoanRecord[];
  /** Bộ chỉ tiêu KPI đã tính sẵn */
  kpi: PortfolioKpi;
  /** Tiêu đề trang, ví dụ "Tổng quan danh mục tín dụng" */
  pageTitle: string;
  /** Phụ đề tùy chọn, ví dụ "Snapshot 28/03/2026 — 15.356 khế ước" */
  subtitle?: string;
  /** Tên tệp, nếu bỏ trống sẽ tự sinh theo ngày giờ hiện tại */
  filename?: string;
  /** Các sheet bổ sung (ví dụ kết quả groupBy theo ĐVUT / chương trình) */
  extraSheets?: { name: string; rows: Record<string, unknown>[] }[];
}

/** Cắt ngắn tên sheet theo giới hạn 31 ký tự của Excel */
function safeSheetName(name: string): string {
  // Excel không cho phép: \\ / ? * [ ] :
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim();
  return cleaned.slice(0, 31) || 'Sheet';
}

/** Sinh tên tệp chuẩn: VSPPRO_<slug>_<yyyyMMdd_HHmm>.xlsx */
function defaultFilename(pageTitle: string, ext: 'xlsx' | 'pdf'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts =
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    '_' +
    pad(now.getHours()) +
    pad(now.getMinutes());
  const slug = pageTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  return `VSPPRO_${slug || 'bao_cao'}_${ts}.${ext}`;
}

/** Xuất tên tệp mặc định — dùng chung cho cả XLSX và PDF */
export function makeDefaultFilename(
  pageTitle: string,
  ext: 'xlsx' | 'pdf'
): string {
  return defaultFilename(pageTitle, ext);
}

/** Danh mục các trường được xuất trong sheet chi tiết khế ước */
interface LoanColumn {
  header: string;
  get: (r: LoanRecord) => string | number;
  /** Mã định dạng số của Excel (tuỳ chọn) */
  numFmt?: string;
}

const LOAN_COLUMNS: LoanColumn[] = [
  { header: 'Mã chi nhánh', get: (r) => r.maCN },
  { header: 'Mã PGD', get: (r) => r.maPGD },
  { header: 'Tên PGD', get: (r) => r.tenPGD },
  { header: 'Mã xã', get: (r) => r.maXa },
  { header: 'Tên xã', get: (r) => r.tenXa },
  { header: 'Tên thôn', get: (r) => r.tenThon },
  { header: 'Mã khách hàng', get: (r) => r.maKH },
  { header: 'Tên khách hàng', get: (r) => r.tenKH },
  { header: 'Phân loại', get: (r) => r.phanLoai },
  { header: 'Giới tính', get: (r) => r.gioiTinh },
  { header: 'Dân tộc', get: (r) => r.tenDanToc },
  { header: 'Tổ TK&VV', get: (r) => r.tenTo },
  { header: 'Đơn vị ủy thác', get: (r) => r.tenDVUT },
  { header: 'Số khế ước', get: (r) => r.soKheUoc },
  { header: 'Ngày vay', get: (r) => fmtDate(r.ngayVay) },
  { header: 'Ngày đến hạn HĐ', get: (r) => fmtDate(r.ngayDHHopDong) },
  { header: 'Ngày đến hạn gia hạn', get: (r) => fmtDate(r.ngayDHGiaHan) },
  { header: 'Thời hạn vay (tháng)', get: (r) => r.thoiHanVay, numFmt: '#,##0' },
  { header: 'Lãi suất (%/năm)', get: (r) => r.laiSuat, numFmt: '#,##0.00' },
  { header: 'Hình thức vay', get: (r) => r.hinhThucVay },
  { header: 'Tình trạng món vay', get: (r) => r.tinhTrangMonVay },
  { header: 'Chương trình tín dụng', get: (r) => r.tenChuongTrinh },
  { header: 'Nguồn vốn', get: (r) => r.nguonVon },
  { header: 'Mức vay', get: (r) => r.mucVay, numFmt: '#,##0' },
  { header: 'Tổng giải ngân', get: (r) => r.tongGiaiNgan, numFmt: '#,##0' },
  { header: 'Dư nợ trong hạn', get: (r) => r.duNoTrongHan, numFmt: '#,##0' },
  { header: 'Dư nợ quá hạn', get: (r) => r.duNoQuaHan, numFmt: '#,##0' },
  { header: 'Dư nợ khoanh', get: (r) => r.duNoKhoanh, numFmt: '#,##0' },
  { header: 'Tổng dư nợ', get: (r) => r.tongDuNo, numFmt: '#,##0' },
  { header: 'Gốc đã trả', get: (r) => r.gocDaTra, numFmt: '#,##0' },
  { header: 'Lãi tồn trong hạn', get: (r) => r.laiTonTH, numFmt: '#,##0' },
  { header: 'Lãi tồn quá hạn', get: (r) => r.laiTonQH, numFmt: '#,##0' },
  { header: 'Thu lãi TH trong tháng', get: (r) => r.thuLaiTHThang, numFmt: '#,##0' },
  { header: 'Thu lãi QH trong tháng', get: (r) => r.thuLaiQHThang, numFmt: '#,##0' },
  { header: 'Giải ngân trong tháng', get: (r) => r.giaiNganTrongThang, numFmt: '#,##0' },
  { header: 'Thu nợ TH trong tháng', get: (r) => r.thuNoTHThang, numFmt: '#,##0' },
  { header: 'Thu nợ QH trong tháng', get: (r) => r.thuNoQHThang, numFmt: '#,##0' },
  { header: 'Ngày giao dịch gần nhất', get: (r) => fmtDate(r.ngayGiaoDichGanNhat) },
];

/** Tạo sheet "Tóm tắt KPI" dạng key/value */
function buildKpiSheet(
  kpi: PortfolioKpi,
  pageTitle: string,
  subtitle: string | undefined
): XLSX.WorkSheet {
  const generated = new Date();
  const rows: (string | number)[][] = [
    [pageTitle],
    subtitle ? [subtitle] : [''],
    [`Ngày xuất báo cáo: ${fmtDate(generated)} ${String(generated.getHours()).padStart(2, '0')}:${String(generated.getMinutes()).padStart(2, '0')}`],
    [''],
    ['Chỉ tiêu', 'Giá trị', 'Giá trị định dạng'],
    ['Số khế ước', kpi.soKheUoc, fmtNumber(kpi.soKheUoc)],
    ['Số khách hàng', kpi.soKhachHang, fmtNumber(kpi.soKhachHang)],
    ['Tổng dư nợ (đ)', kpi.tongDuNo, fmtCurrency(kpi.tongDuNo)],
    ['Tổng giải ngân (đ)', kpi.tongGiaiNgan, fmtCurrency(kpi.tongGiaiNgan)],
    ['Dư nợ quá hạn (đ)', kpi.duNoQuaHan, fmtCurrency(kpi.duNoQuaHan)],
    ['Tỷ lệ nợ quá hạn (%)', kpi.tyLeNoQuaHan, fmtPercent(kpi.tyLeNoQuaHan)],
    ['Dư nợ khoanh (đ)', kpi.duNoKhoanh, fmtCurrency(kpi.duNoKhoanh)],
    ['Lãi tồn trong hạn (đ)', kpi.laiTonTH, fmtCurrency(kpi.laiTonTH)],
    ['Thu lãi TH trong tháng (đ)', kpi.thuLaiTHThang, fmtCurrency(kpi.thuLaiTHThang)],
    ['Lãi suất bình quân (%/năm)', kpi.laiSuatBQ, fmtPercent(kpi.laiSuatBQ)],
    ['Mức vay bình quân (đ)', kpi.mucVayBQ, fmtCurrency(kpi.mucVayBQ)],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 28 }];
  // Gộp ô tiêu đề
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
  ];
  return ws;
}

/** Tạo sheet "Chi tiết khế ước" từ danh sách LoanRecord */
function buildDetailSheet(rows: LoanRecord[]): XLSX.WorkSheet {
  const headers = LOAN_COLUMNS.map((c) => c.header);
  const aoa: (string | number)[][] = [headers];
  for (const r of rows) {
    aoa.push(LOAN_COLUMNS.map((c) => c.get(r)));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Áp mã định dạng số cho các cột có numFmt
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let col = 0; col < LOAN_COLUMNS.length; col++) {
    const fmt = LOAN_COLUMNS[col].numFmt;
    if (!fmt) continue;
    for (let rowIdx = 1; rowIdx <= range.e.r; rowIdx++) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: col });
      const cell = ws[addr];
      if (cell && cell.t === 'n') cell.z = fmt;
    }
  }

  // Độ rộng cột tự ước tính
  ws['!cols'] = LOAN_COLUMNS.map((c) => ({
    wch: Math.min(Math.max(c.header.length + 2, 12), 32),
  }));
  return ws;
}

/** Xuất workbook XLSX và kích hoạt tải xuống trình duyệt */
export async function exportToXlsx(input: XlsxExportInput): Promise<void> {
  const { rows, kpi, pageTitle, subtitle, extraSheets, filename } = input;
  const wb = XLSX.utils.book_new();

  // 1) Sheet tóm tắt KPI
  XLSX.utils.book_append_sheet(
    wb,
    buildKpiSheet(kpi, pageTitle, subtitle),
    safeSheetName('Tóm tắt KPI')
  );

  // 2) Sheet chi tiết khế ước
  XLSX.utils.book_append_sheet(
    wb,
    buildDetailSheet(rows),
    safeSheetName('Chi tiết khế ước')
  );

  // 3) Các sheet bổ sung
  if (extraSheets?.length) {
    const seen = new Set<string>(['Tóm tắt KPI', 'Chi tiết khế ước']);
    for (const s of extraSheets) {
      if (!s.rows.length) continue;
      let name = safeSheetName(s.name);
      // Đảm bảo tên duy nhất
      let i = 2;
      while (seen.has(name)) {
        name = safeSheetName(`${s.name} (${i++})`);
      }
      seen.add(name);
      const ws = XLSX.utils.json_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, name);
    }
  }

  const out = filename ?? defaultFilename(pageTitle, 'xlsx');
  XLSX.writeFile(wb, out);
}

// ─── Xuất riêng bảng "Khách hàng ngừng giao dịch" ─────────────────────────

export interface DormantXlsxInput {
  /** Danh sách khách hàng đã được lọc theo khoảng tháng đang chọn */
  customers: DormantCustomer[];
  /** Nhãn khoảng thời gian hiện tại (vd "2 – 3 tháng", "≥ 12 tháng") */
  bucketLabel: string;
  /** Ngày chốt số liệu (ngaySoLieu), dùng cho phụ đề */
  referenceDate: Date | null;
  /** Tổng số khế ước của bộ lọc cha (Tổng quan), để hiển thị bối cảnh */
  totalFilteredRows?: number;
  /** Tên tệp tùy chỉnh, mặc định tự sinh theo bucket + thời điểm */
  filename?: string;
}

const DORMANT_COLUMNS: {
  header: string;
  get: (d: DormantCustomer) => string | number;
  numFmt?: string;
}[] = [
  { header: 'Mã khách hàng', get: (d) => d.maKH },
  { header: 'Tên khách hàng', get: (d) => d.tenKH },
  { header: 'Phòng giao dịch', get: (d) => d.tenPGD },
  { header: 'Đơn vị ủy thác', get: (d) => d.tenDVUT },
  { header: 'Chương trình tín dụng', get: (d) => d.tenChuongTrinh },
  { header: 'Số khế ước', get: (d) => d.soKheUoc, numFmt: '#,##0' },
  { header: 'Tổng dư nợ (đ)', get: (d) => d.tongDuNo, numFmt: '#,##0' },
  { header: 'Lãi tồn (đ)', get: (d) => d.laiTon, numFmt: '#,##0' },
  {
    header: 'Hoạt động cuối',
    get: (d) => fmtDate(d.ngayHoatDongCuoi),
  },
  { header: 'Số ngày không giao dịch', get: (d) => d.daysSince, numFmt: '#,##0' },
];

export async function exportDormantToXlsx(input: DormantXlsxInput): Promise<void> {
  const { customers, bucketLabel, referenceDate, totalFilteredRows, filename } = input;
  const wb = XLSX.utils.book_new();

  // 1) Sheet bối cảnh: nhắc lại bộ lọc đang áp
  const generated = new Date();
  const ctx: (string | number)[][] = [
    ['Khách hàng ngừng giao dịch'],
    [`Khoảng thời gian: ${bucketLabel}`],
    [`Ngày chốt số liệu: ${fmtDate(referenceDate)}`],
    typeof totalFilteredRows === 'number'
      ? [`Phạm vi bộ lọc Tổng quan: ${fmtNumber(totalFilteredRows)} khế ước`]
      : [''],
    [`Tổng số khách hàng: ${fmtNumber(customers.length)}`],
    [
      `Ngày xuất báo cáo: ${fmtDate(generated)} ${String(generated.getHours()).padStart(2, '0')}:${String(generated.getMinutes()).padStart(2, '0')}`,
    ],
  ];
  const ctxWs = XLSX.utils.aoa_to_sheet(ctx);
  ctxWs['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ctxWs, safeSheetName('Bối cảnh'));

  // 2) Sheet dữ liệu chính
  const headers = DORMANT_COLUMNS.map((c) => c.header);
  const aoa: (string | number)[][] = [headers];
  for (const d of customers) {
    aoa.push(DORMANT_COLUMNS.map((c) => c.get(d)));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Áp định dạng số cho các cột số
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let col = 0; col < DORMANT_COLUMNS.length; col++) {
    const fmt = DORMANT_COLUMNS[col].numFmt;
    if (!fmt) continue;
    for (let rowIdx = 1; rowIdx <= range.e.r; rowIdx++) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: col });
      const cell = ws[addr];
      if (cell && cell.t === 'n') cell.z = fmt;
    }
  }

  ws['!cols'] = DORMANT_COLUMNS.map((c) => ({
    wch: Math.min(Math.max(c.header.length + 2, 14), 36),
  }));

  XLSX.utils.book_append_sheet(wb, ws, safeSheetName('Khách hàng ngừng giao dịch'));

  const out = filename ?? defaultFilename(`Khach hang ngung giao dich ${bucketLabel}`, 'xlsx');
  XLSX.writeFile(wb, out);
}
