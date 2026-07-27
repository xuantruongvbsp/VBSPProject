// Kho lưu trữ dành riêng cho ứng dụng "So sánh giữa hai kỳ".
//
// Mô hình 3 slot: `lastYear` (số liệu cuối năm trước, ví dụ 31/12/2025),
// `lastMonth` (số liệu cuối tháng trước) và `now` (số liệu mới nhất).
// Người dùng nạp tối đa 3 tệp và chọn 2 trong 3 để so sánh thông qua
// `comparePair`. Các trường `prev` và `curr` được duy trì như chiếu suy
// dẫn (derived projection) — luôn bằng `state[comparePair.a]` và
// `state[comparePair.b]` — để phần tính toán & FilterBar hiện hữu không
// cần thay đổi.

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

export type PeriodSlotKey = 'lastYear' | 'lastMonth' | 'now';

export const PERIOD_SLOT_KEYS: readonly PeriodSlotKey[] = [
  'lastYear',
  'lastMonth',
  'now',
] as const;

export const PERIOD_SLOT_LABEL: Record<PeriodSlotKey, string> = {
  lastYear: 'Cuối năm trước',
  lastMonth: 'Cuối tháng trước',
  now: 'Hiện tại',
};

export interface ComparePair {
  a: PeriodSlotKey;
  b: PeriodSlotKey;
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
  // Ba slot dữ liệu — người dùng nạp tối đa 3 tệp.
  lastYear: PeriodSnapshot | null;
  lastMonth: PeriodSnapshot | null;
  now: PeriodSnapshot | null;
  /** Cặp đang được dùng để so sánh — `a` là kỳ cũ hơn, `b` là kỳ mới hơn. */
  comparePair: ComparePair;

  // Suy dẫn từ slot + comparePair, được cập nhật mỗi khi slot/pair đổi.
  // Giữ nguyên tên `prev`/`curr` để các trang phân tích không phải sửa.
  prev: PeriodSnapshot | null;
  curr: PeriodSnapshot | null;

  isLoading: boolean;
  error: string | null;
  filters: ActiveFilter[];
  ranges: RangeFilters;
  search: SearchFilter;
  /** Slice trung gian khi drill-down từ trang khác sang trang khác */
  pendingDrill: PendingDrill | null;

  setSlot: (key: PeriodSlotKey, snap: PeriodSnapshot | null) => void;
  setSlots: (slots: Partial<Record<PeriodSlotKey, PeriodSnapshot | null>>) => void;
  setComparePair: (pair: ComparePair) => void;
  /** Tương thích ngược: nạp `lastMonth=prev`, `now=curr`, đặt pair = {lastMonth, now}. */
  setBoth: (prev: PeriodSnapshot, curr: PeriodSnapshot) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
  /** Đảo vị trí kỳ A và B trong cặp so sánh. */
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

const EMPTY_RANGES: RangeFilters = { mucVay: null, tongDuNo: null, laiSuat: null, ngayVay: null, ngayDaoHan: null, soDuTG105Min: null };

const DEFAULT_PAIR: ComparePair = { a: 'lastMonth', b: 'now' };

interface SlotsView {
  lastYear: PeriodSnapshot | null;
  lastMonth: PeriodSnapshot | null;
  now: PeriodSnapshot | null;
}

/** Trả về các slot đã có dữ liệu, theo thứ tự cố định lastYear < lastMonth < now. */
function loadedKeys(slots: SlotsView): PeriodSlotKey[] {
  return PERIOD_SLOT_KEYS.filter((k) => slots[k] != null);
}

/** Đảm bảo `pair.a` và `pair.b` đều trỏ vào slot đã có dữ liệu, đồng thời
 *  duy trì thứ tự thời gian (a cũ hơn b) khi có thể. Nếu không đủ 2 slot,
 *  trả về pair mặc định để các selector không sập. */
function reconcilePair(slots: SlotsView, pair: ComparePair): ComparePair {
  const keys = loadedKeys(slots);
  if (keys.length < 2) return pair;
  let a = keys.includes(pair.a) ? pair.a : null;
  let b = keys.includes(pair.b) ? pair.b : null;
  if (!a) a = keys.find((k) => k !== b) ?? keys[0];
  if (!b) b = keys.find((k) => k !== a) ?? keys[keys.length - 1];
  if (a === b) {
    // Hiếm gặp: chọn slot khác bất kỳ để b ≠ a
    const alt = keys.find((k) => k !== a);
    if (alt) b = alt;
  }
  return { a: a as PeriodSlotKey, b: b as PeriodSlotKey };
}

function projectPrevCurr(
  slots: SlotsView,
  pair: ComparePair
): { prev: PeriodSnapshot | null; curr: PeriodSnapshot | null } {
  const safe = reconcilePair(slots, pair);
  return { prev: slots[safe.a], curr: slots[safe.b] };
}

export const usePeriodStore = create<State>((set, get) => ({
  lastYear: null,
  lastMonth: null,
  now: null,
  comparePair: DEFAULT_PAIR,
  prev: null,
  curr: null,
  isLoading: false,
  error: null,
  filters: [],
  ranges: { ...EMPTY_RANGES },
  search: { q: '' },
  pendingDrill: null,

  setSlot: (key, snap) =>
    set((s) => {
      const slots: SlotsView = {
        lastYear: s.lastYear,
        lastMonth: s.lastMonth,
        now: s.now,
        [key]: snap,
      };
      const safePair = reconcilePair(slots, s.comparePair);
      const { prev, curr } = projectPrevCurr(slots, safePair);
      return {
        ...slots,
        comparePair: safePair,
        prev,
        curr,
        error: null,
      };
    }),

  setSlots: (patch) =>
    set((s) => {
      const slots: SlotsView = {
        lastYear: 'lastYear' in patch ? patch.lastYear ?? null : s.lastYear,
        lastMonth: 'lastMonth' in patch ? patch.lastMonth ?? null : s.lastMonth,
        now: 'now' in patch ? patch.now ?? null : s.now,
      };
      const safePair = reconcilePair(slots, s.comparePair);
      const { prev, curr } = projectPrevCurr(slots, safePair);
      return {
        ...slots,
        comparePair: safePair,
        prev,
        curr,
        error: null,
      };
    }),

  setComparePair: (pair) =>
    set((s) => {
      const slots: SlotsView = { lastYear: s.lastYear, lastMonth: s.lastMonth, now: s.now };
      const safePair = reconcilePair(slots, pair);
      const { prev, curr } = projectPrevCurr(slots, safePair);
      return { comparePair: safePair, prev, curr };
    }),

  setBoth: (prevSnap, currSnap) =>
    set(() => {
      const slots: SlotsView = {
        lastYear: null,
        lastMonth: prevSnap,
        now: currSnap,
      };
      const pair: ComparePair = { a: 'lastMonth', b: 'now' };
      return {
        ...slots,
        comparePair: pair,
        prev: prevSnap,
        curr: currSnap,
        error: null,
      };
    }),

  setLoading: (b) => set({ isLoading: b }),
  setError: (e) => set({ error: e }),
  reset: () =>
    set({
      lastYear: null,
      lastMonth: null,
      now: null,
      comparePair: DEFAULT_PAIR,
      prev: null,
      curr: null,
      filters: [],
      ranges: { ...EMPTY_RANGES },
      search: { q: '' },
      error: null,
      pendingDrill: null,
    }),
  swap: () =>
    set((s) => {
      const safePair: ComparePair = { a: s.comparePair.b, b: s.comparePair.a };
      const slots: SlotsView = { lastYear: s.lastYear, lastMonth: s.lastMonth, now: s.now };
      const { prev, curr } = projectPrevCurr(slots, safePair);
      return { comparePair: safePair, prev, curr };
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

/** Số slot đã có dữ liệu — dùng cho gating UI (≥ 2 mới vào ứng dụng được). */
export function countLoadedSlots(s: Pick<State, PeriodSlotKey>): number {
  return PERIOD_SLOT_KEYS.reduce((n, k) => n + (s[k] ? 1 : 0), 0);
}
