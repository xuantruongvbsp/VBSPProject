import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Save, X, Check, ChevronDown, FileText, ClipboardList, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ColumnFilter } from '@/components/ui/ColumnFilter';
import { useGridFilter } from '@/lib/grid-filter';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { exportPlanGridToXlsx } from '@/lib/export-xlsx';
import { useIsOwner } from '@/store/useAuthStore';
import type { PlanEntry, Decision } from '@/lib/credit-plan-types';
import {
  NGUON_VON_LIST,
  visibleProgramsFor,
  nguonVonLabel,
  nguonVonListLabel,
} from '@/lib/credit-plan-types';

interface BaseForm {
  decisionId: string;
  maXa: string;
  tenXa: string;
  maNguonVon: string;
}

const emptyBase: BaseForm = {
  decisionId: '',
  maXa: '',
  tenXa: '',
  maNguonVon: '',
};

/** maChuongTrinh → soTien */
type SelectedPrograms = Map<string, number>;

function fmtMoney(n: number) {
  return n.toLocaleString('vi-VN');
}

function decisionLabel(d: Decision) {
  const name = d.tenQD ? ` — ${d.tenQD}` : '';
  return `${d.soQD} (${d.ngayQD}) · ${nguonVonListLabel(d.maNguonVonList)}${name}`;
}

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

/** Multi-select dropdown with checkboxes */
function ProgramMultiSelect({
  selected,
  onToggle,
  programsForNV,
}: {
  selected: Set<string>;
  onToggle: (ma: string) => void;
  programsForNV: { ma: string; ten: string }[];
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
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-slate-400 focus:border-plan-500 focus:outline-none focus:ring-1 focus:ring-plan-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:hover:border-slate-500"
      >
        <span className={count === 0 ? 'text-slate-400 dark:text-slate-500' : 'font-medium'}>
          {count === 0 ? '-- Chọn chương trình --' : `${count} chương trình đã chọn`}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {/* Select all / deselect all */}
          <div className="sticky top-0 flex gap-2 border-b border-slate-100 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => programsForNV.forEach((c) => { if (!selected.has(c.ma)) onToggle(c.ma); })}
              className="text-xs font-medium text-plan-700 hover:underline dark:text-plan-300"
            >
              Chọn tất cả
            </button>
            <span className="text-xs text-slate-300 dark:text-slate-600">|</span>
            <button
              type="button"
              onClick={() => programsForNV.forEach((c) => { if (selected.has(c.ma)) onToggle(c.ma); })}
              className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
            >
              Bỏ chọn
            </button>
          </div>
          {programsForNV.map((c) => {
            const checked = selected.has(c.ma);
            return (
              <button
                key={c.ma}
                type="button"
                onClick={() => onToggle(c.ma)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
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
  const { plans, decisions, addPlan, updatePlan, deletePlan } = useCreditPlanStore();
  const xaCatalog = useCreditPlanStore((s) => s.xaCatalog);
  const isOwner = useIsOwner();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [base, setBase] = useState(emptyBase);
  const [programs, setPrograms] = useState<SelectedPrograms>(new Map());
  // For edit mode: single program
  const [editCT, setEditCT] = useState('');
  const [editAmount, setEditAmount] = useState(0);
  const [filterXa, setFilterXa] = useState('');
  const [filterNV, setFilterNV] = useState('');
  const [filterDecision, setFilterDecision] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const decById = useMemo(() => new Map(decisions.map((d) => [d.id, d])), [decisions]);
  const activeDecisions = useMemo(
    () => decisions.filter((d) => d.trangThai !== 'archived'),
    [decisions],
  );
  const selectedDecision = decById.get(base.decisionId);

  /** Chương trình khả dụng theo Nguồn vốn đang chọn của dòng kế hoạch. */
  const programsForNV = visibleProgramsFor(base.maNguonVon);

  const handleDecisionChange = (decisionId: string) => {
    const dec = decById.get(decisionId);
    // Nếu QĐ chỉ có 1 NV → tự chọn; nếu có nhiều hơn → reset để user chủ động chọn.
    const autoNV = dec && dec.maNguonVonList.length === 1 ? dec.maNguonVonList[0] : '';
    const nextList = visibleProgramsFor(autoNV);
    const allowed = new Set(nextList.map((c) => c.ma));
    setBase((f) => ({ ...f, decisionId, maNguonVon: autoNV }));
    setPrograms((prev) => {
      const next = new Map<string, number>();
      for (const [ma, amt] of prev) if (allowed.has(ma)) next.set(ma, amt);
      return next;
    });
    if (editCT && !allowed.has(editCT)) setEditCT('');
  };

  const handleNVChange = (maNguonVon: string) => {
    const nextList = visibleProgramsFor(maNguonVon);
    const allowed = new Set(nextList.map((c) => c.ma));
    setBase((f) => ({ ...f, maNguonVon }));
    setPrograms((prev) => {
      const next = new Map<string, number>();
      for (const [ma, amt] of prev) if (allowed.has(ma)) next.set(ma, amt);
      return next;
    });
    if (editCT && !allowed.has(editCT)) setEditCT('');
  };

  const resetForm = () => {
    setBase(emptyBase);
    setPrograms(new Map());
    setEditId(null);
    setEditCT('');
    setEditAmount(0);
    setFormError(null);
    setShowForm(false);
  };

  const handleXaChange = (maXa: string) => {
    const xa = xaCatalog.find((x) => x.maXa === maXa);
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
    setFormError(null);
    if (!base.decisionId) return setFormError('Vui lòng chọn Quyết định.');
    if (!base.maNguonVon) return setFormError('Vui lòng chọn Nguồn vốn.');
    if (!base.maXa) return setFormError('Vui lòng chọn Xã.');
    if (programs.size === 0) return setFormError('Vui lòng chọn ít nhất 1 chương trình.');

    const nonZero = Array.from(programs.entries()).filter(([, v]) => v !== 0);
    if (nonZero.length === 0) return setFormError('Các dòng có số tiền = 0 sẽ không được lưu. Vui lòng nhập số tiền.');

    // Bỏ qua dòng = 0; cho phép số âm (điều chỉnh giảm).
    for (const [maCT, soTien] of nonZero) {
      const ct = programsForNV.find((c) => c.ma === maCT);
      addPlan({
        id: crypto.randomUUID(),
        decisionId: base.decisionId,
        maXa: base.maXa,
        tenXa: base.tenXa,
        maNguonVon: base.maNguonVon,
        maChuongTrinh: maCT,
        tenChuongTrinh: ct?.ten ?? '',
        soTien,
      });
    }
    resetForm();
  };

  const handleSubmitEdit = () => {
    setFormError(null);
    if (!editId) return;
    if (!base.decisionId) return setFormError('Vui lòng chọn Quyết định.');
    if (!base.maNguonVon) return setFormError('Vui lòng chọn Nguồn vốn.');
    if (!base.maXa) return setFormError('Vui lòng chọn Xã.');
    if (!editCT) return setFormError('Vui lòng chọn Chương trình.');
    if (editAmount === 0) return setFormError('Số tiền = 0 không được lưu. Vui lòng nhập giá trị khác 0.');
    const ct = programsForNV.find((c) => c.ma === editCT);
    updatePlan(editId, {
      decisionId: base.decisionId,
      maXa: base.maXa,
      tenXa: base.tenXa,
      maNguonVon: base.maNguonVon,
      maChuongTrinh: editCT,
      tenChuongTrinh: ct?.ten ?? '',
      soTien: editAmount,
    });
    resetForm();
  };

  const startEdit = (p: PlanEntry) => {
    setEditId(p.id);
    setBase({
      decisionId: p.decisionId,
      maXa: p.maXa,
      tenXa: p.tenXa,
      maNguonVon: p.maNguonVon,
    });
    setEditCT(p.maChuongTrinh);
    setEditAmount(p.soTien);
    setShowForm(true);
  };

  const preFiltered = plans.filter((p) => {
    if (filterXa && p.maXa !== filterXa) return false;
    if (filterNV && p.maNguonVon !== filterNV) return false;
    if (filterDecision && p.decisionId !== filterDecision) return false;
    return true;
  });

  // Excel-style column filters
  const grid = useGridFilter(preFiltered, {
    soQD: (p) => decById.get(p.decisionId)?.soQD ?? '',
    ngayQD: (p) => decById.get(p.decisionId)?.ngayQD ?? '',
    xa: (p) => p.tenXa,
    nguonVon: (p) => nguonVonLabel(p.maNguonVon),
    chuongTrinh: (p) => p.tenChuongTrinh,
  });
  // Sắp xếp theo Ngày QĐ (cũ nhất lên trước). ngayQD dạng YYYY-MM-DD nên so sánh chuỗi đúng thứ tự.
  const filtered = useMemo(
    () =>
      [...grid.filtered].sort((a, b) =>
        (decById.get(a.decisionId)?.ngayQD ?? '').localeCompare(decById.get(b.decisionId)?.ngayQD ?? ''),
      ),
    [grid.filtered, decById],
  );

  const handleExport = () => {
    const decXa = xaCatalog.find((x) => x.maXa === filterXa);
    const decNV = NGUON_VON_LIST.find((n) => n.ma === filterNV);
    const decQD = decById.get(filterDecision);
    const filterSummary = [
      decQD ? `QĐ ${decQD.soQD} (${decQD.ngayQD})` : 'Tất cả Quyết định',
      decXa ? decXa.tenXa : 'Tất cả xã',
      decNV ? decNV.ten : 'Tất cả nguồn vốn',
    ].join(' · ');
    void exportPlanGridToXlsx({
      rows: filtered.map((p) => {
        const dec = decById.get(p.decisionId);
        return {
          soQD: dec?.soQD ?? '',
          ngayQD: dec?.ngayQD ?? '',
          tenXa: p.tenXa,
          nguonVon: nguonVonLabel(p.maNguonVon),
          tenChuongTrinh: p.tenChuongTrinh,
          soTien: p.soTien,
        };
      }),
      filterSummary,
    });
  };

  const totalPlan = plans.reduce((s, p) => s + p.soTien, 0);
  const selectedSet = new Set(programs.keys());
  const sortedSelected = programsForNV.filter((c) => programs.has(c.ma));

  const hasDecisions = decisions.length > 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Kế hoạch tín dụng</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Quản lý danh mục kế hoạch dư nợ theo Quyết định
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Xuất Excel
          </Button>
          {isOwner && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} disabled={!hasDecisions}>
              <Plus className="h-4 w-4" /> Thêm mục
            </Button>
          )}
        </div>
      </div>

      {!hasDecisions && (
        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-900/10">
          <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-[200px] text-slate-700 dark:text-slate-200">
              <div className="font-medium">Chưa có Quyết định nào</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Hãy tạo QĐ trước khi nhập dòng kế hoạch.
              </div>
            </div>
            <Link
              to="/credit-plan/decisions"
              className="inline-flex items-center gap-1 rounded-md bg-plan-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-plan-800"
            >
              Đi tới Quyết định
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tổng kế hoạch</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-plan-700 dark:text-plan-300">
              {fmtMoney(totalPlan)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">triệu đồng</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Số mục</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{plans.length}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">dòng kế hoạch</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Số Quyết định</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{decisions.length}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">quyết định</div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editId ? 'Sửa mục kế hoạch' : 'Thêm mục kế hoạch'}</CardTitle>
            <CardDescription>
              {editId
                ? 'Điều chỉnh thông tin dòng kế hoạch đã có.'
                : 'Chọn QĐ, xã, nguồn vốn và các chương trình để thêm nhiều dòng cùng lúc.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Phạm vi kế hoạch
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <FieldLabel required>Quyết định</FieldLabel>
                  <select
                    className={inputClass}
                    value={base.decisionId}
                    onChange={(e) => handleDecisionChange(e.target.value)}
                  >
                    <option value="">-- Chọn Quyết định --</option>
                    {activeDecisions.map((d) => (
                      <option key={d.id} value={d.id}>{decisionLabel(d)}</option>
                    ))}
                  </select>
                  {selectedDecision && (
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      QĐ áp dụng: <span className="font-medium text-slate-700 dark:text-slate-300">{nguonVonListLabel(selectedDecision.maNguonVonList)}</span>
                    </div>
                  )}
                </div>
                <div>
                  <FieldLabel required>Nguồn vốn</FieldLabel>
                  {selectedDecision && selectedDecision.maNguonVonList.length === 1 ? (
                    <div className="flex h-[38px] items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {nguonVonLabel(selectedDecision.maNguonVonList[0])}
                    </div>
                  ) : (
                    <select
                      className={inputClass}
                      value={base.maNguonVon}
                      onChange={(e) => handleNVChange(e.target.value)}
                      disabled={!selectedDecision}
                    >
                      <option value="">-- Chọn nguồn vốn --</option>
                      {(selectedDecision?.maNguonVonList ?? []).map((nv) => (
                        <option key={nv} value={nv}>{nguonVonLabel(nv)}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <FieldLabel required>Xã</FieldLabel>
                  <select
                    className={inputClass}
                    value={base.maXa}
                    onChange={(e) => handleXaChange(e.target.value)}
                  >
                    <option value="">-- Chọn xã --</option>
                    {xaCatalog.map((x) => (
                      <option key={x.maXa} value={x.maXa}>{x.tenXa} ({x.maXa})</option>
                    ))}
                  </select>
                </div>
                {/* Program selection */}
                <div className="md:col-span-3">
                  <FieldLabel required>Chương trình</FieldLabel>
                  {editId ? (
                    <select
                      className={inputClass}
                      value={editCT}
                      onChange={(e) => setEditCT(e.target.value)}
                    >
                      <option value="">-- Chọn chương trình --</option>
                      {programsForNV.map((c) => (
                        <option key={c.ma} value={c.ma}>{c.ten}</option>
                      ))}
                    </select>
                  ) : (
                    <ProgramMultiSelect selected={selectedSet} onToggle={toggleProgram} programsForNV={programsForNV} />
                  )}
                </div>
              </div>
            </div>

            {/* Edit mode: single amount */}
            {editId && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Số tiền
                </div>
                <div className="max-w-xs">
                  <FieldLabel required>Số tiền (triệu đồng)</FieldLabel>
                  <input
                    type="number"
                    className={`${inputClass} text-right font-mono`}
                    value={editAmount || ''}
                    onChange={(e) => setEditAmount(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}

            {/* Add mode: amount per selected program */}
            {!editId && sortedSelected.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Số tiền từng chương trình (triệu đồng)
                </div>
                <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <th className="px-3 py-2 text-left">Chương trình</th>
                        <th className="w-48 px-3 py-2 text-right">Số tiền (tr.đ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSelected.map((c, idx) => (
                        <tr
                          key={c.ma}
                          className={`border-b border-slate-100 last:border-b-0 dark:border-slate-700/60 ${
                            idx % 2 === 1 ? 'bg-slate-50/40 dark:bg-slate-800/30' : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{c.ten}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              className={`${inputClass} px-3 py-1.5 text-right font-mono`}
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
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">Tổng</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                            {fmtMoney(Array.from(programs.values()).reduce((s, v) => s + v, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {formError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
                {formError}
              </div>
            )}

            <div className="flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
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
      <div className="flex flex-wrap gap-2">
        <select
          className={`${inputClass} h-9 w-auto`}
          value={filterDecision}
          onChange={(e) => setFilterDecision(e.target.value)}
        >
          <option value="">Tất cả Quyết định</option>
          {decisions.map((d) => (
            <option key={d.id} value={d.id}>{d.soQD} ({d.ngayQD})</option>
          ))}
        </select>
        <select
          className={`${inputClass} h-9 w-auto`}
          value={filterXa}
          onChange={(e) => setFilterXa(e.target.value)}
        >
          <option value="">Tất cả xã</option>
          {xaCatalog.map((x) => (
            <option key={x.maXa} value={x.maXa}>{x.tenXa}</option>
          ))}
        </select>
        <select
          className={`${inputClass} h-9 w-auto`}
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
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <th className="px-4 py-3"><span className="inline-flex items-center">Số QĐ<ColumnFilter label="Lọc theo Số QĐ" values={grid.distinctValues.soQD} selected={grid.filters.soQD} onApply={(s) => grid.setFilter('soQD', s)} /></span></th>
                  <th className="px-4 py-3"><span className="inline-flex items-center">Ngày QĐ<ColumnFilter label="Lọc theo Ngày QĐ" values={grid.distinctValues.ngayQD} selected={grid.filters.ngayQD} onApply={(s) => grid.setFilter('ngayQD', s)} /></span></th>
                  <th className="px-4 py-3"><span className="inline-flex items-center">Xã<ColumnFilter label="Lọc theo Xã" values={grid.distinctValues.xa} selected={grid.filters.xa} onApply={(s) => grid.setFilter('xa', s)} /></span></th>
                  <th className="px-4 py-3"><span className="inline-flex items-center">Nguồn vốn<ColumnFilter label="Lọc theo Nguồn vốn" values={grid.distinctValues.nguonVon} selected={grid.filters.nguonVon} onApply={(s) => grid.setFilter('nguonVon', s)} /></span></th>
                  <th className="px-4 py-3"><span className="inline-flex items-center">Chương trình<ColumnFilter label="Lọc theo Chương trình" values={grid.distinctValues.chuongTrinh} selected={grid.filters.chuongTrinh} onApply={(s) => grid.setFilter('chuongTrinh', s)} /></span></th>
                  <th className="px-4 py-3 text-right">Số tiền (tr.đ)</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
                          <ClipboardList className="h-6 w-6 text-slate-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            {plans.length === 0 ? 'Chưa có mục kế hoạch nào' : 'Không có kết quả phù hợp'}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {plans.length === 0
                              ? 'Nhấn "Thêm mục" để bắt đầu nhập kế hoạch dư nợ.'
                              : 'Thử thay đổi bộ lọc phía trên.'}
                          </div>
                        </div>
                        {plans.length === 0 && hasDecisions && isOwner && (
                          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                            <Plus className="h-3.5 w-3.5" /> Thêm mục
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p, idx) => {
                    const dec = decById.get(p.decisionId);
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/50 ${
                          idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                          {dec?.soQD ?? <span className="text-rose-500">(mất QĐ)</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 dark:text-slate-300">{dec?.ngayQD ?? ''}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{p.tenXa}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{nguonVonLabel(p.maNguonVon)}</td>
                        <td className="max-w-[260px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300" title={p.tenChuongTrinh}>
                          {p.tenChuongTrinh}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">{fmtMoney(p.soTien)}</td>
                        <td className="px-4 py-2.5">
                          {isOwner ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => startEdit(p)}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700"
                                title="Sửa"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => deletePlan(p.id)}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700"
                                title="Xóa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800">
                    <td colSpan={5} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">Tổng cộng</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-white">
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
