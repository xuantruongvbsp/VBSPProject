// Tương thích ngược cho `LoanRecord` đã lưu ở IndexedDB (tệp gần đây, bộ tệp
// so sánh) hoặc tệp xuất bản cũ.
//
// Các bản parse cũ mang theo `raw` — bản sao đủ 174 cột gốc (thực tế ~350
// khóa vì có thêm khóa chuẩn hóa `__n:`), mỗi dòng ~13 KB → 15k dòng ≈ 200 MB
// khi structured-clone. Parser hiện tại không sinh `raw` nữa; hàm dưới đây
// vá các trường type hóa được thêm sau (đọc từ `raw` nếu còn) rồi BỎ `raw`
// để giải phóng bộ nhớ ngay khi nạp lại.

import type { LoanRecord } from './types';
import { parseVnDate, toNumber } from './format';

type LegacyRow = Partial<LoanRecord> & { raw?: Record<string, unknown> };

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * Chuẩn hóa một mảng bản ghi đọc từ cache/publish cũ: bù trường thiếu từ
 * `raw` (nếu có) và loại `raw`. Trả về đúng mảng đầu vào khi không có gì
 * phải sửa (tránh cấp phát lại vô ích).
 */
export function upgradeLegacyRows(rows: LoanRecord[]): LoanRecord[] {
  if (rows.length === 0) return rows;
  // Toàn bộ rows đều xuất phát từ cùng một snapshot parser → kiểm tra row
  // đầu là đủ.
  const sample = rows[0] as LegacyRow;
  const hasRaw = sample.raw !== undefined;
  const needsDeposit = !('soDuTienGui105' in sample);
  const needsKhoanhDate = !('ngayHetHanKhoanh' in sample);
  const needsNoiCap = !('noiCapCMND' in sample);
  const needsDTTH = !('tenDTTH' in sample);
  // Bản cũ ép "Thời hạn vay" (chữ: Ngắn/Trung/Dài hạn) thành number → luôn 0.
  const needsThoiHan = typeof sample.thoiHanVay === 'number';
  if (
    !hasRaw && !needsDeposit && !needsKhoanhDate && !needsNoiCap && !needsDTTH && !needsThoiHan
  ) {
    return rows;
  }
  return rows.map((r) => {
    const { raw, ...rest } = r as LegacyRow;
    const src = raw ?? {};
    const out = rest as LoanRecord;
    if (needsDeposit) out.soDuTienGui105 = toNumber(src['Số dư tiền gửi 105']);
    if (needsKhoanhDate) out.ngayHetHanKhoanh = parseVnDate(src['Ngày hết hạn Khoanh']);
    if (needsNoiCap) out.noiCapCMND = str(src['Nơi cấp CMND']);
    if (needsDTTH) out.tenDTTH = str(src['Tên ĐTTH']);
    if (needsThoiHan) {
      const fromRaw = str(src['Thời hạn vay']);
      out.thoiHanVay = fromRaw || (out.thoiHanVay ? String(out.thoiHanVay) : '');
    }
    return out;
  });
}
