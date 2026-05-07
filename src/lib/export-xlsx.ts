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

// ─── Xuất danh sách NPL / Khoanh ──────────────────────────────────────────

export type BadDebtKind = 'qh' | 'khoanh' | 'chuyenNQHThang' | 'dueSoonDormantThang' | 'dueSoonDormantQuy';

export interface BadDebtXlsxInput {
  /** Loại báo cáo: 'qh' = quá hạn (NPL), 'khoanh' = dư nợ khoanh */
  kind: BadDebtKind;
  /** Danh sách khế ước thuộc diện xuất (đã được lọc bởi bộ lọc cha) */
  loans: LoanRecord[];
  /** Ngày chốt số liệu cho phần bối cảnh */
  referenceDate: Date | null;
  /** Tổng số khế ước của bộ lọc cha, để hiển thị bối cảnh */
  totalFilteredRows?: number;
  /** Tên tệp tùy chỉnh */
  filename?: string;
}

const BAD_DEBT_COLUMNS: {
  header: string;
  get: (r: LoanRecord) => string | number;
  numFmt?: string;
}[] = [
  { header: 'Mã chi nhánh', get: (r) => r.maCN },
  { header: 'Tên PGD', get: (r) => r.tenPGD },
  { header: 'Tên xã', get: (r) => r.tenXa },
  { header: 'Tên thôn', get: (r) => r.tenThon },
  { header: 'Tổ TK&VV', get: (r) => r.tenTo },
  { header: 'Đơn vị ủy thác', get: (r) => r.tenDVUT },
  { header: 'Mã KH', get: (r) => r.maKH },
  { header: 'Tên KH', get: (r) => r.tenKH },
  { header: 'Phân loại', get: (r) => r.phanLoai },
  { header: 'Số CMND', get: (r) => r.soCMND },
  { header: 'Số điện thoại', get: (r) => r.soDienThoai },
  { header: 'Địa chỉ', get: (r) => r.diaChi },
  { header: 'Số khế ước', get: (r) => r.soKheUoc },
  { header: 'Chương trình tín dụng', get: (r) => r.tenChuongTrinh },
  { header: 'Nguồn vốn', get: (r) => r.nguonVon },
  { header: 'Ngày vay', get: (r) => fmtDate(r.ngayVay) },
  { header: 'Ngày chuyển NQH (GDXA)', get: (r) => fmtDate(r.ngayDHGDXA) },
  { header: 'Thời hạn vay (tháng)', get: (r) => r.thoiHanVay, numFmt: '#,##0' },
  { header: 'Lãi suất (%/năm)', get: (r) => r.laiSuat, numFmt: '#,##0.00' },
  { header: 'Mức vay (đ)', get: (r) => r.mucVay, numFmt: '#,##0' },
  { header: 'Tổng dư nợ (đ)', get: (r) => r.tongDuNo, numFmt: '#,##0' },
  { header: 'Dư nợ trong hạn (đ)', get: (r) => r.duNoTrongHan, numFmt: '#,##0' },
  { header: 'Dư nợ quá hạn (đ)', get: (r) => r.duNoQuaHan, numFmt: '#,##0' },
  { header: 'Dư nợ khoanh (đ)', get: (r) => r.duNoKhoanh, numFmt: '#,##0' },
  { header: 'Lãi tồn trong hạn (đ)', get: (r) => r.laiTonTH, numFmt: '#,##0' },
  { header: 'Lãi tồn quá hạn (đ)', get: (r) => r.laiTonQH, numFmt: '#,##0' },
  { header: 'Lãi DT chưa đến hạn (đ)', get: (r) => r.laiDTChuaDenHan, numFmt: '#,##0' },
  { header: 'Ngày hết hạn khoanh', get: (r) => fmtDate(r.ngayHetHanKhoanh) },
  { header: 'Ngày giao dịch gần nhất', get: (r) => fmtDate(r.ngayGiaoDichGanNhat) },
];

export async function exportBadDebtToXlsx(input: BadDebtXlsxInput): Promise<void> {
  const { kind, loans, referenceDate, totalFilteredRows, filename } = input;
  const wb = XLSX.utils.book_new();

  const sumField =
    kind === 'khoanh' ? 'duNoKhoanh' : 'duNoQuaHan';
  const label =
    kind === 'qh'
      ? 'Dư nợ quá hạn (NPL)'
      : kind === 'khoanh'
        ? 'Dư nợ khoanh'
        : kind === 'chuyenNQHThang'
          ? 'Danh sách chuyển NQH trong tháng'
          : kind === 'dueSoonDormantThang'
            ? 'Cảnh báo sớm: Sắp đến hạn (tháng) — KH ngừng GD > 90 ngày'
            : 'Cảnh báo sớm: Sắp đến hạn (quý) — KH ngừng GD > 90 ngày';
  const sortByDH = (a: LoanRecord, b: LoanRecord) =>
    (a.ngayDHGDXA?.getTime() ?? 0) - (b.ngayDHGDXA?.getTime() ?? 0);
  const sortedLoans =
    kind === 'chuyenNQHThang' ||
    kind === 'dueSoonDormantThang' ||
    kind === 'dueSoonDormantQuy'
      ? [...loans].sort(sortByDH)
      : [...loans].sort((a, b) => b[sumField] - a[sumField]);

  const totalAmount = sortedLoans.reduce((s, r) => s + r[sumField], 0);
  const khUnique = new Set(sortedLoans.map((r) => r.maKH).filter(Boolean)).size;

  const generated = new Date();
  const ctx: (string | number)[][] = [
    [label],
    [`Ngày chốt số liệu: ${fmtDate(referenceDate)}`],
    typeof totalFilteredRows === 'number'
      ? [`Phạm vi bộ lọc: ${fmtNumber(totalFilteredRows)} khế ước`]
      : [''],
    [`Số khế ước trong báo cáo: ${fmtNumber(sortedLoans.length)}`],
    [`Số khách hàng liên quan: ${fmtNumber(khUnique)}`],
    [
      `Tổng ${
        kind === 'khoanh'
          ? 'dư nợ khoanh'
          : kind === 'dueSoonDormantThang' || kind === 'dueSoonDormantQuy'
            ? 'dư nợ (sẽ chuyển NQH)'
            : 'dư nợ quá hạn'
      }: ${fmtCurrency(
        kind === 'dueSoonDormantThang' || kind === 'dueSoonDormantQuy'
          ? sortedLoans.reduce((s, r) => s + r.tongDuNo, 0)
          : totalAmount,
      )}`,
    ],
    [
      `Ngày xuất báo cáo: ${fmtDate(generated)} ${String(generated.getHours()).padStart(2, '0')}:${String(generated.getMinutes()).padStart(2, '0')}`,
    ],
    [''],
    ['Ghi chú:'],
    [
      kind === 'qh'
        ? 'Danh sách được sắp xếp giảm dần theo "Dư nợ quá hạn". "Ngày chuyển NQH" lấy từ "Ngày ĐH theo GDXA".'
        : kind === 'khoanh'
          ? 'Danh sách được sắp xếp giảm dần theo "Dư nợ khoanh". "Ngày chuyển NQH" lấy từ "Ngày ĐH theo GDXA".'
          : kind === 'chuyenNQHThang'
            ? 'Khế ước có "Ngày ĐH theo GDXA" rơi vào tháng của ngày chốt số liệu và "Tình trạng món vay" = OPEN. Sắp xếp tăng dần theo "Ngày ĐH theo GDXA".'
            : `Khế ước có "Ngày ĐH theo GDXA" trong ${kind === 'dueSoonDormantThang' ? 'tháng' : 'quý'} hiện tại (sau ngày chốt, OPEN) MÀ KH đã ngừng giao dịch > 90 ngày. Sắp xếp tăng dần theo "Ngày ĐH theo GDXA".`,
    ],
  ];
  const ctxWs = XLSX.utils.aoa_to_sheet(ctx);
  ctxWs['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ctxWs, safeSheetName('Bối cảnh'));

  // Sheet dữ liệu
  const headers = ['STT', ...BAD_DEBT_COLUMNS.map((c) => c.header)];
  const aoa: (string | number)[][] = [headers];
  sortedLoans.forEach((r, i) => {
    aoa.push([i + 1, ...BAD_DEBT_COLUMNS.map((c) => c.get(r))]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Áp định dạng số
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let col = 0; col < BAD_DEBT_COLUMNS.length; col++) {
    const fmt = BAD_DEBT_COLUMNS[col].numFmt;
    if (!fmt) continue;
    // +1 để bỏ qua cột STT
    const c = col + 1;
    for (let rowIdx = 1; rowIdx <= range.e.r; rowIdx++) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
      const cell = ws[addr];
      if (cell && cell.t === 'n') cell.z = fmt;
    }
  }

  ws['!cols'] = [
    { wch: 6 },
    ...BAD_DEBT_COLUMNS.map((c) => ({
      wch: Math.min(Math.max(c.header.length + 2, 14), 40),
    })),
  ];
  const sheetName = safeSheetName(
    kind === 'qh'
      ? 'Danh sách NPL'
      : kind === 'khoanh'
        ? 'Danh sách khoanh'
        : kind === 'chuyenNQHThang'
          ? 'Chuyển NQH trong tháng'
          : kind === 'dueSoonDormantThang'
            ? 'Cảnh báo sớm (tháng)'
            : 'Cảnh báo sớm (quý)'
  );
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const out = filename ?? defaultFilename(label, 'xlsx');
  XLSX.writeFile(wb, out);
}

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

// ─── So sánh hiệu quả cán bộ (period) ──────────────────────────────────────

export interface StaffComparisonXlsxRow {
  maNV: string;
  tenNV: string;
  dgdCount: number;
  thonCount: number;
  prevLoans: number;
  currLoans: number;
  prevCustomers: number;
  currCustomers: number;
  prevTongDuNo: number;
  currTongDuNo: number;
  deltaTongDuNo: number;
  pctTongDuNo: number | null;
  prevDuNoQH: number;
  currDuNoQH: number;
  prevTyLeNQH: number;
  currTyLeNQH: number;
  deltaTyLeNQH: number;
  rollRate: number;
  newLoans: number;
  closedLoans: number;
}

export interface StaffComparisonXlsxInput {
  rows: StaffComparisonXlsxRow[];
  /** Hai dòng tổng hợp đặc biệt (Chưa gán / Nhiều cán bộ) — không kèm Mã/Tên NV */
  summaryRows?: { label: string; data: Omit<StaffComparisonXlsxRow, 'maNV' | 'tenNV' | 'dgdCount' | 'thonCount'> }[];
  prevDate: Date | null;
  currDate: Date | null;
  filename?: string;
}

const STAFF_COMPARE_COLUMNS: {
  header: string;
  get: (r: StaffComparisonXlsxRow) => string | number;
  numFmt?: string;
}[] = [
  { header: 'Mã NV', get: (r) => r.maNV },
  { header: 'Tên NV', get: (r) => r.tenNV },
  { header: 'Số ĐGD phụ trách', get: (r) => r.dgdCount, numFmt: '#,##0' },
  { header: 'Số thôn phụ trách', get: (r) => r.thonCount, numFmt: '#,##0' },
  { header: 'Khế ước kỳ trước', get: (r) => r.prevLoans, numFmt: '#,##0' },
  { header: 'Khế ước kỳ sau', get: (r) => r.currLoans, numFmt: '#,##0' },
  { header: 'Khách hàng kỳ trước', get: (r) => r.prevCustomers, numFmt: '#,##0' },
  { header: 'Khách hàng kỳ sau', get: (r) => r.currCustomers, numFmt: '#,##0' },
  { header: 'Tổng dư nợ kỳ trước (đ)', get: (r) => r.prevTongDuNo, numFmt: '#,##0' },
  { header: 'Tổng dư nợ kỳ sau (đ)', get: (r) => r.currTongDuNo, numFmt: '#,##0' },
  { header: 'Δ Tổng dư nợ (đ)', get: (r) => r.deltaTongDuNo, numFmt: '#,##0' },
  // Excel '0.00%' format kỳ vọng giá trị dạng phân số (0.0234 → 2,34%).
  // Trong app các tỷ lệ lưu dạng phần trăm (2.34) → chia 100 khi xuất.
  {
    header: '% Δ Tổng dư nợ',
    get: (r) => (r.pctTongDuNo == null ? '' : r.pctTongDuNo / 100),
    numFmt: '0.00%',
  },
  { header: 'Dư nợ NQH kỳ trước (đ)', get: (r) => r.prevDuNoQH, numFmt: '#,##0' },
  { header: 'Dư nợ NQH kỳ sau (đ)', get: (r) => r.currDuNoQH, numFmt: '#,##0' },
  { header: 'Tỷ lệ NQH kỳ trước', get: (r) => r.prevTyLeNQH / 100, numFmt: '0.00%' },
  { header: 'Tỷ lệ NQH kỳ sau', get: (r) => r.currTyLeNQH / 100, numFmt: '0.00%' },
  { header: 'Δ Tỷ lệ NQH (điểm %)', get: (r) => r.deltaTyLeNQH / 100, numFmt: '0.00%' },
  { header: 'Roll rate kỳ sau', get: (r) => r.rollRate / 100, numFmt: '0.00%' },
  { header: 'Khế ước mới', get: (r) => r.newLoans, numFmt: '#,##0' },
  { header: 'Khế ước đã đóng', get: (r) => r.closedLoans, numFmt: '#,##0' },
];

export async function exportStaffComparisonToXlsx(
  input: StaffComparisonXlsxInput
): Promise<void> {
  const { rows, summaryRows, prevDate, currDate, filename } = input;
  const wb = XLSX.utils.book_new();

  // Sheet bối cảnh
  const generated = new Date();
  const ctx: (string | number)[][] = [
    ['So sánh hiệu quả cán bộ — So sánh giữa hai kỳ'],
    [`Kỳ trước: ${fmtDate(prevDate)}`],
    [`Kỳ sau: ${fmtDate(currDate)}`],
    [`Số cán bộ trong báo cáo: ${fmtNumber(rows.length)}`],
    [
      `Ngày xuất báo cáo: ${fmtDate(generated)} ${String(generated.getHours()).padStart(2, '0')}:${String(generated.getMinutes()).padStart(2, '0')}`,
    ],
    [''],
    ['Ghi chú:'],
    [
      'Phạm vi mỗi cán bộ = hợp các Mã thôn của các Điểm giao dịch họ phụ trách.',
    ],
    [
      'Khế ước thuộc thôn không có cán bộ duy nhất được gom vào hai dòng tổng hợp ở cuối: "(Chưa gán cán bộ)" và "(Nhiều cán bộ phụ trách)".',
    ],
    [
      'Roll rate = (Σ duNoQuaHan kỳ sau của khế ước Trong hạn ở kỳ trước) / (Σ duNoTrongHan kỳ trước).',
    ],
  ];
  const ctxWs = XLSX.utils.aoa_to_sheet(ctx);
  ctxWs['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, ctxWs, safeSheetName('Bối cảnh'));

  // Sheet bảng xếp hạng
  const headers = ['STT', ...STAFF_COMPARE_COLUMNS.map((c) => c.header)];
  const aoa: (string | number)[][] = [headers];
  rows.forEach((r, i) => {
    aoa.push([i + 1, ...STAFF_COMPARE_COLUMNS.map((c) => c.get(r))]);
  });
  // Append summary rows (no STT)
  if (summaryRows && summaryRows.length > 0) {
    aoa.push(['']); // dòng trống ngăn cách
    for (const sr of summaryRows) {
      const row: StaffComparisonXlsxRow = {
        maNV: '',
        tenNV: sr.label,
        dgdCount: 0,
        thonCount: 0,
        ...sr.data,
      };
      aoa.push(['', ...STAFF_COMPARE_COLUMNS.map((c) => c.get(row))]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Áp định dạng số
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let col = 0; col < STAFF_COMPARE_COLUMNS.length; col++) {
    const fmt = STAFF_COMPARE_COLUMNS[col].numFmt;
    if (!fmt) continue;
    const c = col + 1; // bỏ qua cột STT
    for (let rowIdx = 1; rowIdx <= range.e.r; rowIdx++) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
      const cell = ws[addr];
      if (cell && cell.t === 'n') cell.z = fmt;
    }
  }

  ws['!cols'] = [
    { wch: 6 },
    ...STAFF_COMPARE_COLUMNS.map((c) => ({
      wch: Math.min(Math.max(c.header.length + 2, 14), 28),
    })),
  ];
  ws['!freeze'] = { xSplit: 3, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName('Cán bộ — So sánh kỳ'));

  const out = filename ?? defaultFilename('So sanh hieu qua can bo', 'xlsx');
  XLSX.writeFile(wb, out);
}

// ─── So sánh hiệu quả ĐGD (period) ─────────────────────────────────────

export interface PointComparisonXlsxRow {
  maDGD: string;
  tenDGD: string;
  thonCount: number;
  prevLoans: number;
  currLoans: number;
  prevCustomers: number;
  currCustomers: number;
  prevTongDuNo: number;
  currTongDuNo: number;
  deltaTongDuNo: number;
  pctTongDuNo: number | null;
  prevDuNoQH: number;
  currDuNoQH: number;
  prevTyLeNQH: number;
  currTyLeNQH: number;
  deltaTyLeNQH: number;
  rollRate: number;
  newLoans: number;
  closedLoans: number;
}

export interface PointComparisonXlsxInput {
  rows: PointComparisonXlsxRow[];
  summaryRows?: { label: string; data: Omit<PointComparisonXlsxRow, 'maDGD' | 'tenDGD' | 'thonCount'> }[];
  prevDate: Date | null;
  currDate: Date | null;
  filename?: string;
}

const POINT_COMPARE_COLUMNS: {
  header: string;
  get: (r: PointComparisonXlsxRow) => string | number;
  numFmt?: string;
}[] = [
  { header: 'Mã ĐGD', get: (r) => r.maDGD },
  { header: 'Tên ĐGD', get: (r) => r.tenDGD },
  { header: 'Số thôn phụ trách', get: (r) => r.thonCount, numFmt: '#,##0' },
  { header: 'Khế ước kỳ trước', get: (r) => r.prevLoans, numFmt: '#,##0' },
  { header: 'Khế ước kỳ sau', get: (r) => r.currLoans, numFmt: '#,##0' },
  { header: 'Khách hàng kỳ trước', get: (r) => r.prevCustomers, numFmt: '#,##0' },
  { header: 'Khách hàng kỳ sau', get: (r) => r.currCustomers, numFmt: '#,##0' },
  { header: 'Tổng dư nợ kỳ trước (đ)', get: (r) => r.prevTongDuNo, numFmt: '#,##0' },
  { header: 'Tổng dư nợ kỳ sau (đ)', get: (r) => r.currTongDuNo, numFmt: '#,##0' },
  { header: 'Δ Tổng dư nợ (đ)', get: (r) => r.deltaTongDuNo, numFmt: '#,##0' },
  {
    header: '% Δ Tổng dư nợ',
    get: (r) => (r.pctTongDuNo == null ? '' : r.pctTongDuNo / 100),
    numFmt: '0.00%',
  },
  { header: 'Dư nợ NQH kỳ trước (đ)', get: (r) => r.prevDuNoQH, numFmt: '#,##0' },
  { header: 'Dư nợ NQH kỳ sau (đ)', get: (r) => r.currDuNoQH, numFmt: '#,##0' },
  { header: 'Tỷ lệ NQH kỳ trước', get: (r) => r.prevTyLeNQH / 100, numFmt: '0.00%' },
  { header: 'Tỷ lệ NQH kỳ sau', get: (r) => r.currTyLeNQH / 100, numFmt: '0.00%' },
  { header: 'Δ Tỷ lệ NQH (điểm %)', get: (r) => r.deltaTyLeNQH / 100, numFmt: '0.00%' },
  { header: 'Roll rate kỳ sau', get: (r) => r.rollRate / 100, numFmt: '0.00%' },
  { header: 'Khế ước mới', get: (r) => r.newLoans, numFmt: '#,##0' },
  { header: 'Khế ước đã đóng', get: (r) => r.closedLoans, numFmt: '#,##0' },
];

export async function exportPointComparisonToXlsx(
  input: PointComparisonXlsxInput
): Promise<void> {
  const { rows, summaryRows, prevDate, currDate, filename } = input;
  const wb = XLSX.utils.book_new();

  const generated = new Date();
  const ctx: (string | number)[][] = [
    ['So sánh hiệu quả ĐGD — So sánh giữa hai kỳ'],
    [`Kỳ trước: ${fmtDate(prevDate)}`],
    [`Kỳ sau: ${fmtDate(currDate)}`],
    [`Số ĐGD trong báo cáo: ${fmtNumber(rows.length)}`],
    [
      `Ngày xuất báo cáo: ${fmtDate(generated)} ${String(generated.getHours()).padStart(2, '0')}:${String(generated.getMinutes()).padStart(2, '0')}`,
    ],
    [''],
    ['Ghi chú:'],
    ['Phạm vi mỗi ĐGD = các Mã thôn được gán trong danh mục Điểm giao dịch.'],
    [
      'Khế ước thuộc thôn không có ĐGD duy nhất được gom vào hai dòng tổng hợp ở cuối: "(Chưa gán ĐGD)" và "(Nhiều ĐGD)".',
    ],
    [
      'Roll rate = (Σ duNoQuaHan kỳ sau của khế ước Trong hạn ở kỳ trước) / (Σ duNoTrongHan kỳ trước).',
    ],
  ];
  const ctxWs = XLSX.utils.aoa_to_sheet(ctx);
  ctxWs['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, ctxWs, safeSheetName('Bối cảnh'));

  const headers = ['STT', ...POINT_COMPARE_COLUMNS.map((c) => c.header)];
  const aoa: (string | number)[][] = [headers];
  rows.forEach((r, i) => {
    aoa.push([i + 1, ...POINT_COMPARE_COLUMNS.map((c) => c.get(r))]);
  });
  if (summaryRows && summaryRows.length > 0) {
    aoa.push(['']);
    for (const sr of summaryRows) {
      const row: PointComparisonXlsxRow = {
        maDGD: '',
        tenDGD: sr.label,
        thonCount: 0,
        ...sr.data,
      };
      aoa.push(['', ...POINT_COMPARE_COLUMNS.map((c) => c.get(row))]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let col = 0; col < POINT_COMPARE_COLUMNS.length; col++) {
    const fmt = POINT_COMPARE_COLUMNS[col].numFmt;
    if (!fmt) continue;
    const c = col + 1;
    for (let rowIdx = 1; rowIdx <= range.e.r; rowIdx++) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
      const cell = ws[addr];
      if (cell && cell.t === 'n') cell.z = fmt;
    }
  }

  ws['!cols'] = [
    { wch: 6 },
    ...POINT_COMPARE_COLUMNS.map((c) => ({
      wch: Math.min(Math.max(c.header.length + 2, 14), 28),
    })),
  ];
  ws['!freeze'] = { xSplit: 3, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName('ĐGD — So sánh kỳ'));

  const out = filename ?? defaultFilename('So sanh hieu qua DGD', 'xlsx');
  XLSX.writeFile(wb, out);
}

// ─── Báo cáo so sánh — bảng KPI nhiều đối tượng (snapshot) ─────────────

export interface CompareXlsxKpiRow {
  key: string;
  label: string;
  pick: (kpi: PortfolioKpi) => number;
}

export interface CompareXlsxInput {
  dimensionLabel: string;
  groups: { label: string; kpi: PortfolioKpi }[];
  kpiRows: CompareXlsxKpiRow[];
  referenceDate: Date | null;
  contextLine?: string;
  filename?: string;
}

export async function exportCompareToXlsx(input: CompareXlsxInput): Promise<void> {
  const { dimensionLabel, groups, kpiRows, referenceDate, contextLine, filename } = input;
  const wb = XLSX.utils.book_new();

  const generated = new Date();
  const ctx: (string | number)[][] = [
    ['Báo cáo so sánh — Phân tích một kỳ'],
    [`Ngày chốt số liệu: ${fmtDate(referenceDate)}`],
    contextLine ? [contextLine] : [`Tiêu chí so sánh: ${dimensionLabel}`],
    [`Số đối tượng: ${fmtNumber(groups.length)}`],
    [
      `Ngày xuất báo cáo: ${fmtDate(generated)} ${String(generated.getHours()).padStart(2, '0')}:${String(generated.getMinutes()).padStart(2, '0')}`,
    ],
  ];
  const ctxWs = XLSX.utils.aoa_to_sheet(ctx);
  ctxWs['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ctxWs, safeSheetName('Bối cảnh'));

  // Sheet bảng dọc: hàng = chỉ tiêu, cột = đối tượng. Các chỉ tiêu tỷ lệ
  // (tyLeNoQuaHan, laiSuatBQ) lưu dạng phần trăm (2.34) — chia 100 khi
  // xuất để Excel format '0.00%' hiển thị đúng.
  const headers: (string | number)[] = ['Chỉ tiêu', ...groups.map((g) => g.label)];
  const aoa: (string | number)[][] = [headers];
  for (const k of kpiRows) {
    const isPercent = k.key === 'tyLeNoQuaHan' || k.key === 'laiSuatBQ';
    aoa.push([
      k.label,
      ...groups.map((g) => {
        const v = k.pick(g.kpi);
        return isPercent ? v / 100 : v;
      }),
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Format các cột số: % cho NQH/laiSuat, còn lại là số nguyên có dấu phân cách.
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = 1; r <= range.e.r; r++) {
    const kpi = kpiRows[r - 1];
    if (!kpi) continue;
    const isPercent = kpi.key === 'tyLeNoQuaHan' || kpi.key === 'laiSuatBQ';
    for (let c = 1; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && cell.t === 'n') cell.z = isPercent ? '0.00%' : '#,##0';
    }
  }

  ws['!cols'] = [
    { wch: 28 },
    ...groups.map((g) => ({ wch: Math.min(Math.max(g.label.length + 2, 16), 32) })),
  ];
  ws['!freeze'] = { xSplit: 1, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(`So sánh — ${dimensionLabel}`));

  const out = filename ?? defaultFilename('Bao cao so sanh', 'xlsx');
  XLSX.writeFile(wb, out);
}

// ─── Báo cáo hiệu quả 1 kỳ — Cán bộ / ĐGD (snapshot) ──────────────────

export interface PerformanceXlsxRow {
  /** Mã NV hoặc Mã ĐGD */
  keyCode: string;
  /** Tên NV hoặc Tên ĐGD */
  keyLabel: string;
  /** Số ĐGD phụ trách (chỉ dùng cho cán bộ) */
  dgdCount: number;
  /** Số thôn (suy ra) */
  thonCount: number;

  soKheUoc: number;
  soKhachHang: number;
  tongDuNo: number;
  duNoTrongHan: number;
  duNoQuaHan: number;
  tyLeNQH: number;
  duNoKhoanh: number;
  tyLeKhoanh: number;
  mucVayBQ: number;
  laiTonTH: number;
}

export interface PerformanceXlsxInput {
  kind: 'staff' | 'point';
  rows: PerformanceXlsxRow[];
  summaryRows?: { label: string; data: Omit<PerformanceXlsxRow, 'keyCode' | 'keyLabel' | 'dgdCount' | 'thonCount'> }[];
  referenceDate: Date | null;
  filename?: string;
}

export async function exportPerformanceToXlsx(
  input: PerformanceXlsxInput
): Promise<void> {
  const { kind, rows, summaryRows, referenceDate, filename } = input;
  const isStaff = kind === 'staff';
  const wb = XLSX.utils.book_new();

  const codeHeader = isStaff ? 'Mã NV' : 'Mã ĐGD';
  const labelHeader = isStaff ? 'Tên NV' : 'Tên ĐGD';
  const reportLabel = isStaff
    ? 'Báo cáo hiệu quả cán bộ — Phân tích một kỳ'
    : 'Báo cáo hiệu quả Điểm giao dịch — Phân tích một kỳ';

  // Sheet bối cảnh
  const generated = new Date();
  const ctx: (string | number)[][] = [
    [reportLabel],
    [`Ngày chốt số liệu: ${fmtDate(referenceDate)}`],
    [`Số ${isStaff ? 'cán bộ' : 'ĐGD'} trong báo cáo: ${fmtNumber(rows.length)}`],
    [
      `Ngày xuất báo cáo: ${fmtDate(generated)} ${String(generated.getHours()).padStart(2, '0')}:${String(generated.getMinutes()).padStart(2, '0')}`,
    ],
    [''],
    ['Ghi chú:'],
    [
      isStaff
        ? 'Phạm vi mỗi cán bộ = hợp các Mã thôn của các Điểm giao dịch họ phụ trách.'
        : 'Phạm vi mỗi ĐGD = các Mã thôn được gán trong danh mục Điểm giao dịch.',
    ],
    [
      'Khế ước thuộc thôn không có chủ duy nhất được gom vào dòng tổng hợp ở cuối: "(Chưa gán)" và "(Trùng)".',
    ],
    ['NQH% = duNoQuaHan / tongDuNo. Mức vay BQ = tongDuNo / soKhachHang duy nhất.'],
  ];
  const ctxWs = XLSX.utils.aoa_to_sheet(ctx);
  ctxWs['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, ctxWs, safeSheetName('Bối cảnh'));

  const COLUMNS: { header: string; get: (r: PerformanceXlsxRow) => string | number; numFmt?: string }[] = [
    { header: codeHeader, get: (r) => r.keyCode },
    { header: labelHeader, get: (r) => r.keyLabel },
    ...(isStaff
      ? [{ header: 'Số ĐGD phụ trách', get: (r: PerformanceXlsxRow) => r.dgdCount, numFmt: '#,##0' }]
      : []),
    { header: 'Số thôn phụ trách', get: (r) => r.thonCount, numFmt: '#,##0' },
    { header: 'Số khế ước', get: (r) => r.soKheUoc, numFmt: '#,##0' },
    { header: 'Số khách hàng', get: (r) => r.soKhachHang, numFmt: '#,##0' },
    { header: 'Tổng dư nợ (đ)', get: (r) => r.tongDuNo, numFmt: '#,##0' },
    { header: 'Dư nợ trong hạn (đ)', get: (r) => r.duNoTrongHan, numFmt: '#,##0' },
    { header: 'Dư nợ NQH (đ)', get: (r) => r.duNoQuaHan, numFmt: '#,##0' },
    // tyLeNQH lưu dạng %; '0.00%' của Excel cần phân số → chia 100.
    { header: 'Tỷ lệ NQH', get: (r) => r.tyLeNQH / 100, numFmt: '0.00%' },
    { header: 'Dư nợ khoanh (đ)', get: (r) => r.duNoKhoanh, numFmt: '#,##0' },
    // tyLeKhoanh lưu dạng %; '0.00%' của Excel cần phân số → chia 100.
    { header: 'Tỷ lệ khoanh', get: (r) => r.tyLeKhoanh / 100, numFmt: '0.00%' },
    { header: 'Mức vay BQ (đ)', get: (r) => r.mucVayBQ, numFmt: '#,##0' },
    { header: 'Lãi tồn TH (đ)', get: (r) => r.laiTonTH, numFmt: '#,##0' },
  ];

  const headers = ['STT', ...COLUMNS.map((c) => c.header)];
  const aoa: (string | number)[][] = [headers];
  rows.forEach((r, i) => {
    aoa.push([i + 1, ...COLUMNS.map((c) => c.get(r))]);
  });
  if (summaryRows && summaryRows.length > 0) {
    aoa.push(['']);
    for (const sr of summaryRows) {
      const row: PerformanceXlsxRow = {
        keyCode: '',
        keyLabel: sr.label,
        dgdCount: 0,
        thonCount: 0,
        ...sr.data,
      };
      aoa.push(['', ...COLUMNS.map((c) => c.get(row))]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Số format
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let col = 0; col < COLUMNS.length; col++) {
    const fmt = COLUMNS[col].numFmt;
    if (!fmt) continue;
    const c = col + 1;
    for (let rowIdx = 1; rowIdx <= range.e.r; rowIdx++) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
      const cell = ws[addr];
      if (cell && cell.t === 'n') cell.z = fmt;
    }
  }

  ws['!cols'] = [
    { wch: 6 },
    ...COLUMNS.map((c) => ({
      wch: Math.min(Math.max(c.header.length + 2, 14), 30),
    })),
  ];
  ws['!freeze'] = { xSplit: 3, ySplit: 1 } as never;
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    safeSheetName(isStaff ? 'Cán bộ' : 'Điểm giao dịch')
  );

  const out =
    filename ??
    defaultFilename(
      isStaff ? 'Bao cao hieu qua can bo' : 'Bao cao hieu qua diem giao dich',
      'xlsx'
    );
  XLSX.writeFile(wb, out);
}
