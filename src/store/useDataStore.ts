import { create } from 'zustand';
import type { LoanRecord } from '../lib/types';

export type FilterField =
  | 'tenPGD'
  | 'tenXa'
  | 'tenDVUT'
  | 'tenChuongTrinh'
  | 'tinhTrangMonVay'
  | 'phanLoai'
  | 'gioiTinh'
  | 'tenDanToc'
  | 'nguonVon'
  | 'tenTo'
  | 'hinhThucVay';

export interface ActiveFilter {
  id: string;
  field: FilterField;
  values: string[];
  /**
   * Nguồn gốc của bộ lọc:
   * - 'manual': người dùng tự thêm trên FilterBar
   * - 'drilldown': sinh ra từ thao tác click drill-down trên biểu đồ
   *   (sẽ tự động bị xóa khi rời khỏi trang Tra cứu chi tiết)
   */
  source?: 'manual' | 'drilldown';
}

export interface RangeFilters {
  mucVay: [number, number] | null;
  laiSuat: [number, number] | null;
  ngayVay: [string, string] | null; // ISO yyyy-mm-dd
  ngayDaoHan: [string, string] | null; // ISO yyyy-mm-dd (ngayDHGiaHan ?? ngayDHHopDong)
}

export type RangeKey = keyof RangeFilters;

export interface SearchFilter {
  q: string;
}

interface State {
  rows: LoanRecord[];
  ngaySoLieu: Date | null;
  isLoading: boolean;
  error: string | null;
  filters: ActiveFilter[];
  ranges: RangeFilters;
  search: SearchFilter;
  /** Các range đang được áp do drill-down — sẽ bị xóa khi rời /du-lieu */
  drillRangeKeys: RangeKey[];
  setData: (rows: LoanRecord[], ngaySoLieu: Date | null) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
  addFilter: (f: Omit<ActiveFilter, 'id'>) => void;
  updateFilter: (id: string, patch: Partial<ActiveFilter>) => void;
  removeFilter: (id: string) => void;
  reorderFilters: (ids: string[]) => void;
  clearFilters: () => void;
  setRange: <K extends keyof RangeFilters>(k: K, v: RangeFilters[K]) => void;
  setSearch: (q: string) => void;
  /**
   * Áp đặt một bộ lọc đơn trị cho một trường (drill-down từ biểu đồ).
   * Mọi bộ lọc cũ trên cùng trường sẽ bị thay thế; các bộ lọc trên trường
   * khác được giữ nguyên. Bộ lọc mới được đánh dấu source='drilldown'.
   */
  drillDown: (field: FilterField, value: string) => void;
  /**
   * Áp một range filter sinh ra từ drill-down (histogram, time-series).
   * Range được ghi vào danh sách drillRangeKeys để có thể tự xóa khi
   * người dùng rời khỏi trang Tra cứu chi tiết.
   */
  drillDownRange: <K extends keyof RangeFilters>(k: K, v: RangeFilters[K]) => void;
  /**
   * Xóa toàn bộ bộ lọc / range được sinh ra từ drill-down. Bộ lọc do
   * người dùng tự thêm trên FilterBar (source='manual') được giữ nguyên.
   */
  clearDrillDown: () => void;
}

export const useDataStore = create<State>((set) => ({
  rows: [],
  ngaySoLieu: null,
  isLoading: false,
  error: null,
  filters: [],
  ranges: { mucVay: null, laiSuat: null, ngayVay: null, ngayDaoHan: null },
  search: { q: '' },
  drillRangeKeys: [],

  setData: (rows, ngaySoLieu) => set({ rows, ngaySoLieu, error: null }),
  setLoading: (b) => set({ isLoading: b }),
  setError: (e) => set({ error: e }),
  reset: () =>
    set({
      rows: [],
      ngaySoLieu: null,
      filters: [],
      ranges: { mucVay: null, laiSuat: null, ngayVay: null, ngayDaoHan: null },
      search: { q: '' },
      drillRangeKeys: [],
      error: null,
    }),

  addFilter: (f) =>
    set((s) => ({
      filters: [
        ...s.filters,
        {
          source: 'manual',
          ...f,
          id: Math.random().toString(36).slice(2, 9),
        },
      ],
    })),
  updateFilter: (id, patch) =>
    set((s) => ({
      filters: s.filters.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),
  removeFilter: (id) =>
    set((s) => ({ filters: s.filters.filter((f) => f.id !== id) })),
  reorderFilters: (ids) =>
    set((s) => ({
      filters: ids
        .map((id) => s.filters.find((f) => f.id === id))
        .filter(Boolean) as ActiveFilter[],
    })),
  clearFilters: () =>
    set({
      filters: [],
      ranges: { mucVay: null, laiSuat: null, ngayVay: null, ngayDaoHan: null },
      search: { q: '' },
      drillRangeKeys: [],
    }),

  setRange: (k, v) =>
    set((s) => ({ ranges: { ...s.ranges, [k]: v } })),
  setSearch: (q) => set({ search: { q } }),

  drillDown: (field, value) =>
    set((s) => {
      const others = s.filters.filter((f) => f.field !== field);
      return {
        filters: [
          ...others,
          {
            id: Math.random().toString(36).slice(2, 9),
            field,
            values: [value],
            source: 'drilldown',
          },
        ],
      };
    }),

  drillDownRange: (k, v) =>
    set((s) => ({
      ranges: { ...s.ranges, [k]: v },
      drillRangeKeys: s.drillRangeKeys.includes(k)
        ? s.drillRangeKeys
        : [...s.drillRangeKeys, k],
    })),

  clearDrillDown: () =>
    set((s) => {
      const hasDrillFilter = s.filters.some((f) => f.source === 'drilldown');
      const hasDrillRange = s.drillRangeKeys.length > 0;
      if (!hasDrillFilter && !hasDrillRange) return s;
      const nextRanges: RangeFilters = { ...s.ranges };
      for (const k of s.drillRangeKeys) {
        nextRanges[k] = null;
      }
      return {
        filters: s.filters.filter((f) => f.source !== 'drilldown'),
        ranges: nextRanges,
        drillRangeKeys: [],
      };
    }),
}));

/** Áp dụng tất cả các bộ lọc lên danh sách khế ước */
export function applyFilters(
  rows: LoanRecord[],
  filters: ActiveFilter[],
  ranges: RangeFilters,
  search: SearchFilter
): LoanRecord[] {
  let out = rows;

  for (const f of filters) {
    if (!f.values.length) continue;
    const set = new Set(f.values);
    out = out.filter((r) => set.has(String(r[f.field] ?? '')));
  }

  if (ranges.mucVay) {
    const [a, b] = ranges.mucVay;
    out = out.filter((r) => r.mucVay >= a && r.mucVay <= b);
  }
  if (ranges.laiSuat) {
    const [a, b] = ranges.laiSuat;
    out = out.filter((r) => r.laiSuat >= a && r.laiSuat <= b);
  }
  if (ranges.ngayVay) {
    const [a, b] = ranges.ngayVay;
    const ad = new Date(a).getTime();
    const bd = new Date(b).getTime();
    out = out.filter((r) => {
      if (!r.ngayVay) return false;
      const t = r.ngayVay.getTime();
      return t >= ad && t <= bd;
    });
  }
  if (ranges.ngayDaoHan) {
    const [a, b] = ranges.ngayDaoHan;
    const ad = new Date(a).getTime();
    const bd = new Date(b).getTime();
    out = out.filter((r) => {
      const d = r.ngayDHGiaHan ?? r.ngayDHHopDong;
      if (!d) return false;
      const t = d.getTime();
      return t >= ad && t <= bd;
    });
  }
  if (search.q.trim()) {
    const q = search.q.trim().toLowerCase();
    out = out.filter(
      (r) =>
        r.tenKH.toLowerCase().includes(q) ||
        r.soCMND.toLowerCase().includes(q) ||
        r.soKheUoc.toLowerCase().includes(q)
    );
  }

  return out;
}

export const FIELD_LABEL: Record<FilterField, string> = {
  tenPGD: 'Phòng giao dịch',
  tenXa: 'Xã/Phường',
  tenDVUT: 'Đơn vị ủy thác',
  tenChuongTrinh: 'Chương trình tín dụng',
  tinhTrangMonVay: 'Tình trạng món vay',
  phanLoai: 'Phân loại khách hàng',
  gioiTinh: 'Giới tính',
  tenDanToc: 'Dân tộc',
  nguonVon: 'Nguồn vốn',
  tenTo: 'Tổ TK&VV',
  hinhThucVay: 'Hình thức vay',
};
