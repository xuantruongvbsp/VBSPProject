// Kho lưu trữ dành riêng cho ứng dụng "So sánh giữa hai kỳ".
//
// Hai bộ dữ liệu (`prev` = kỳ trước, `curr` = kỳ sau) được giữ độc lập với
// `useDataStore` của ứng dụng "Phân tích một kỳ". Cả hai cùng dùng chung
// FilterBar — nên FilterBar được nâng cấp để nhận store qua tham số.

import { create } from 'zustand';
import type { LoanRecord } from '../lib/types';
import type {
  ActiveFilter,
  FilterField,
  RangeFilters,
  SearchFilter,
} from './useDataStore';

export interface PeriodSnapshot {
  rows: LoanRecord[];
  ngaySoLieu: Date | null;
  filename: string;
  /** Nguồn (file gốc, recent IndexedDB) — chỉ dùng cho hiển thị. */
  source: 'file' | 'recent';
}

/** Yêu cầu chuyển trang nội bộ trong period app — không qua URL params. */
export interface PendingDrill {
  /** Trang đích trong period app, ví dụ '/period/du-lieu' */
  to: string;
  /** Các field+value áp đặt làm bộ lọc trước khi mở trang đích */
  filters?: Array<{ field: FilterField; value: string }>;
  /** Loại biến động muốn pre-select trên Bảng khế ước biến động */
  changeType?:
    | 'new'
    | 'closed'
    | 'increased'
    | 'decreased'
    | 'worsened'
    | 'improved'
    | 'extended'
    | null;
}

interface State {
  prev: PeriodSnapshot | null;
  curr: PeriodSnapshot | null;
  isLoading: boolean;
  error: string | null;
  filters: ActiveFilter[];
  ranges: RangeFilters;
  search: SearchFilter;
  /** Slice trung gian khi drill-down từ trang khác sang trang khác */
  pendingDrill: PendingDrill | null;

  setPrev: (snap: PeriodSnapshot | null) => void;
  setCurr: (snap: PeriodSnapshot | null) => void;
  setBoth: (prev: PeriodSnapshot, curr: PeriodSnapshot) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
  swap: () => void;

  addFilter: (f: Omit<ActiveFilter, 'id'>) => void;
  updateFilter: (id: string, patch: Partial<ActiveFilter>) => void;
  removeFilter: (id: string) => void;
  reorderFilters: (ids: string[]) => void;
  clearFilters: () => void;
  setRange: <K extends keyof RangeFilters>(k: K, v: RangeFilters[K]) => void;
  setSearch: (q: string) => void;

  setPendingDrill: (d: PendingDrill | null) => void;
  consumePendingDrill: () => PendingDrill | null;
}

const EMPTY_RANGES: RangeFilters = { mucVay: null, laiSuat: null, ngayVay: null };

export const usePeriodStore = create<State>((set, get) => ({
  prev: null,
  curr: null,
  isLoading: false,
  error: null,
  filters: [],
  ranges: { ...EMPTY_RANGES },
  search: { q: '' },
  pendingDrill: null,

  setPrev: (snap) => set({ prev: snap, error: null }),
  setCurr: (snap) => set({ curr: snap, error: null }),
  setBoth: (prev, curr) => set({ prev, curr, error: null }),
  setLoading: (b) => set({ isLoading: b }),
  setError: (e) => set({ error: e }),
  reset: () =>
    set({
      prev: null,
      curr: null,
      filters: [],
      ranges: { ...EMPTY_RANGES },
      search: { q: '' },
      error: null,
      pendingDrill: null,
    }),
  swap: () =>
    set((s) => ({
      prev: s.curr,
      curr: s.prev,
    })),

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
      ranges: { ...EMPTY_RANGES },
      search: { q: '' },
    }),
  setRange: (k, v) =>
    set((s) => ({ ranges: { ...s.ranges, [k]: v } })),
  setSearch: (q) => set({ search: { q } }),

  setPendingDrill: (d) => set({ pendingDrill: d }),
  consumePendingDrill: () => {
    const d = get().pendingDrill;
    if (d) set({ pendingDrill: null });
    return d;
  },
}));
