// Định dạng số liệu chuẩn Việt Nam (đơn vị: VNĐ)

const vnNumber = new Intl.NumberFormat('vi-VN');

export function fmtNumber(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return vnNumber.format(Number(v.toFixed(digits)));
}

export function fmtCurrency(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return vnNumber.format(Math.round(v)) + ' đ';
}

/** Rút gọn theo đơn vị tỷ / triệu / nghìn cho biểu đồ */
export function fmtCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e12) return (v / 1e12).toFixed(2).replace(/\.?0+$/, '') + ' nghìn tỷ';
  if (abs >= 1e9) return (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ';
  if (abs >= 1e6) return (v / 1e6).toFixed(1).replace(/\.?0+$/, '') + ' tr';
  if (abs >= 1e3) return (v / 1e3).toFixed(0) + 'k';
  return String(v);
}

export function fmtPercent(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toFixed(digits).replace('.', ',') + '%';
}

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

/**
 * Parse ngày từ Excel (serial / chuỗi / Date) thành Date ở múi giờ cục bộ.
 *
 * Quan trọng: mọi nhánh đều dựng lại Date bằng `new Date(y, m-1, d)` (cục bộ)
 * để `getFullYear/getMonth/getDate` trả đúng ngày lịch bất kể múi giờ. Trước
 * đây nhánh serial và Date.parse tạo Date ở UTC midnight — khi đọc cục bộ ở
 * múi giờ âm hoặc gần UTC, ngày lùi 1 và tháng bị lệch (ví dụ 1/5 đếm sang 4).
 */
export function parseVnDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;

  const build = (y: number, m: number, d: number): Date | null => {
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // Lấy thành phần UTC (cách xlsx thường tạo Date cho ô ngày) rồi dựng lại
    // ở múi giờ cục bộ để ngày không bị lùi.
    return build(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }

  if (typeof v === 'number') {
    // Excel serial date (hệ 1900). Quy đổi qua UTC rồi tách ngày lịch.
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const u = new Date(ms);
    if (Number.isNaN(u.getTime())) return null;
    return build(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate());
  }

  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;

    // ISO: yyyy-mm-dd (có/không phần giờ).
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));

    // Việt Nam: dd/MM/yyyy hoặc dd-MM-yyyy (chấp nhận năm 2 chữ số).
    const vn = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (vn) {
      let y = Number(vn[3]);
      if (y < 100) y += y >= 70 ? 1900 : 2000;
      return build(y, Number(vn[2]), Number(vn[1]));
    }

    // Fallback: Date.parse rồi tách thành phần UTC.
    const t = Date.parse(s);
    if (Number.isNaN(t)) return null;
    const u = new Date(t);
    return build(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate());
  }

  return null;
}

export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[,\s]/g, '').replace(/[^\d.\-]/g, '');
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}
