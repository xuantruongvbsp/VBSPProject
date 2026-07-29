// Nhập danh mục (Điểm giao dịch / Cán bộ) từ tệp Excel (.xlsx/.xls) hoặc CSV.
//
// Mục tiêu: người dùng không phải gõ tay từng ĐGD / cán bộ trên giao diện.
// Họ tải "file mẫu" (đã điền sẵn toàn bộ Mã thôn của Báo cáo 31, hoặc toàn bộ
// Mã ĐGD của danh mục), điền thêm 2 cột mã/tên rồi tải ngược lên.
//
// Quy ước đọc file:
//   - Dòng tiêu đề được dò tự động trong 15 dòng đầu (không cần nằm ở dòng 1).
//   - Tên cột so khớp không dấu, bỏ khoảng trắng: "Mã ĐGD" == "ma dgd" == "MADGD".
//   - Nhiều dòng cùng một mã ⇒ gộp danh sách con (mã thôn / mã ĐGD).
//   - Một ô có thể chứa nhiều mã, ngăn bởi , ; | / tab hoặc xuống dòng.

import * as XLSX from 'xlsx';

/** Bỏ dấu tiếng Việt + ký tự phân cách để so khớp tên cột. */
function normHeader(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const SPLIT_RE = /[,;|/\t\r\n]+/;

/** Tách một ô thành danh sách mã (hỗ trợ nhiều mã trong cùng ô). */
function splitCodes(v: unknown): string[] {
  const raw = String(v ?? '').trim();
  if (!raw) return [];
  return raw
    .split(SPLIT_RE)
    .map((x) => x.trim())
    .filter(Boolean);
}

function cell(row: string[], idx: number): string {
  return idx < 0 ? '' : String(row[idx] ?? '').trim();
}

/** Đọc file thành ma trận chuỗi (giữ nguyên số 0 đứng đầu của mã thôn). */
async function readMatrix(file: File): Promise<string[][]> {
  const isCsv = /\.csv$/i.test(file.name);
  const wb = isCsv
    ? XLSX.read(await file.text(), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Tệp không có sheet nào.');
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });
  return matrix.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []));
}

interface ColumnSpec {
  /** Khóa nội bộ */
  key: string;
  /** Nhãn hiển thị khi báo lỗi */
  label: string;
  /** Các tên cột chấp nhận (đã chuẩn hóa không dấu) */
  aliases: string[];
  required?: boolean;
}

interface HeaderMatch {
  headerRow: number;
  index: Record<string, number>;
}

/** Dò dòng tiêu đề trong 15 dòng đầu, chọn dòng khớp được nhiều cột nhất. */
function locateHeader(matrix: string[][], specs: ColumnSpec[]): HeaderMatch {
  let best: HeaderMatch | null = null;
  let bestScore = 0;
  const limit = Math.min(matrix.length, 15);

  for (let r = 0; r < limit; r += 1) {
    const index: Record<string, number> = {};
    for (const spec of specs) index[spec.key] = -1;
    let score = 0;
    matrix[r].forEach((raw, c) => {
      const n = normHeader(raw);
      if (!n) return;
      for (const spec of specs) {
        if (index[spec.key] === -1 && spec.aliases.includes(n)) {
          index[spec.key] = c;
          score += 1;
          return;
        }
      }
    });
    if (score > bestScore) {
      bestScore = score;
      best = { headerRow: r, index };
    }
  }

  const missing = specs.filter((s) => s.required && (!best || best.index[s.key] === -1));
  if (!best || missing.length > 0) {
    const found = (matrix[best?.headerRow ?? 0] ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join(' | ');
    throw new Error(
      `Không tìm thấy cột bắt buộc: ${missing.map((m) => m.label).join(', ')}.` +
        (found ? ` Các cột đọc được: ${found}` : '')
    );
  }
  return best;
}

export interface ParsedCatalog<T> {
  records: T[];
  /** Cảnh báo không chặn import (dòng thiếu mã, tên mâu thuẫn...) */
  issues: string[];
  /** Số dòng dữ liệu đã đọc (không tính tiêu đề) */
  dataRowCount: number;
}

/** Gộp nhiều dòng cùng mã thành một bản ghi, giữ thứ tự xuất hiện. */
function groupRows(
  matrix: string[][],
  match: HeaderMatch,
  keys: { code: string; name: string; items: string },
  labels: { code: string; name: string }
): ParsedCatalog<{ code: string; name: string; items: string[] }> {
  const issues: string[] = [];
  const byCode = new Map<string, { code: string; name: string; items: string[]; seen: Set<string> }>();
  let dataRowCount = 0;
  let skippedRows = 0;

  for (let r = match.headerRow + 1; r < matrix.length; r += 1) {
    const row = matrix[r];
    const code = cell(row, match.index[keys.code]);
    const name = cell(row, match.index[keys.name]);
    const items = splitCodes(row[match.index[keys.items]]);
    if (!code && !name && items.length === 0) continue; // dòng trống
    dataRowCount += 1;

    if (!code) {
      // Dòng chưa gán (file mẫu liệt kê sẵn mọi mã) — bỏ qua, gộp cảnh báo ở cuối.
      skippedRows += 1;
      continue;
    }

    let rec = byCode.get(code);
    if (!rec) {
      rec = { code, name, items: [], seen: new Set<string>() };
      byCode.set(code, rec);
    } else if (name && rec.name && normHeader(name) !== normHeader(rec.name)) {
      issues.push(
        `${labels.code} "${code}" có 2 ${labels.name} khác nhau ("${rec.name}" / "${name}") — giữ tên đầu tiên.`
      );
    } else if (name && !rec.name) {
      rec.name = name;
    }

    for (const it of items) {
      if (rec.seen.has(it)) continue;
      rec.seen.add(it);
      rec.items.push(it);
    }
  }

  const records = Array.from(byCode.values()).map((r) => ({
    code: r.code,
    name: r.name || r.code,
    items: r.items,
  }));
  for (const r of records) {
    if (r.items.length === 0) {
      issues.push(`${labels.code} "${r.code}": chưa gán mã nào.`);
    }
  }
  if (skippedRows > 0) {
    issues.push(`${skippedRows} dòng bỏ trống ${labels.code} — đã bỏ qua.`);
  }
  return { records, issues, dataRowCount };
}

// ---------------------------------------------------------------- Điểm giao dịch

const TXN_POINT_COLUMNS: ColumnSpec[] = [
  {
    key: 'code',
    label: 'Mã ĐGD',
    required: true,
    aliases: ['madgd', 'madiemgiaodich', 'madiem', 'magiaodich', 'madgdcode', 'mapgd'],
  },
  {
    key: 'name',
    label: 'Tên ĐGD',
    aliases: ['tendgd', 'tendiemgiaodich', 'tendiem', 'diemgiaodich', 'tengiaodich', 'dgd'],
  },
  {
    key: 'items',
    label: 'Mã thôn',
    required: true,
    aliases: [
      'mathon',
      'mathons',
      'mathonthuocdgd',
      'mathonthuocdiemgiaodich',
      'cacmathon',
      'danhsachmathon',
      'mathonlist',
      'mathonapban',
      'mathonban',
    ],
  },
];

export interface ParsedTxnPoint {
  maDGD: string;
  tenDGD: string;
  maThons: string[];
}

export async function parseTxnPointSheet(file: File): Promise<ParsedCatalog<ParsedTxnPoint>> {
  const matrix = await readMatrix(file);
  const match = locateHeader(matrix, TXN_POINT_COLUMNS);
  const grouped = groupRows(
    matrix,
    match,
    { code: 'code', name: 'name', items: 'items' },
    { code: 'Mã ĐGD', name: 'Tên ĐGD' }
  );
  return {
    records: grouped.records.map((r) => ({ maDGD: r.code, tenDGD: r.name, maThons: r.items })),
    issues: grouped.issues,
    dataRowCount: grouped.dataRowCount,
  };
}

// ------------------------------------------------------------------------ Cán bộ

const STAFF_COLUMNS: ColumnSpec[] = [
  {
    key: 'code',
    label: 'Mã NV',
    required: true,
    aliases: ['manv', 'macanbo', 'macb', 'manhanvien', 'macbtd', 'macanbotindung'],
  },
  {
    key: 'name',
    label: 'Tên NV',
    aliases: ['tennv', 'tencanbo', 'tencb', 'tennhanvien', 'hoten', 'hovaten', 'canbo', 'cbtd'],
  },
  {
    key: 'items',
    label: 'Mã ĐGD',
    required: true,
    aliases: [
      'madgd',
      'madgds',
      'cacmadgd',
      'danhsachmadgd',
      'madgdphutrach',
      'madiemgiaodich',
      'diemgiaodich',
      'dgd',
    ],
  },
];

export interface ParsedStaff {
  maNV: string;
  tenNV: string;
  maDGDs: string[];
}

export async function parseStaffSheet(file: File): Promise<ParsedCatalog<ParsedStaff>> {
  const matrix = await readMatrix(file);
  const match = locateHeader(matrix, STAFF_COLUMNS);
  const grouped = groupRows(
    matrix,
    match,
    { code: 'code', name: 'name', items: 'items' },
    { code: 'Mã NV', name: 'Tên NV' }
  );
  return {
    records: grouped.records.map((r) => ({ maNV: r.code, tenNV: r.name, maDGDs: r.items })),
    issues: grouped.issues,
    dataRowCount: grouped.dataRowCount,
  };
}

/**
 * Excel hay nuốt số 0 đứng đầu của mã ("001" nhập vào ô số → còn "1").
 * Nếu mã không khớp nguồn đối chiếu nhưng chỉ toàn chữ số, thử đệm 0 theo
 * đúng độ dài các mã đang có; chỉ nhận khi kết quả là DUY NHẤT.
 */
export function padNumericCodes(
  items: string[],
  known: Set<string>
): { items: string[]; fixes: Array<[string, string]> } {
  if (known.size === 0) return { items, fixes: [] };
  const lengths = new Set<number>();
  for (const k of known) lengths.add(k.length);

  const fixes: Array<[string, string]> = [];
  const out = items.map((it) => {
    if (known.has(it) || !/^\d+$/.test(it)) return it;
    const candidates = new Set<string>();
    for (const len of lengths) {
      if (len <= it.length) continue;
      const padded = it.padStart(len, '0');
      if (known.has(padded)) candidates.add(padded);
    }
    if (candidates.size !== 1) return it;
    const fixed = Array.from(candidates)[0];
    fixes.push([it, fixed]);
    return fixed;
  });
  return { items: out, fixes };
}

// ------------------------------------------------------------------- File mẫu

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function guideSheet(lines: string[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(lines.map((l) => [l]));
  ws['!cols'] = [{ wch: 110 }];
  return ws;
}

export interface TemplateThon {
  maThon: string;
  tenThon: string;
  tenXa: string;
  loanCount: number;
}

/**
 * File mẫu ĐGD: điền sẵn mỗi Mã thôn của Báo cáo 31 một dòng, người dùng chỉ
 * việc gõ Mã ĐGD / Tên ĐGD ở 2 cột đầu (các thôn cùng ĐGD ghi trùng mã).
 */
export function downloadTxnPointTemplate(thons: TemplateThon[]) {
  const rows = thons.map((t) => ({
    'Mã ĐGD': '',
    'Tên ĐGD': '',
    'Mã thôn': t.maThon,
    'Tên thôn (tham khảo)': t.tenThon,
    'Tên xã (tham khảo)': t.tenXa,
    'Số khế ước (tham khảo)': t.loanCount,
  }));
  if (rows.length === 0) {
    rows.push({
      'Mã ĐGD': 'DGD01',
      'Tên ĐGD': 'ĐGD Xã ABC',
      'Mã thôn': '001',
      'Tên thôn (tham khảo)': 'Thôn 1',
      'Tên xã (tham khảo)': 'Xã ABC',
      'Số khế ước (tham khảo)': 0,
    });
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DGD');
  XLSX.utils.book_append_sheet(
    wb,
    guideSheet([
      'HƯỚNG DẪN NHẬP DANH MỤC ĐIỂM GIAO DỊCH',
      '',
      '1. Sheet "DGD" đã liệt kê sẵn toàn bộ Mã thôn có trong Báo cáo 31.',
      '2. Với mỗi dòng thôn, điền "Mã ĐGD" và "Tên ĐGD" phụ trách thôn đó.',
      '3. Nhiều thôn thuộc cùng một ĐGD thì ghi TRÙNG Mã ĐGD (Tên ĐGD chỉ cần đúng ở dòng đầu).',
      '4. Thôn không thuộc ĐGD nào: để trống 2 cột đầu — dòng đó sẽ được bỏ qua.',
      '5. Có thể gộp nhiều mã thôn vào 1 ô, ngăn nhau bởi dấu phẩy: 001, 002, 003',
      '6. Các cột "(tham khảo)" chỉ để đối chiếu, hệ thống không đọc.',
      '7. Lưu file rồi bấm "Import Excel" trên trang Danh mục Điểm giao dịch.',
    ]),
    'Huong dan'
  );
  downloadWorkbook(wb, `mau-diem-giao-dich-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export interface TemplatePoint {
  maDGD: string;
  tenDGD: string;
  thonCount: number;
}

/**
 * File mẫu cán bộ: điền sẵn mỗi ĐGD trong danh mục một dòng, người dùng gõ
 * Mã NV / Tên NV phụ trách ĐGD đó.
 */
export function downloadStaffTemplate(points: TemplatePoint[]) {
  const rows = points.map((p) => ({
    'Mã NV': '',
    'Tên NV': '',
    'Mã ĐGD': p.maDGD,
    'Tên ĐGD (tham khảo)': p.tenDGD,
    'Số thôn (tham khảo)': p.thonCount,
  }));
  if (rows.length === 0) {
    rows.push({
      'Mã NV': 'NV01',
      'Tên NV': 'Nguyễn Văn A',
      'Mã ĐGD': 'DGD01',
      'Tên ĐGD (tham khảo)': 'ĐGD Xã ABC',
      'Số thôn (tham khảo)': 0,
    });
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 30 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CanBo');
  XLSX.utils.book_append_sheet(
    wb,
    guideSheet([
      'HƯỚNG DẪN NHẬP DANH MỤC CÁN BỘ',
      '',
      '1. Sheet "CanBo" đã liệt kê sẵn toàn bộ Mã ĐGD trong danh mục Điểm giao dịch.',
      '2. Với mỗi dòng ĐGD, điền "Mã NV" và "Tên NV" của cán bộ phụ trách.',
      '3. Một cán bộ phụ trách nhiều ĐGD thì ghi TRÙNG Mã NV ở các dòng đó.',
      '4. ĐGD chưa có cán bộ: để trống 2 cột đầu — dòng đó sẽ được bỏ qua.',
      '5. Có thể gộp nhiều mã ĐGD vào 1 ô, ngăn nhau bởi dấu phẩy: DGD01, DGD02',
      '6. Lưu file rồi bấm "Import Excel" trên trang Danh mục cán bộ.',
    ]),
    'Huong dan'
  );
  downloadWorkbook(wb, `mau-can-bo-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
