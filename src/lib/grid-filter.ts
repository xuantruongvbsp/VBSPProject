import { useMemo, useState } from 'react';

export type ColumnGetter<T> = (row: T) => string;

export interface UseGridFilterResult<T, K extends string> {
  /** Rows sau khi áp tất cả filter của các cột */
  filtered: T[];
  /** State filter: { columnKey -> Set<string> } */
  filters: Record<K, Set<string>>;
  /** Set filter cho 1 cột; rỗng = không lọc */
  setFilter: (key: K, next: Set<string>) => void;
  /** Distinct values của mỗi cột (đã sort, đã unique) — bám vào ROWS GỐC, không phụ thuộc filter hiện tại */
  distinctValues: Record<K, string[]>;
  /** Có bất kỳ cột nào đang lọc không */
  isAnyFiltered: boolean;
  /** Reset toàn bộ filter */
  resetAll: () => void;
}

/**
 * Hook quản lý filter dạng Excel cho 1 grid.
 *
 * @param rows Danh sách hàng gốc (đã pre-sort theo nhu cầu page).
 * @param columns Map { columnKey -> getter(row) → string hiển thị/lọc }.
 *
 * Cách dùng:
 *   const { filtered, filters, setFilter, distinctValues } = useGridFilter(rows, {
 *     soQD: r => r.soQD,
 *     trangThai: r => statusLabel(r.trangThai),
 *   });
 *   <ColumnFilter values={distinctValues.soQD} selected={filters.soQD}
 *                 onApply={(s) => setFilter('soQD', s)} />
 *   {filtered.map(...)}
 */
export function useGridFilter<T, K extends string>(
  rows: T[],
  columns: Record<K, ColumnGetter<T>>
): UseGridFilterResult<T, K> {
  const keys = Object.keys(columns) as K[];

  const [filters, setFilters] = useState<Record<K, Set<string>>>(() => {
    const init = {} as Record<K, Set<string>>;
    for (const k of keys) init[k] = new Set();
    return init;
  });

  const distinctValues = useMemo(() => {
    const out = {} as Record<K, string[]>;
    for (const k of keys) {
      const set = new Set<string>();
      for (const row of rows) {
        set.add(String(columns[k](row) ?? ''));
      }
      out[k] = Array.from(set).sort((a, b) =>
        a.localeCompare(b, 'vi', { numeric: true })
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ...keys]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      for (const k of keys) {
        const sel = filters[k];
        if (!sel || sel.size === 0) continue; // không lọc cột này
        const val = String(columns[k](row) ?? '');
        if (!sel.has(val)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters, ...keys]);

  const setFilter = (key: K, next: Set<string>) => {
    setFilters((prev) => ({ ...prev, [key]: next }));
  };

  const resetAll = () => {
    const empty = {} as Record<K, Set<string>>;
    for (const k of keys) empty[k] = new Set();
    setFilters(empty);
  };

  const isAnyFiltered = keys.some((k) => (filters[k]?.size ?? 0) > 0);

  return { filtered, filters, setFilter, distinctValues, isAnyFiltered, resetAll };
}
