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

/** Parse ngày dạng dd/MM/yyyy hoặc Date */
export function parseVnDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : new Date(t);
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
