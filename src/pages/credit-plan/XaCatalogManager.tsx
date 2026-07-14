import { useMemo, useState } from 'react';
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ChevronUp,
  ChevronDown,
  Search,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { useIsOwner } from '@/store/useAuthStore';

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-plan-500 focus:outline-none focus:ring-1 focus:ring-plan-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500';

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  );
}

export function XaCatalogManager() {
  const isOwner = useIsOwner();
  const xaCatalog = useCreditPlanStore((s) => s.xaCatalog);
  const plans = useCreditPlanStore((s) => s.plans);
  const addXa = useCreditPlanStore((s) => s.addXa);
  const updateXa = useCreditPlanStore((s) => s.updateXa);
  const deleteXa = useCreditPlanStore((s) => s.deleteXa);
  const moveXa = useCreditPlanStore((s) => s.moveXa);

  // Số dòng kế hoạch đang tham chiếu mỗi mã xã (để cảnh báo khi xóa).
  const planCountByXa = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of plans) m.set(p.maXa, (m.get(p.maXa) ?? 0) + 1);
    return m;
  }, [plans]);

  // Form thêm mới
  const [newMaXa, setNewMaXa] = useState('');
  const [newTenXa, setNewTenXa] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Sửa tại chỗ
  const [editMaXa, setEditMaXa] = useState<string | null>(null);
  const [editTenXa, setEditTenXa] = useState('');

  // Tìm kiếm
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return xaCatalog;
    return xaCatalog.filter(
      (x) => x.maXa.toLowerCase().includes(q) || x.tenXa.toLowerCase().includes(q),
    );
  }, [xaCatalog, query]);

  const handleAdd = () => {
    setAddError(null);
    const maXa = newMaXa.trim();
    const tenXa = newTenXa.trim();
    if (!maXa) return setAddError('Vui lòng nhập Mã xã.');
    if (!tenXa) return setAddError('Vui lòng nhập Tên xã.');
    const ok = addXa({ maXa, tenXa });
    if (!ok) return setAddError(`Mã xã "${maXa}" đã tồn tại trong danh mục.`);
    setNewMaXa('');
    setNewTenXa('');
  };

  const startEdit = (maXa: string, tenXa: string) => {
    setEditMaXa(maXa);
    setEditTenXa(tenXa);
  };
  const cancelEdit = () => {
    setEditMaXa(null);
    setEditTenXa('');
  };
  const saveEdit = () => {
    if (editMaXa && editTenXa.trim()) updateXa(editMaXa, editTenXa);
    cancelEdit();
  };

  const handleDelete = (maXa: string, tenXa: string) => {
    const n = planCountByXa.get(maXa) ?? 0;
    const warn =
      n > 0
        ? `\n\nLưu ý: có ${n} dòng kế hoạch đang dùng xã này. Các dòng đó vẫn giữ nguyên và tên xã cũ, chỉ không còn xuất hiện trong danh mục chọn.`
        : '';
    if (window.confirm(`Xóa xã "${tenXa}" (${maXa}) khỏi danh mục?${warn}`)) {
      deleteXa(maXa);
      if (editMaXa === maXa) cancelEdit();
    }
  };

  const isFiltering = query.trim().length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-plan-700 p-2 text-white shadow-sm">
          <MapPin className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Danh mục xã
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isOwner
              ? 'Thêm, sửa, xóa và sắp xếp các xã dùng trong Kế hoạch tín dụng.'
              : 'Danh sách xã do đơn vị quản lý công bố (chỉ xem).'}
          </p>
        </div>
      </div>

      {/* Form thêm mới — chỉ owner */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Thêm xã mới</CardTitle>
            <CardDescription>
              Mã xã dùng 6 số theo Báo cáo 31 (ví dụ 460092). Mã đã có sẽ không thêm trùng.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
              <div>
                <FieldLabel required>Mã xã</FieldLabel>
                <input
                  className={inputClass}
                  value={newMaXa}
                  onChange={(e) => setNewMaXa(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="460092"
                  inputMode="numeric"
                />
              </div>
              <div>
                <FieldLabel required>Tên xã</FieldLabel>
                <input
                  className={inputClass}
                  value={newTenXa}
                  onChange={(e) => setNewTenXa(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="Định Quán"
                />
              </div>
              <Button
                onClick={handleAdd}
                className="bg-plan-700 hover:bg-plan-800 sm:w-auto"
              >
                <Plus className="h-4 w-4" /> Thêm
              </Button>
            </div>
            {addError && (
              <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{addError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bảng danh mục */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">
            Danh sách xã{' '}
            <span className="font-normal text-slate-400">({xaCatalog.length})</span>
          </CardTitle>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputClass} h-9 w-48 pl-8`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm mã/tên xã…"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                  <th className="w-12 px-3 py-2.5 text-center">STT</th>
                  <th className="px-3 py-2.5 text-left">Mã xã</th>
                  <th className="px-3 py-2.5 text-left">Tên xã</th>
                  <th className="w-24 px-3 py-2.5 text-right">Dòng KH</th>
                  {isOwner && <th className="w-40 px-3 py-2.5 text-center">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isOwner ? 5 : 4}
                      className="px-3 py-8 text-center text-sm text-slate-400"
                    >
                      {isFiltering ? 'Không có xã nào khớp tìm kiếm.' : 'Danh mục xã đang trống.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((x) => {
                    const realIdx = xaCatalog.findIndex((v) => v.maXa === x.maXa);
                    const isEditing = editMaXa === x.maXa;
                    const nPlans = planCountByXa.get(x.maXa) ?? 0;
                    return (
                      <tr
                        key={x.maXa}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400">
                          {realIdx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                          {x.maXa}
                        </td>
                        <td className="px-3 py-2 text-slate-900 dark:text-white">
                          {isEditing ? (
                            <input
                              className={inputClass}
                              value={editTenXa}
                              onChange={(e) => setEditTenXa(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              autoFocus
                            />
                          ) : (
                            x.tenXa
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">
                          {nPlans > 0 ? nPlans : '—'}
                        </td>
                        {isOwner && (
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={saveEdit}
                                    title="Lưu"
                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    title="Hủy"
                                    className="h-8 w-8"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => moveXa(x.maXa, -1)}
                                    disabled={isFiltering || realIdx === 0}
                                    title="Lên"
                                    className="h-8 w-8"
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => moveXa(x.maXa, 1)}
                                    disabled={isFiltering || realIdx === xaCatalog.length - 1}
                                    title="Xuống"
                                    className="h-8 w-8"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => startEdit(x.maXa, x.tenXa)}
                                    title="Sửa tên"
                                    className="h-8 w-8 text-plan-700 hover:text-plan-800 dark:text-plan-300"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDelete(x.maXa, x.tenXa)}
                                    title="Xóa"
                                    className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {isOwner && isFiltering && (
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400 dark:border-slate-800">
              Đang lọc — tắt ô tìm kiếm để sắp xếp thứ tự (lên/xuống).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
