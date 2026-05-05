/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import { parseVnDate, toNumber } from '../lib/format';
import type { LoanRecord, ImportResult } from '../lib/types';

type Row = (string | number | null)[];

function findHeaderRow(rows: Row[]): number {
  let bestIdx = 0;
  let bestCount = 0;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const c = rows[i].filter((v) => v !== null && v !== '').length;
    if (c > bestCount) {
      bestCount = c;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Chuẩn hóa tên cột: bỏ dấu tiếng Việt, gộp khoảng trắng, chuyển về chữ
// thường — để tra cứu cột dung thứ chút khác biệt về chính tả/khoảng trắng
// trong tiêu đề Excel (ví dụ "Ngày ĐH theo GDXA" vs "Ngày ĐH  theo gdxa").
function normKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildIndex(header: Row): Record<string, number> {
  const idx: Record<string, number> = {};
  const originals: string[] = [];
  header.forEach((h, i) => {
    if (h === null || h === undefined || h === '') return;
    const s = String(h).trim();
    idx[s] = i;
    // Đồng thời đăng ký key đã chuẩn hóa (có tiền tố để tránh va chạm).
    idx['__n:' + normKey(s)] = i;
    originals.push(s);
  });
  // Diagnostic: in ra danh sách cột để người dùng đối chiếu khi tiêu đề lạ.
  // eslint-disable-next-line no-console
  console.log('[parser] Excel columns detected:', originals);
  return idx;
}

function get(row: Row, idx: Record<string, number>, key: string): unknown {
  let i = idx[key];
  if (i === undefined) i = idx['__n:' + normKey(key)];
  return i === undefined ? null : row[i];
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * Chuẩn hóa giới tính. Báo cáo 31 mã hóa 01 = Nam, 02 = Nữ. Một số bản
 * xuất đã để sẵn "Nam"/"Nữ" hoặc "M"/"F" → nhận luôn. Giá trị trống giữ
 * nguyên để UI tự nhóm vào "—".
 */
function mapGioiTinh(v: string): string {
  const s = v.trim();
  if (!s) return '';
  const k = s.toLowerCase();
  if (k === '01' || k === '1' || k === 'nam' || k === 'm' || k === 'male') return 'Nam';
  if (k === '02' || k === '2' || k === 'nu' || k === 'nữ' || k === 'f' || k === 'female') return 'Nữ';
  return s;
}

function normalize(row: Row, idx: Record<string, number>): LoanRecord {
  const raw: Record<string, unknown> = {};
  for (const [key, i] of Object.entries(idx)) raw[key] = row[i];

  return {
    maCN: asString(get(row, idx, 'Mã CN')),
    maPGD: asString(get(row, idx, 'Mã PGD')),
    tenPGD: asString(get(row, idx, 'Tên PGD')),
    maXa: asString(get(row, idx, 'Mã xã')),
    tenXa: asString(get(row, idx, 'Tên xã')),
    maThon: asString(get(row, idx, 'Mã thôn')),
    tenThon: asString(get(row, idx, 'Tên thôn')),

    maKH: asString(get(row, idx, 'Mã KH')),
    tenKH: asString(get(row, idx, 'Tên KH')),
    ngaySinh: parseVnDate(get(row, idx, 'Ngày sinh')),
    phanLoai: asString(get(row, idx, 'Phân loại')),
    loaiKH: asString(get(row, idx, 'Loại KH')),
    gioiTinh: mapGioiTinh(asString(get(row, idx, 'Giới tính'))),
    maDanToc: asString(get(row, idx, 'Mã dân tộc')),
    tenDanToc: asString(get(row, idx, 'Tên DT')),
    soCMND: asString(get(row, idx, 'Số CMND')),
    diaChi: asString(get(row, idx, 'Địa chỉ')),
    soDienThoai: asString(get(row, idx, 'Số điện thoại')),

    maTo: asString(get(row, idx, 'Mã tổ')),
    loaiTo: asString(get(row, idx, 'Loại tổ')),
    tenTo: asString(get(row, idx, 'Tên tổ')),

    maDVUT: asString(get(row, idx, 'Mã ĐVUT')),
    tenDVUT: asString(get(row, idx, 'Tên ĐVUT')),

    soKheUoc: asString(get(row, idx, 'Số khế ước')),
    ngayVay: parseVnDate(get(row, idx, 'Ngày vay')),
    ngayDHHopDong: parseVnDate(get(row, idx, 'Ngày ĐH theo hợp đồng')),
    ngayDHGiaHan: parseVnDate(get(row, idx, 'Ngày ĐH theo Gia hạn')),
    ngayDHGDXA: parseVnDate(get(row, idx, 'Ngày ĐH theo GDXA')),
    thoiHanVay: toNumber(get(row, idx, 'Thời hạn vay')),
    laiSuat: toNumber(get(row, idx, 'Lãi suất')),
    hinhThucVay: asString(get(row, idx, 'Hình thức vay')),
    tinhTrangMonVay: asString(get(row, idx, 'Tình trạng món vay')),

    maChuongTrinh: asString(get(row, idx, 'Mã chương trình')),
    tenChuongTrinh: asString(get(row, idx, 'Tên chương trình')),
    maQuyetDinh: asString(get(row, idx, 'Mã Quyết định')),
    tenQuyetDinh: asString(get(row, idx, 'Tên Quyết định')),
    nguonVon: asString(get(row, idx, 'Nguồn vốn')),

    mucVay: toNumber(get(row, idx, 'Mức vay')),
    tongGiaiNgan: toNumber(get(row, idx, 'Tổng giải ngân')),
    duNoTrongHan: toNumber(get(row, idx, 'Dư nợ trong hạn')),
    duNoQuaHan: toNumber(get(row, idx, 'Dư nợ quá hạn')),
    duNoKhoanh: toNumber(get(row, idx, 'Dư nợ khoanh')),
    tongDuNo: toNumber(get(row, idx, 'Tổng dư nợ')),
    gocDaTra: toNumber(get(row, idx, 'Gốc đã trả')),
    soDuTienGui105: toNumber(get(row, idx, 'Số dư tiền gửi 105')),

    tongThuLaiTH: toNumber(get(row, idx, 'Tổng thu lãi TH')),
    laiTonTH: toNumber(get(row, idx, 'Lãi tồn TH')),
    tongThuLaiQH: toNumber(get(row, idx, 'Tổng thu lãi QH')),
    laiTonQH: toNumber(get(row, idx, 'Lãi tồn QH')),
    laiDTChuaDenHan: toNumber(get(row, idx, 'Lãi DT chưa đến hạn')),
    thuLaiTHThang: toNumber(get(row, idx, 'Thu lãi TH tháng')),
    thuLaiQHThang: toNumber(get(row, idx, 'Thu lãi QH Tháng')),

    giaiNganTrongThang: toNumber(get(row, idx, 'Giải ngân trong tháng')),
    thuNoTHThang: toNumber(get(row, idx, 'Thu nợ TH tháng')),
    thuNoQHThang: toNumber(get(row, idx, 'Thu nợ QH tháng')),

    // Biến động NPL — tháng / quý / năm (Báo cáo 31)
    chuyenQHThang: toNumber(get(row, idx, 'Chuyển QH trong tháng')),
    chuyenKhoanhThang: toNumber(get(row, idx, 'Chuyển khoanh trong tháng')),
    thuNoKhoanhThang: toNumber(get(row, idx, 'Thu nợ khoanh tháng')),
    gocXoaThang: toNumber(get(row, idx, 'Gốc xóa trong tháng')),
    chuyenQHQuy: toNumber(get(row, idx, 'CQH trong Quý')),
    chuyenKhoanhQuy: toNumber(get(row, idx, 'Chuyển Khoanh Quý')),
    thuNoQHQuy: toNumber(get(row, idx, 'Thu nợ QH Quý')),
    thuNoKhoanhQuy: toNumber(get(row, idx, 'Thu nợ Khoanh Quý')),
    gocXoaQuy: toNumber(get(row, idx, 'Gốc xóa trong Quý')),
    chuyenQHNam: toNumber(get(row, idx, 'CQH Năm')),
    chuyenKhoanhNam: toNumber(get(row, idx, 'Chuyển Khoanh Năm')),
    thuNoQHNam: toNumber(get(row, idx, 'Thu nợ QH Năm')),
    thuNoKhoanhNam: toNumber(get(row, idx, 'Thu nợ Khoanh Năm')),
    gocXoaNam: toNumber(get(row, idx, 'Xóa trong Năm')),

    ngayGiaoDichGanNhat: parseVnDate(get(row, idx, 'Ngày giao dịch gần nhất')),
    ngaySoLieu: parseVnDate(get(row, idx, 'Ngày số liệu')),

    raw,
  };
}

self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
  try {
    const wb = XLSX.read(e.data, { type: 'array', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Row>(ws, {
      header: 1,
      defval: null,
      raw: false,
    });

    const headerIdx = findHeaderRow(rows);
    const idx = buildIndex(rows[headerIdx]);
    const out: LoanRecord[] = [];
    let ngaySoLieu: Date | null = null;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((v) => v === null || v === '')) continue;
      // bỏ qua dòng cộng/tổng
      const maKH = get(row, idx, 'Mã KH');
      if (!maKH) continue;
      const rec = normalize(row, idx);
      if (!ngaySoLieu && rec.ngaySoLieu) ngaySoLieu = rec.ngaySoLieu;
      out.push(rec);
    }

    const result: ImportResult = {
      rows: out,
      ngaySoLieu,
      totalRows: out.length,
    };
    (self as unknown as Worker).postMessage({ ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export {};
