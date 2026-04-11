// Adapter biến `usePeriodStore` thành `FilterStoreShape` mà FilterBar
// dùng chung. Trường `rows` được trộn từ cả `prev` và `curr` để picker
// liệt kê đủ giá trị xuất hiện ở bất kỳ kỳ nào (ví dụ một xã chỉ tồn
// tại ở kỳ sau, hoặc một chương trình đã ngừng hẳn ở kỳ sau).

import { useMemo } from 'react';
import { usePeriodStore } from './usePeriodStore';
import type { FilterStoreShape } from '@/components/filters/FilterBar';

export const usePeriodFilterStore = (): FilterStoreShape => {
  const prev = usePeriodStore((s) => s.prev);
  const curr = usePeriodStore((s) => s.curr);
  const filters = usePeriodStore((s) => s.filters);
  const ranges = usePeriodStore((s) => s.ranges);
  const search = usePeriodStore((s) => s.search);
  const addFilter = usePeriodStore((s) => s.addFilter);
  const updateFilter = usePeriodStore((s) => s.updateFilter);
  const removeFilter = usePeriodStore((s) => s.removeFilter);
  const reorderFilters = usePeriodStore((s) => s.reorderFilters);
  const clearFilters = usePeriodStore((s) => s.clearFilters);
  const setSearch = usePeriodStore((s) => s.setSearch);

  const rows = useMemo(() => {
    const a = prev?.rows ?? [];
    const b = curr?.rows ?? [];
    if (!a.length) return b;
    if (!b.length) return a;
    return a.concat(b);
  }, [prev, curr]);

  return {
    rows,
    filters,
    ranges,
    search,
    addFilter,
    updateFilter,
    removeFilter,
    reorderFilters,
    clearFilters,
    setSearch,
  };
};
