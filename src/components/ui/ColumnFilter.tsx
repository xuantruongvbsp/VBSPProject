import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Filter, FilterX, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnFilterProps {
  /** Toàn bộ giá trị duy nhất xuất hiện trong cột (chuỗi đã chuẩn hoá để hiển thị). */
  values: string[];
  /** Tập giá trị đang được chọn. Rỗng (size=0) ⇒ "không lọc" (hiển thị tất cả). */
  selected: Set<string>;
  /** Callback khi user thay đổi tập chọn. */
  onApply: (next: Set<string>) => void;
  /** Vị trí popover so với button (mặc định 'start'). */
  align?: 'start' | 'center' | 'end';
  /** Nhãn tooltip cho icon (VD "Lọc theo Xã"). */
  label?: string;
}

/**
 * Nút funnel dạng Excel: bấm để mở popover chứa search + danh sách checkbox đa-chọn.
 * - Khi `selected.size === 0`: coi như "không lọc" → icon nhạt.
 * - Khi `selected.size > 0` & < tổng: icon active → cho biết cột đang bị lọc.
 * - "Chọn tất cả" / "Bỏ chọn" / "Xoá lọc cột này" thao tác nhanh.
 */
export function ColumnFilter({
  values,
  selected,
  onApply,
  align = 'start',
  label = 'Lọc',
}: ColumnFilterProps) {
  const [search, setSearch] = useState('');
  const isActive = selected.size > 0;

  const filteredValues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return values;
    return values.filter((v) => v.toLowerCase().includes(q));
  }, [values, search]);

  const toggleValue = (v: string) => {
    // Nếu chưa lọc (selected rỗng): khi user bỏ tick 1 mục → set = mọi giá trị KHÁC mục đó.
    // Nếu đang lọc: toggle bình thường.
    if (selected.size === 0) {
      const next = new Set(values);
      next.delete(v);
      onApply(next);
      return;
    }
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    // Nếu sau toggle mà bằng tổng giá trị → coi như "không lọc"
    if (next.size === values.length) onApply(new Set());
    else onApply(next);
  };

  const selectAll = () => onApply(new Set());
  const selectNone = () => onApply(new Set(['__none__'])); // đảm bảo không trùng giá trị thật → ẩn hết
  const clear = () => onApply(new Set());

  // Hàm tiện: 1 giá trị có "tick" hay không
  const isChecked = (v: string) => (selected.size === 0 ? true : selected.has(v));

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={(e) => {
            e.stopPropagation();
            setSearch('');
          }}
          className={cn(
            'ml-1 inline-flex h-5 w-5 items-center justify-center rounded transition-colors',
            isActive
              ? 'bg-plan-100 text-plan-700 ring-1 ring-plan-300 dark:bg-plan-900/40 dark:text-plan-300 dark:ring-plan-700'
              : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300'
          )}
        >
          {isActive ? <FilterX className="h-3 w-3" /> : <Filter className="h-3 w-3" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={4}
          collisionPadding={8}
          className="z-50 w-64 rounded-md border border-slate-200 bg-white p-2 shadow-lg outline-none dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Search box */}
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm..."
              className="w-full rounded border border-slate-200 bg-white py-1 pl-7 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-plan-500 focus:outline-none focus:ring-1 focus:ring-plan-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
              autoFocus
            />
          </div>
          {/* Quick actions */}
          <div className="mb-1.5 flex items-center justify-between gap-2 px-1 text-[11px]">
            <button
              type="button"
              onClick={selectAll}
              className="font-medium text-plan-700 hover:underline dark:text-plan-300"
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              onClick={selectNone}
              className="font-medium text-slate-500 hover:underline dark:text-slate-400"
            >
              Bỏ chọn
            </button>
            {isActive && (
              <button
                type="button"
                onClick={clear}
                className="font-medium text-rose-600 hover:underline dark:text-rose-400"
              >
                Xoá lọc
              </button>
            )}
          </div>
          {/* Checkbox list */}
          <div className="max-h-64 overflow-y-auto rounded border border-slate-100 dark:border-slate-700">
            {filteredValues.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs italic text-slate-400">
                Không tìm thấy
              </div>
            ) : (
              filteredValues.map((v) => (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={isChecked(v)}
                    onChange={() => toggleValue(v)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-plan-600 focus:ring-plan-500"
                  />
                  <span className="flex-1 truncate" title={v || '(trống)'}>
                    {v || <span className="italic text-slate-400">(trống)</span>}
                  </span>
                </label>
              ))
            )}
          </div>
          {/* Footer count */}
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 px-1 pt-1.5 text-[10px] text-slate-400 dark:border-slate-700">
            <span>{values.length} giá trị</span>
            {isActive && (
              <span className="font-medium text-plan-600 dark:text-plan-400">
                Đang lọc: {selected.size === 1 && selected.has('__none__') ? 0 : selected.size}
              </span>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
