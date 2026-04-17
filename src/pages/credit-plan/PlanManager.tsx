import { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, Save, X, Check, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import type { PlanEntry } from '@/lib/credit-plan-types';
import {
  XA_LIST,
  NGUON_VON_LIST,
  CHUONG_TRINH_LIST,
  CHUONG_TRINH_VISIBLE,
  nguonVonLabel,
} from '@/lib/credit-plan-types';

interface BaseForm {
  soQD: string;
  ngayQD: string;
  tenQD: string;
  maXa: string;
  tenXa: string;
  maNguonVon: string;
}

const emptyBase: BaseForm = {
  soQD: '',
  ngayQD: '',
  tenQD: '',
  maXa: '',
  tenXa: '',
  maNguonVon: '',
};

/** maChuongTrinh → soTien */
type SelectedPrograms = Map<string, number>;

function fmtMoney(n: number) {
  return n.toLocaleString('vi-VN');
}

/** Multi-select dropdown with checkboxes */
function ProgramMultiSelect({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (ma: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const count = selected.size;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
      >
        <span className={count === 0 ? 'text-slate-400' : ''}>
          {count === 0 ? '-- Chọn chương trình --' : `${count} chương trình đã chọn`}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {/* Select all / deselect all */}
          <div className="flex gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => CHUONG_TRINH_VISIBLE.forEach((c) => { if (!selected.has(c.ma)) onToggle(c.ma); })}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Chọn tất cả
            </button>
            <span className="text-xs text-slate-300">|</span>
            <button
              type="button"
              onClick={() => CHUONG_TRINH_VISIBLE.forEach((c) => { if (selected.has(c.ma)) onToggle(c.ma); })}
              className="text-xs font-medium text-slate-500 hover:underline"
            >
              Bỏ chọn
            </button>
          </div>
          {CHUONG_TRINH_VISIBLE.map((c) => {
            const checked = selected.has(c.ma);
            return (
              <button
                key={c.ma}
                type="button"
                onClick={() => onToggle(c.ma)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked
                      ? 'border-plan-600 bg-plan-600 text-white'
                      : 'border-slate-300 dark:border-slate-500'
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="text-slate-700 dark:text-slate-200">{c.ten}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PlanManager() {
  const { plans, addPlan, updatePlan, deletePlan } = useCreditPlanStore();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [base, setBase] = useState(emptyBase);
  const [programs, setPrograms] = useState<SelectedPrograms>(new Map());
  // For edit mode: single program
  const [editCT, setEditCT] = useState('');
  const [editAmount, setEditAmount] = useState(0);
  const [filterXa, setFilterXa] = useState('');
  const [filterNV, setFilterNV] = useState('');

  const resetForm = () => {
    setBase(emptyBase);
    setPrograms(new Map());
    setEditId(null);
    setEditCT('');
    setEditAmount(0);
    setShowForm(false);
  };

  const handleXaChange = (maXa: string) => {
    const xa = XA_LIST.find((x) => x.maXa === maXa);
    setBase((f) => ({ ...f, maXa, tenXa: xa?.tenXa ?? '' }));
  };

  const toggleProgram = (ma: string) => {
    setPrograms((prev) => {
      const next = new Map(prev);
      if (next.has(ma)) next.delete(ma);
      else next.set(ma, 0);
      return next;
    });
  };

  const setProgramAmount = (ma: string, amount: number) => {
    setPrograms((prev) => {
      const next = new Map(prev);
      next.set(ma, amount);
      return next;
    });
  };

  const handleSubmitAdd = () => {
    if (!base.soQD || !base.maXa || !base.maNguonVon || programs.size === 0) return;
    // Check at least one amount > 0
    const hasAmount = Array.from(programs.values()).some((v) => v > 0);
    if (!hasAmount) return;

    for (const [maCT, soTien] of programs.entries()) {
      if (soTien <= 0) continue;
      const ct = CHUONG_TRINH_VISIBLE.find((c) => c.ma === maCT);
      addPlan({
        id: crypto.randomUUID(),
        ...base,
        maChuongTrinh: maCT,
        tenChuongTrinh: ct?.ten ?? '',
        soTien,
      });
    }
    resetForm();
  };

  const handleSubmitEdit = () => {
    if (!editId || !base.soQD || !base.maXa || !base.maNguonVon || !editCT || !editAmount) return;
    const ct = CHUONG_TRINH_VISIBLE.find((c) => c.ma === editCT);
    updatePlan(editId, {
      ...base,
      maChuongTrinh: editCT,
      tenChuongTrinh: ct?.ten ?? '',
      soTien: editAmount,
    });
    resetForm();
  };

  const startEdit = (p: PlanEntry) => {
    setEditId(p.id);
    setBase({
      soQD: p.soQD,
      ngayQD: p.ngayQD,
      tenQD: p.tenQD,
      maXa: p.maXa,
      tenXa: p.tenXa,
      maNguonVon: p.maNguonVon,
    });
    setEditCT(p.maChuongTrinh);
    setEditAmount(p.soTien);
    setShowForm(true);
  };

  const filtered = plans.filter((p) => {
    if (filterXa && p.maXa !== filterXa) return false;
    if (filterNV && p.maNguonVon !== filterNV) return false;
    return true;
  });

  const byQD = new Map<string, { tenQD: string; ngayQD: string; total: number; count: number }>();
  for (const p of plans) {
    const existing = byQD.get(p.soQD);
    if (existing) {
      existing.total += p.soTien;
      existing.count++;
    } else {
      byQD.set(p.soQD, { tenQD: p.tenQD, ngayQD: p.ngayQD, total: p.soTien, count: 1 });
    }
  }

  const totalPlan = plans.reduce((s, p) => s + p.soTien, 0);
  const selectedSet = new Set(programs.keys());

  // Sorted selected programs for the amount entry table
  const sortedSelected = CHUONG_TRINH_VISIBLE.filter((c) => programs.has(c.ma));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Kế hoạch tín dụng</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Quản lý danh mục kế hoạch dư nợ theo quyết định
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Thêm mục
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tổng kế hoạch</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {fmtMoney(totalPlan)}
            </div>
            <div className="text-xs text-slate-500">triệu đồng</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Số mục</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{plans.length}</div>
            <div className="text-xs text-slate-500">dòng kế hoạch</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Số Quyết định</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{byQD.size}</div>
            <div className="text-xs text-slate-500">quyết định</div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editId ? 'Sửa mục kế hoạch' : 'Thêm mục kế hoạch'}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Common fields */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Số QĐ</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={base.soQD}
                  onChange={(e) => setBase((f) => ({ ...f, soQD: e.target.value }))}
                  placeholder="VD: 64"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Ngày QĐ</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={base.ngayQD}
                  onChange={(e) => setBase((f) => ({ ...f, ngayQD: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Tên QĐ</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={base.tenQD}
                  onChange={(e) => setBase((f) => ({ ...f, tenQD: e.target.value }))}
                  placeholder="Kế hoạch dư nợ năm 2026"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Xã</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={base.maXa}
                  onChange={(e) => handleXaChange(e.target.value)}
                >
                  <option value="">-- Chọn xã --</option>
                  {XA_LIST.map((x) => (
                    <option key={x.maXa} value={x.maXa}>{x.tenXa} ({x.maXa})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nguồn vốn</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={base.maNguonVon}
                  onChange={(e) => setBase((f) => ({ ...f, maNguonVon: e.target.value }))}
                >
                  <option value="">-- Chọn nguồn vốn --</option>
                  {NGUON_VON_LIST.map((n) => (
                    <option key={n.ma} value={n.ma}>{n.ten}</option>
                  ))}
                </select>
              </div>
              {/* Program selection */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Chương trình</label>
                {editId ? (
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    value={editCT}
                    onChange={(e) => setEditCT(e.target.value)}
                  >
                    <option value="">-- Chọn chương trình --</option>
                    {CHUONG_TRINH_VISIBLE.map((c) => (
                      <option key={c.ma} value={c.ma}>{c.ten}</option>
                    ))}
                  </select>
                ) : (
                  <ProgramMultiSelect selected={selectedSet} onToggle={toggleProgram} />
                )}
              </div>
            </div>

            {/* Edit mode: single amount */}
            {editId && (
              <div className="mt-4 max-w-xs">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Số tiền (triệu đồng)</label>
                <input
                  type="number"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={editAmount || ''}
                  onChange={(e) => setEditAmount(Number(e.target.value) || 0)}
                />
              </div>
            )}

            {/* Add mode: amount per selected program */}
            {!editId && sortedSelected.length > 0 && (
              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Số tiền từng chương trình (triệu đồng)
                </label>
                <div className="rounded-md border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                        <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Chương trình</th>
                        <th className="w-48 px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Số tiền (tr.đ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSelected.map((c) => (
                        <tr key={c.ma} className="border-b border-slate-100 dark:border-slate-700">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{c.ten}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-right text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                              value={programs.get(c.ma) || ''}
                              onChange={(e) => setProgramAmount(c.ma, Number(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {sortedSelected.length > 1 && (
                      <tfoot>
                        <tr className="border-t border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
                          <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">Tổng</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 dark:text-white">
                            {fmtMoney(Array.from(programs.values()).reduce((s, v) => s + v, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Button onClick={editId ? handleSubmitEdit : handleSubmitAdd}>
                <Save className="h-4 w-4" /> {editId ? 'Cập nhật' : 'Lưu'}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="h-4 w-4" /> Hủy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          value={filterXa}
          onChange={(e) => setFilterXa(e.target.value)}
        >
          <option value="">Tất cả xã</option>
          {XA_LIST.map((x) => (
            <option key={x.maXa} value={x.maXa}>{x.tenXa}</option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          value={filterNV}
          onChange={(e) => setFilterNV(e.target.value)}
        >
          <option value="">Tất cả nguồn vốn</option>
          {NGUON_VON_LIST.map((n) => (
            <option key={n.ma} value={n.ma}>{n.ten}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Số QĐ</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Ngày QĐ</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Tên QĐ</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Xã</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Nguồn vốn</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Chương trình</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Số tiền (tr.đ)</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Chưa có mục kế hoạch nào. Nhấn "Thêm mục" để bắt đầu.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{p.soQD}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.ngayQD}</td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.tenQD}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.tenXa}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{nguonVonLabel(p.maNguonVon)}</td>
                      <td className="max-w-[250px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.tenChuongTrinh}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-900 dark:text-white">{fmtMoney(p.soTien)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(p)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deletePlan(p.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800">
                    <td colSpan={6} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">Tổng cộng</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-900 dark:text-white">
                      {fmtMoney(filtered.reduce((s, p) => s + p.soTien, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
