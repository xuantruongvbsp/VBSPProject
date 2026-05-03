import { useEffect, useMemo, useState } from 'react';
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
import { Plus, X, GripVertical, Search, UserCircle2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useDataStore,
  FIELD_LABEL,
  type ActiveFilter,
  type FilterField,
  type RangeFilters,
  type SearchFilter,
} from '@/store/useDataStore';
import { useStaffStore } from '@/store/useStaffStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import { Link } from 'react-router-dom';
import { distinctValues } from '@/lib/metrics';
import { cn } from '@/lib/utils';
import type { LoanRecord } from '@/lib/types';

const FIELDS: FilterField[] = [
  'tenXa',
  'tenDVUT',
  'tenChuongTrinh',
  'gioiTinh',
  'nguonVon',
  'tenTo',
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

  // Bộ chọn "Cán bộ" / "Điểm giao dịch" áp dụng cho cả 2 ứng dụng
  // (snapshot và so sánh hai kỳ). Stores cán bộ/ĐGD là localStorage chung
  // — chọn cán bộ ở app này sẽ đồng bộ sang app kia.
  const showStaff = true;

  // Các bộ lọc do bộ chọn Cán bộ / Điểm giao dịch tạo ra (`source = 'staff'
  // | 'txnpoint'`) không hiển thị thành chip — chúng được quản lý qua
  // dropdown riêng để tránh người dùng nhầm lẫn xóa nửa vời.
  const visibleFilters = filters.filter(
    (f) => f.source !== 'staff' && f.source !== 'txnpoint'
  );

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

        {showStaff && (
          <>
            <StaffSelector
              filters={filters}
              addFilter={addFilter}
              updateFilter={updateFilter}
              removeFilter={removeFilter}
              accent={accent}
            />
            <TxnPointSelector
              filters={filters}
              addFilter={addFilter}
              updateFilter={updateFilter}
              removeFilter={removeFilter}
              accent={accent}
            />
          </>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={visibleFilters.map((f) => f.id)}
            strategy={horizontalListSortingStrategy}
          >
            {visibleFilters.map((f) => (
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
 * Bộ chọn "Cán bộ" — đồng bộ giữa store cán bộ (selectedStaffId) và bộ
 * lọc đang áp dụng trên trường `maThon`. Nguồn sự thật là store cán bộ:
 * khi chọn cán bộ thì áp filter; khi bỏ chọn (Tất cả) thì gỡ filter.
 */
function StaffSelector({
  filters,
  addFilter,
  updateFilter,
  removeFilter,
  accent,
}: {
  filters: ActiveFilter[];
  addFilter: (f: Omit<ActiveFilter, 'id'>) => void;
  updateFilter: (id: string, patch: Partial<ActiveFilter>) => void;
  removeFilter: (id: string) => void;
  accent: 'brand' | 'period';
}) {
  const staff = useStaffStore((s) => s.staff);
  const selectedStaffId = useStaffStore((s) => s.selectedStaffId);
  const selectStaff = useStaffStore((s) => s.selectStaff);
  const points = useTxnPointStore((s) => s.points);

  const selected = useMemo(
    () => staff.find((s) => s.id === selectedStaffId) ?? null,
    [staff, selectedStaffId]
  );

  // Suy ra danh sách Mã thôn của cán bộ đang chọn = hợp các Mã thôn của
  // các ĐGD họ phụ trách. Sắp xếp để so sánh ổn định trong useEffect.
  const derivedMaThons = useMemo<string[]>(() => {
    if (!selected) return [];
    const set = new Set<string>();
    for (const maDGD of selected.maDGDs) {
      const p = points.find((x) => x.maDGD === maDGD);
      if (!p) continue;
      for (const t of p.maThons) set.add(t);
    }
    return Array.from(set).sort();
  }, [selected, points]);

  // Đồng bộ filter (source='staff') trên `maThon` theo cán bộ đang chọn.
  // Nếu cán bộ chưa được gán ĐGD/thôn nào, dùng sentinel để loại bỏ toàn
  // bộ (thay vì để mảng rỗng — `applyFilters` bỏ qua mảng rỗng = lọc hết).
  useEffect(() => {
    const existing = filters.find((f) => f.source === 'staff');
    if (selected) {
      const target =
        derivedMaThons.length > 0 ? derivedMaThons : ['__VSPPRO_NO_THON_ASSIGNED__'];
      if (!existing) {
        addFilter({ field: 'maThon', values: target, source: 'staff' });
      } else if (
        existing.values.length !== target.length ||
        existing.values.some((v, i) => v !== target[i])
      ) {
        updateFilter(existing.id, { values: target });
      }
    } else if (existing) {
      removeFilter(existing.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaffId, derivedMaThons.join('|')]);

  // Nếu filter staff bị xóa (vd: clearFilters), reset lựa chọn cán bộ.
  useEffect(() => {
    if (selectedStaffId && !filters.some((f) => f.source === 'staff')) {
      selectStaff(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  if (staff.length === 0) {
    return (
      <Link
        to="/snapshot/can-bo"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-brand-400 dark:hover:text-brand-300"
        title="Chưa có cán bộ — bấm để thêm"
      >
        <UserCircle2 className="h-3.5 w-3.5" />
        Cán bộ…
      </Link>
    );
  }

  const ringClass =
    accent === 'period'
      ? 'focus:border-period-400 focus:ring-period-200'
      : 'focus:border-brand-400 focus:ring-brand-200';

  // Pre-compute số thôn suy ra cho từng cán bộ để hiển thị trong dropdown.
  const thonCountByStaff = new Map<string, number>();
  for (const s of staff) {
    const set = new Set<string>();
    for (const maDGD of s.maDGDs) {
      const p = points.find((x) => x.maDGD === maDGD);
      if (!p) continue;
      for (const t of p.maThons) set.add(t);
    }
    thonCountByStaff.set(s.id, set.size);
  }

  return (
    <div className="relative">
      <UserCircle2 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <select
        value={selectedStaffId ?? ''}
        onChange={(e) => selectStaff(e.target.value || null)}
        className={cn(
          'h-8 rounded-md border border-slate-200 bg-white pl-7 pr-7 text-xs text-slate-700 outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
          ringClass
        )}
        title="Lọc theo cán bộ phụ trách (Mã thôn)"
      >
        <option value="">Cán bộ: tất cả</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.maNV} — {s.tenNV} ({s.maDGDs.length} ĐGD · {thonCountByStaff.get(s.id) ?? 0} thôn)
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Bộ chọn "Điểm giao dịch" — đồng bộ giữa store ĐGD (selectedPointId) và
 * filter (source='txnpoint') trên trường `maThon`. Logic giống
 * `StaffSelector` nhưng ràng buộc theo source riêng để hai bộ chọn dùng
 * cùng lúc và giao thoa (AND) trên cùng trường `maThon`.
 */
function TxnPointSelector({
  filters,
  addFilter,
  updateFilter,
  removeFilter,
  accent,
}: {
  filters: ActiveFilter[];
  addFilter: (f: Omit<ActiveFilter, 'id'>) => void;
  updateFilter: (id: string, patch: Partial<ActiveFilter>) => void;
  removeFilter: (id: string) => void;
  accent: 'brand' | 'period';
}) {
  const points = useTxnPointStore((s) => s.points);
  const selectedPointId = useTxnPointStore((s) => s.selectedPointId);
  const selectPoint = useTxnPointStore((s) => s.selectPoint);

  // Khi đã chọn 1 cán bộ, dropdown ĐGD chỉ hiển thị các ĐGD do cán bộ
  // đó phụ trách (giao thoa Cán bộ → ĐGD). Nếu chưa chọn cán bộ → hiện
  // toàn bộ ĐGD trong danh mục.
  const staff = useStaffStore((s) => s.staff);
  const selectedStaffId = useStaffStore((s) => s.selectedStaffId);

  const visiblePoints = useMemo(() => {
    if (!selectedStaffId) return points;
    const sel = staff.find((s) => s.id === selectedStaffId);
    if (!sel) return points;
    const allow = new Set(sel.maDGDs);
    return points.filter((p) => allow.has(p.maDGD));
  }, [points, staff, selectedStaffId]);

  const selected = useMemo(
    () => points.find((p) => p.id === selectedPointId) ?? null,
    [points, selectedPointId]
  );

  // Nếu ĐGD đang chọn không nằm trong danh sách ĐGD của cán bộ vừa chọn,
  // tự động bỏ chọn ĐGD đó để không sinh ra giao thoa rỗng (filter cứng).
  useEffect(() => {
    if (!selectedPointId || !selectedStaffId) return;
    if (!visiblePoints.some((p) => p.id === selectedPointId)) {
      selectPoint(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaffId, visiblePoints.length]);

  useEffect(() => {
    const existing = filters.find((f) => f.source === 'txnpoint');
    if (selected) {
      const target =
        selected.maThons.length > 0 ? selected.maThons : ['__VSPPRO_NO_THON_ASSIGNED__'];
      if (!existing) {
        addFilter({ field: 'maThon', values: target, source: 'txnpoint' });
      } else if (
        existing.values.length !== target.length ||
        existing.values.some((v, i) => v !== target[i])
      ) {
        updateFilter(existing.id, { values: target });
      }
    } else if (existing) {
      removeFilter(existing.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPointId, selected?.maThons.join('|')]);

  useEffect(() => {
    if (selectedPointId && !filters.some((f) => f.source === 'txnpoint')) {
      selectPoint(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  if (points.length === 0) {
    return (
      <Link
        to="/snapshot/diem-giao-dich"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-brand-400 dark:hover:text-brand-300"
        title="Chưa có Điểm giao dịch — bấm để thêm"
      >
        <MapPin className="h-3.5 w-3.5" />
        ĐGD…
      </Link>
    );
  }

  const ringClass =
    accent === 'period'
      ? 'focus:border-period-400 focus:ring-period-200'
      : 'focus:border-brand-400 focus:ring-brand-200';

  const isFilteredByStaff = !!selectedStaffId;
  const allLabel = isFilteredByStaff
    ? `ĐGD: tất cả của cán bộ (${visiblePoints.length})`
    : 'ĐGD: tất cả';

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <select
        value={selectedPointId ?? ''}
        onChange={(e) => selectPoint(e.target.value || null)}
        disabled={isFilteredByStaff && visiblePoints.length === 0}
        className={cn(
          'h-8 rounded-md border bg-white pl-7 pr-7 text-xs outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800',
          isFilteredByStaff
            ? 'border-brand-300 text-slate-700 dark:border-brand-700 dark:text-slate-200'
            : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200',
          ringClass
        )}
        title={
          isFilteredByStaff
            ? 'Chỉ hiển thị ĐGD của cán bộ đang chọn'
            : 'Lọc theo Điểm giao dịch (Mã thôn)'
        }
      >
        <option value="">{allLabel}</option>
        {visiblePoints.map((p) => (
          <option key={p.id} value={p.id}>
            {p.maDGD} — {p.tenDGD} ({p.maThons.length} thôn)
          </option>
        ))}
        {isFilteredByStaff && visiblePoints.length === 0 && (
          <option value="" disabled>
            Cán bộ chưa được gán ĐGD nào
          </option>
        )}
      </select>
    </div>
  );
}

/**
 * Adapter dành cho ứng dụng "So sánh giữa hai kỳ". Trả về union của
 * `prev.rows + curr.rows` để picker liệt kê đủ giá trị từ cả hai kỳ.
 */
export { useDefaultFilterStore };
