import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, GripVertical, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useDataStore,
  FIELD_LABEL,
  type ActiveFilter,
  type FilterField,
  type RangeFilters,
  type SearchFilter,
} from '@/store/useDataStore';
import { distinctValues } from '@/lib/metrics';
import { cn } from '@/lib/utils';
import type { LoanRecord } from '@/lib/types';

const FIELDS: FilterField[] = [
  'tenPGD',
  'tenXa',
  'tenDVUT',
  'tenChuongTrinh',
  'tinhTrangMonVay',
  'phanLoai',
  'gioiTinh',
  'tenDanToc',
  'nguonVon',
  'tenTo',
  'hinhThucVay',
];

/**
 * Hợp đồng tối thiểu mà FilterBar cần từ một store Zustand. Cả
 * `useDataStore` (snapshot) lẫn `usePeriodStore` (period) đều phơi bày
 * shape này — qua đó FilterBar dùng chung được cho cả hai ứng dụng.
 */
export interface FilterStoreShape {
  rows: LoanRecord[]; // dùng để liệt kê distinct values
  filters: ActiveFilter[];
  ranges: RangeFilters;
  search: SearchFilter;
  addFilter: (f: Omit<ActiveFilter, 'id'>) => void;
  updateFilter: (id: string, patch: Partial<ActiveFilter>) => void;
  removeFilter: (id: string) => void;
  reorderFilters: (ids: string[]) => void;
  clearFilters: () => void;
  setSearch: (q: string) => void;
}

/** Hook trả về FilterStoreShape (selector lấy đầy đủ các trường cần). */
export type FilterStoreHook = () => FilterStoreShape;

/** Adapter mặc định: chính useDataStore của ứng dụng snapshot. */
const useDefaultFilterStore: FilterStoreHook = () => {
  const rows = useDataStore((s) => s.rows);
  const filters = useDataStore((s) => s.filters);
  const ranges = useDataStore((s) => s.ranges);
  const search = useDataStore((s) => s.search);
  const addFilter = useDataStore((s) => s.addFilter);
  const updateFilter = useDataStore((s) => s.updateFilter);
  const removeFilter = useDataStore((s) => s.removeFilter);
  const reorderFilters = useDataStore((s) => s.reorderFilters);
  const clearFilters = useDataStore((s) => s.clearFilters);
  const setSearch = useDataStore((s) => s.setSearch);
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

function ChipItem({
  filter,
  onClick,
  onRemove,
  accent,
}: {
  filter: ActiveFilter;
  onClick: () => void;
  onRemove: () => void;
  accent: 'brand' | 'period';
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: filter.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 pl-1.5 pr-1 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <button onClick={onClick} className="flex items-center gap-1">
        <span className="text-slate-500 dark:text-slate-400">{FIELD_LABEL[filter.field]}:</span>
        <span className={accent === 'period' ? 'text-period-700' : 'text-brand-700'}>
          {filter.values.length === 0
            ? 'tất cả'
            : filter.values.length === 1
              ? filter.values[0]
              : `${filter.values.length} giá trị`}
        </span>
      </button>
      <button
        onClick={onRemove}
        className="rounded-full p-0.5 text-slate-400 dark:text-slate-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

interface FilterBarProps {
  /**
   * Hook truy xuất store cần dùng. Mặc định là useDataStore (snapshot).
   * Truyền adapter `usePeriodFilterStore` cho ứng dụng so sánh hai kỳ.
   */
  useStore?: FilterStoreHook;
  /** Tông màu nhấn — quyết định nút tìm kiếm và chip giá trị. */
  accent?: 'brand' | 'period';
}

export function FilterBar({ useStore, accent = 'brand' }: FilterBarProps = {}) {
  const store = (useStore ?? useDefaultFilterStore)();
  const {
    rows,
    filters,
    addFilter,
    removeFilter,
    reorderFilters,
    clearFilters,
    updateFilter,
    search,
    setSearch,
  } = store;
  const [adderOpen, setAdderOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = filters.map((f) => f.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    reorderFilters(arrayMove(ids, oldIdx, newIdx));
  };

  const usedFields = new Set(filters.map((f) => f.field));
  const availableFields = FIELDS.filter((f) => !usedFields.has(f));

  const focusRing =
    accent === 'period'
      ? 'focus:border-period-400 focus:ring-period-200'
      : 'focus:border-brand-400 focus:ring-brand-200';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={search.q}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên KH, CMND, số khế ước..."
            className={cn(
              'h-8 w-72 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-7 pr-3 text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-1',
              focusRing
            )}
          />
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={filters.map((f) => f.id)} strategy={horizontalListSortingStrategy}>
            {filters.map((f) => (
              <ChipItem
                key={f.id}
                filter={f}
                accent={accent}
                onClick={() => setEditing(f.id)}
                onRemove={() => removeFilter(f.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdderOpen((o) => !o)}
            disabled={availableFields.length === 0}
          >
            <Plus className="h-3.5 w-3.5" /> Thêm bộ lọc
          </Button>
          {adderOpen && (
            <div className="absolute left-0 top-9 z-30 w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-lg">
              {availableFields.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    addFilter({ field: f, values: [] });
                    setAdderOpen(false);
                    // Mở picker cho filter vừa thêm. Vì store là một hook
                    // bên ngoài, không thể dùng .getState() chung; thay vào
                    // đó đợi 1 tick rồi quét lại danh sách vừa cập nhật.
                    setTimeout(() => {
                      const currentFilters = store.filters;
                      const last = currentFilters[currentFilters.length - 1];
                      // Trường hợp store đã update (closure cũ), tìm theo field
                      const target =
                        last && last.field === f ? last : currentFilters.find((x) => x.field === f);
                      if (target) setEditing(target.id);
                    }, 0);
                  }}
                  className="flex w-full items-center rounded px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  {FIELD_LABEL[f]}
                </button>
              ))}
            </div>
          )}
        </div>

        {(filters.length > 0 || search.q) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Xóa tất cả
          </Button>
        )}
      </div>

      {editing &&
        (() => {
          const f = filters.find((x) => x.id === editing);
          if (!f) return null;
          return (
            <ValuePicker
              field={f.field}
              selected={f.values}
              onChange={(values) => updateFilter(f.id, { values })}
              onClose={() => setEditing(null)}
              rows={rows}
              accent={accent}
            />
          );
        })()}
    </div>
  );
}

function ValuePicker({
  field,
  selected,
  onChange,
  onClose,
  rows,
  accent,
}: {
  field: FilterField;
  selected: string[];
  onChange: (v: string[]) => void;
  onClose: () => void;
  rows: LoanRecord[];
  accent: 'brand' | 'period';
}) {
  const options = useMemo(() => distinctValues(rows, field), [rows, field]);
  const [q, setQ] = useState('');
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  const set = new Set(selected);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Chọn giá trị: {FIELD_LABEL[field]}
        </div>
        <button onClick={onClose} className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600">
          Đóng
        </button>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm trong danh sách..."
        className={cn(
          'mb-2 h-8 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-700 dark:text-slate-200 outline-none',
          accent === 'period' ? 'focus:border-period-400' : 'focus:border-brand-400'
        )}
      />
      <div className="scrollbar-thin max-h-56 overflow-y-auto">
        {filtered.map((o) => {
          const active = set.has(o);
          return (
            <button
              key={o}
              onClick={() => {
                const next = new Set(set);
                if (active) next.delete(o);
                else next.add(o);
                onChange(Array.from(next));
              }}
              className={cn(
                'flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs',
                active
                  ? accent === 'period'
                    ? 'bg-period-50 text-period-800 dark:bg-period-900/40 dark:text-period-200'
                    : 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              )}
            >
              <span className="truncate">{o}</span>
              {active && (
                <span className={accent === 'period' ? 'text-period-700' : 'text-brand-700'}>
                  ✓
                </span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-2 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
            Không có giá trị
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Đã chọn: {selected.length}</span>
        <button
          onClick={() => onChange([])}
          className="text-slate-500 dark:text-slate-400 hover:text-rose-600"
        >
          Bỏ chọn tất cả
        </button>
      </div>
    </div>
  );
}

/**
 * Adapter dành cho ứng dụng "So sánh giữa hai kỳ". Trả về union của
 * `prev.rows + curr.rows` để picker liệt kê đủ giá trị từ cả hai kỳ.
 */
export { useDefaultFilterStore };
