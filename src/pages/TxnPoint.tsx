import { useMemo, useRef, useState } from 'react';
import {
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
  Download,
  Upload,
  Search,
  Check,
  AlertTriangle,
  Copy,
  ChevronDown,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useDataStore } from '@/store/useDataStore';
import {
  useTxnPointStore,
  exportTxnPointJson,
  parseTxnPointJson,
} from '@/store/useTxnPointStore';
import { useIsOwner } from '@/store/useAuthStore';
import { fmtCompact } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TxnPointRecord } from '@/lib/types';

interface ThonOption {
  maThon: string;
  tenThon: string;
  maXa: string;
  tenXa: string;
}

interface ThonStat extends ThonOption {
  loanCount: number;
  tongDuNo: number;
}

interface DuplicateRow {
  maThon: string;
  tenThon: string;
  tenXa: string;
  points: TxnPointRecord[];
}

/**
 * Trang quản lý "Điểm giao dịch" (ĐGD) — danh sách + form thêm/sửa +
 * import/export JSON + bảng kiểm soát phủ thôn. Mỗi ĐGD bao gồm nhiều
 * Mã thôn (cấp dưới của Xã).
 */
export function TxnPointPage() {
  const rows = useDataStore((s) => s.rows);
  const points = useTxnPointStore((s) => s.points);
  const addPoint = useTxnPointStore((s) => s.addPoint);
  const updatePoint = useTxnPointStore((s) => s.updatePoint);
  const removePoint = useTxnPointStore((s) => s.removePoint);
  const importPoints = useTxnPointStore((s) => s.importPoints);
  const isOwner = useIsOwner();

  const thonStats = useMemo<ThonStat[]>(() => {
    const map = new Map<string, ThonStat>();
    for (const r of rows) {
      const ma = (r.maThon ?? '').trim();
      if (!ma) continue;
      const existing = map.get(ma);
      if (existing) {
        existing.loanCount += 1;
        existing.tongDuNo += r.tongDuNo;
      } else {
        map.set(ma, {
          maThon: ma,
          tenThon: (r.tenThon ?? '').trim(),
          maXa: (r.maXa ?? '').trim(),
          tenXa: (r.tenXa ?? '').trim(),
          loanCount: 1,
          tongDuNo: r.tongDuNo,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.maThon.localeCompare(b.maThon));
  }, [rows]);

  const thonOptions = useMemo<ThonOption[]>(
    () =>
      thonStats.map((s) => ({
        maThon: s.maThon,
        tenThon: s.tenThon,
        maXa: s.maXa,
        tenXa: s.tenXa,
      })),
    [thonStats]
  );

  const assignmentMap = useMemo(() => {
    const m = new Map<string, TxnPointRecord[]>();
    for (const p of points) {
      for (const t of p.maThons) {
        const list = m.get(t);
        if (list) list.push(p);
        else m.set(t, [p]);
      }
    }
    return m;
  }, [points]);

  const unassignedThons = useMemo<ThonStat[]>(
    () => thonStats.filter((t) => !assignmentMap.has(t.maThon)),
    [thonStats, assignmentMap]
  );

  const duplicateRows = useMemo<DuplicateRow[]>(() => {
    const out: DuplicateRow[] = [];
    const thonInfo = new Map(thonStats.map((t) => [t.maThon, t]));
    for (const [ma, list] of assignmentMap.entries()) {
      if (list.length < 2) continue;
      const info = thonInfo.get(ma);
      out.push({
        maThon: ma,
        tenThon: info?.tenThon ?? '',
        tenXa: info?.tenXa ?? '',
        points: list,
      });
    }
    out.sort((a, b) => a.maThon.localeCompare(b.maThon));
    return out;
  }, [assignmentMap, thonStats]);

  const orphanAssignedThons = useMemo<string[]>(() => {
    if (rows.length === 0) return [];
    const inBc31 = new Set(thonStats.map((t) => t.maThon));
    const out: string[] = [];
    for (const ma of assignmentMap.keys()) {
      if (!inBc31.has(ma)) out.push(ma);
    }
    return out.sort();
  }, [assignmentMap, thonStats, rows.length]);

  const assignedInBc31Count = thonStats.length - unassignedThons.length;

  const [editing, setEditing] = useState<TxnPointRecord | null>(null);
  const [draft, setDraft] = useState<{ maDGD: string; tenDGD: string; maThons: string[] } | null>(
    null
  );
  const [search, setSearch] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return points;
    return points.filter(
      (p) =>
        p.maDGD.toLowerCase().includes(q) ||
        p.tenDGD.toLowerCase().includes(q) ||
        p.maThons.some((t) => t.toLowerCase().includes(q))
    );
  }, [points, search]);

  function startAdd() {
    setEditing(null);
    setDraft({ maDGD: '', tenDGD: '', maThons: [] });
  }

  function startEdit(rec: TxnPointRecord) {
    setEditing(rec);
    setDraft({ maDGD: rec.maDGD, tenDGD: rec.tenDGD, maThons: [...rec.maThons] });
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(null);
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.maDGD.trim()) {
      alert('Vui lòng nhập Mã ĐGD.');
      return;
    }
    if (!draft.tenDGD.trim()) {
      alert('Vui lòng nhập Tên ĐGD.');
      return;
    }
    if (editing) {
      updatePoint(editing.id, {
        maDGD: draft.maDGD,
        tenDGD: draft.tenDGD,
        maThons: draft.maThons,
      });
    } else {
      if (points.some((p) => p.maDGD.trim() === draft.maDGD.trim())) {
        if (!confirm(`Mã ĐGD "${draft.maDGD}" đã tồn tại. Vẫn thêm dòng mới?`)) return;
      }
      addPoint({
        maDGD: draft.maDGD,
        tenDGD: draft.tenDGD,
        maThons: draft.maThons,
      });
    }
    cancelEdit();
  }

  function handleDelete(rec: TxnPointRecord) {
    if (confirm(`Xóa Điểm giao dịch "${rec.maDGD} — ${rec.tenDGD}"?`)) {
      removePoint(rec.id);
      if (editing?.id === rec.id) cancelEdit();
    }
  }

  function handleExport() {
    const json = exportTxnPointJson(points);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diem-giao-dich-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const records = parseTxnPointJson(text);
      const mode = points.length === 0
        ? 'replace'
        : confirm(
            `Tìm thấy ${records.length} điểm giao dịch trong tệp. Bấm OK để GỘP (trùng Mã ĐGD sẽ bị ghi đè), bấm Hủy để THAY THẾ toàn bộ.`
          )
          ? 'merge'
          : 'replace';
      importPoints(records, mode);
      alert(`Đã import ${records.length} điểm giao dịch (${mode === 'merge' ? 'gộp' : 'thay thế'}).`);
    } catch (e) {
      alert(`Lỗi đọc tệp JSON: ${(e as Error).message}`);
    } finally {
      if (importFileRef.current) importFileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            <MapPin className="h-5 w-5 text-brand-700 dark:text-brand-300" />
            Danh mục Điểm giao dịch
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Mỗi Điểm giao dịch (cấp dưới Xã) bao gồm nhiều Mã thôn. Khi chọn ĐGD ở thanh lọc,
            các báo cáo sẽ chỉ hiển thị khế ước thuộc các thôn đó.
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportFile(f);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Import JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={points.length === 0}
              title={points.length === 0 ? 'Chưa có ĐGD để xuất' : 'Tải xuống tệp JSON'}
            >
              <Download className="h-3.5 w-3.5" /> Export JSON
            </Button>
            <Button size="sm" onClick={startAdd}>
              <Plus className="h-3.5 w-3.5" /> Thêm ĐGD
            </Button>
          </div>
        )}
      </div>

      <CoveragePanel
        thonStats={thonStats}
        unassigned={unassignedThons}
        duplicates={duplicateRows}
        orphans={orphanAssignedThons}
        assignedInBc31Count={assignedInBc31Count}
        hasReport={rows.length > 0}
      />

      <div className={cn('grid grid-cols-1 gap-4', isOwner && 'lg:grid-cols-3')}>
        <Card className={cn(isOwner && 'lg:col-span-2')}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Danh sách ({points.length})</CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo Mã ĐGD, Tên ĐGD, Mã thôn..."
                className="h-8 w-72 rounded-md border border-slate-200 bg-white pl-7 pr-3 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                {points.length === 0
                  ? isOwner
                    ? 'Chưa có Điểm giao dịch. Bấm "Thêm ĐGD" để bắt đầu.'
                    : 'Chưa có Điểm giao dịch. Vui lòng liên hệ quản trị viên.'
                  : 'Không tìm thấy ĐGD phù hợp.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Mã ĐGD</th>
                      <th className="px-4 py-2.5 font-semibold">Tên ĐGD</th>
                      <th className="px-4 py-2.5 font-semibold">Mã thôn thuộc ĐGD</th>
                      {isOwner && (
                        <th className="px-4 py-2.5 text-right font-semibold">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        className={cn(
                          'transition-colors',
                          editing?.id === p.id
                            ? 'bg-brand-50/60 dark:bg-brand-900/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        )}
                      >
                        <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                          {p.maDGD}
                        </td>
                        <td className="px-4 py-2 text-slate-800 dark:text-slate-100">{p.tenDGD}</td>
                        <td className="px-4 py-2">
                          {p.maThons.length === 0 ? (
                            <span className="text-xs italic text-slate-400">chưa gán thôn</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {p.maThons.slice(0, 6).map((m) => (
                                <span
                                  key={m}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {m}
                                </span>
                              ))}
                              {p.maThons.length > 6 && (
                                <span className="text-[11px] text-slate-500">
                                  +{p.maThons.length - 6}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        {isOwner && (
                          <td className="px-4 py-2 text-right">
                            <div className="inline-flex gap-1">
                              <button
                                onClick={() => startEdit(p)}
                                className="rounded p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30 dark:hover:text-brand-300"
                                title="Sửa"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(p)}
                                className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                                title="Xóa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle>{editing ? 'Sửa ĐGD' : draft ? 'Thêm ĐGD mới' : 'Chi tiết'}</CardTitle>
              {!draft && (
                <CardDescription>Chọn một ĐGD trong danh sách để sửa, hoặc bấm "Thêm ĐGD".</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!draft ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Chưa chọn ĐGD.
                </div>
              ) : (
                <TxnPointForm
                  draft={draft}
                  setDraft={setDraft}
                  thonOptions={thonOptions}
                  onSave={saveDraft}
                  onCancel={cancelEdit}
                  isEditing={!!editing}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TxnPointForm({
  draft,
  setDraft,
  thonOptions,
  onSave,
  onCancel,
  isEditing,
}: {
  draft: { maDGD: string; tenDGD: string; maThons: string[] };
  setDraft: (d: { maDGD: string; tenDGD: string; maThons: string[] }) => void;
  thonOptions: ThonOption[];
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  const [thonQuery, setThonQuery] = useState('');
  const [xaFilter, setXaFilter] = useState<string>('');
  const [manualMaThon, setManualMaThon] = useState('');

  const selectedSet = useMemo(() => new Set(draft.maThons), [draft.maThons]);

  const xaOptions = useMemo(() => {
    const map = new Map<string, { maXa: string; tenXa: string; thonCount: number }>();
    for (const o of thonOptions) {
      if (!o.maXa) continue;
      const ex = map.get(o.maXa);
      if (ex) ex.thonCount += 1;
      else map.set(o.maXa, { maXa: o.maXa, tenXa: o.tenXa, thonCount: 1 });
    }
    return Array.from(map.values()).sort((a, b) => a.tenXa.localeCompare(b.tenXa, 'vi'));
  }, [thonOptions]);

  const filteredOptions = useMemo(() => {
    const q = thonQuery.trim().toLowerCase();
    return thonOptions.filter((o) => {
      if (xaFilter && o.maXa !== xaFilter) return false;
      if (!q) return true;
      return (
        o.maThon.toLowerCase().includes(q) ||
        o.tenThon.toLowerCase().includes(q) ||
        o.tenXa.toLowerCase().includes(q)
      );
    });
  }, [thonOptions, thonQuery, xaFilter]);

  function selectAllInXa() {
    const set = new Set(draft.maThons);
    for (const o of filteredOptions) set.add(o.maThon);
    setDraft({ ...draft, maThons: Array.from(set) });
  }
  function deselectAllInXa() {
    const remove = new Set(filteredOptions.map((o) => o.maThon));
    setDraft({ ...draft, maThons: draft.maThons.filter((m) => !remove.has(m)) });
  }

  function toggleThon(maThon: string) {
    const set = new Set(draft.maThons);
    if (set.has(maThon)) set.delete(maThon);
    else set.add(maThon);
    setDraft({ ...draft, maThons: Array.from(set) });
  }

  function addManualMaThon() {
    const v = manualMaThon.trim();
    if (!v) return;
    if (selectedSet.has(v)) return;
    setDraft({ ...draft, maThons: [...draft.maThons, v] });
    setManualMaThon('');
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Mã ĐGD *
        </label>
        <input
          value={draft.maDGD}
          onChange={(e) => setDraft({ ...draft, maDGD: e.target.value })}
          placeholder="VD: DGD01"
          className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Tên ĐGD *
        </label>
        <input
          value={draft.tenDGD}
          onChange={(e) => setDraft({ ...draft, tenDGD: e.target.value })}
          placeholder="VD: ĐGD Xã ABC"
          className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Mã thôn thuộc ĐGD ({draft.maThons.length})
          </label>
          {draft.maThons.length > 0 && (
            <button
              onClick={() => setDraft({ ...draft, maThons: [] })}
              className="text-xs text-slate-500 hover:text-rose-600"
            >
              Bỏ chọn tất cả
            </button>
          )}
        </div>

        {draft.maThons.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/50">
            {draft.maThons.map((m) => (
              <span
                key={m}
                className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-200"
              >
                {m}
                <button
                  onClick={() => toggleThon(m)}
                  className="rounded text-slate-400 hover:text-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex gap-1.5">
          <input
            value={manualMaThon}
            onChange={(e) => setManualMaThon(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addManualMaThon();
              }
            }}
            placeholder="Nhập Mã thôn thủ công rồi Enter..."
            className="h-8 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <Button variant="outline" size="sm" onClick={addManualMaThon} disabled={!manualMaThon.trim()}>
            Thêm
          </Button>
        </div>

        {thonOptions.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            <div className="flex gap-1.5">
              <select
                value={xaFilter}
                onChange={(e) => setXaFilter(e.target.value)}
                className="h-8 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">Tất cả xã ({xaOptions.length})</option>
                {xaOptions.map((x) => (
                  <option key={x.maXa} value={x.maXa}>
                    {x.tenXa} ({x.thonCount} thôn)
                  </option>
                ))}
              </select>
              {xaFilter && (
                <button
                  onClick={() => setXaFilter('')}
                  className="rounded-md border border-slate-200 px-2 text-xs text-slate-500 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700"
                  title="Bỏ lọc xã"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <input
              value={thonQuery}
              onChange={(e) => setThonQuery(e.target.value)}
              placeholder={
                xaFilter
                  ? `Lọc trong ${filteredOptions.length} thôn của xã đang chọn...`
                  : `Lọc trong ${thonOptions.length} thôn của Báo cáo 31...`
              }
              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />

            {filteredOptions.length > 0 && (xaFilter || thonQuery) && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{filteredOptions.length} thôn hiển thị</span>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllInXa}
                    className="text-brand-700 hover:underline dark:text-brand-300"
                  >
                    Chọn tất cả
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <button
                    onClick={deselectAllInXa}
                    className="text-slate-500 hover:text-rose-600"
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>
            )}

            <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-slate-400">
                  Không có thôn phù hợp.
                </div>
              ) : (
                filteredOptions.map((o) => {
                  const active = selectedSet.has(o.maThon);
                  return (
                    <button
                      key={o.maThon}
                      onClick={() => toggleThon(o.maThon)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs',
                        active
                          ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">{o.maThon}</span>
                        <span className="truncate">
                          {o.tenThon}
                          {!xaFilter && o.tenXa && (
                            <span className="text-slate-400"> — {o.tenXa}</span>
                          )}
                        </span>
                      </span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
            Chưa có Báo cáo 31 — bạn có thể nhập Mã thôn thủ công ở ô trên.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Hủy
        </Button>
        <Button size="sm" onClick={onSave}>
          <Save className="h-3.5 w-3.5" /> {isEditing ? 'Lưu' : 'Thêm'}
        </Button>
      </div>
    </div>
  );
}

function CoveragePanel({
  thonStats,
  unassigned,
  duplicates,
  orphans,
  assignedInBc31Count,
  hasReport,
}: {
  thonStats: ThonStat[];
  unassigned: ThonStat[];
  duplicates: DuplicateRow[];
  orphans: string[];
  assignedInBc31Count: number;
  hasReport: boolean;
}) {
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showOrphans, setShowOrphans] = useState(false);

  if (!hasReport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kiểm soát phủ thôn</CardTitle>
          <CardDescription>
            Chưa có Báo cáo 31 — chưa thể đối chiếu thôn nào đã/chưa được gán cho ĐGD.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalThon = thonStats.length;
  const allAssigned = unassigned.length === 0 && duplicates.length === 0 && orphans.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kiểm soát phủ thôn</CardTitle>
        <CardDescription>
          Đối chiếu Mã thôn trong Báo cáo 31 với danh sách Điểm giao dịch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryChip label="Tổng số thôn (BC 31)" value={totalThon} tone="neutral" />
          <SummaryChip label="Đã gán ĐGD" value={assignedInBc31Count} tone="ok" />
          <SummaryChip label="Chưa gán" value={unassigned.length} tone={unassigned.length === 0 ? 'ok' : 'warn'} />
          <SummaryChip label="Gán trùng" value={duplicates.length} tone={duplicates.length === 0 ? 'ok' : 'warn'} />
        </div>

        {allAssigned && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Check className="h-3.5 w-3.5" />
            Tất cả {totalThon} thôn trong Báo cáo 31 đã được gán đúng cho Điểm giao dịch.
          </div>
        )}

        {unassigned.length > 0 && (
          <div className="rounded-md border border-amber-200 dark:border-amber-900/60">
            <button
              onClick={() => setShowUnassigned((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-amber-50 px-3 py-2 text-left text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
            >
              <span className="flex items-center gap-2">
                {showUnassigned ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <AlertTriangle className="h-3.5 w-3.5" />
                Thôn chưa gán ĐGD ({unassigned.length})
              </span>
              <span className="text-amber-700 dark:text-amber-300">
                {fmtCompact(unassigned.reduce((s, t) => s + t.loanCount, 0))} khế ước ·{' '}
                {fmtCompact(unassigned.reduce((s, t) => s + t.tongDuNo, 0))} đ
              </span>
            </button>
            {showUnassigned && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-amber-50/50 text-left uppercase tracking-wide text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <tr>
                      <th className="px-3 py-1.5 font-semibold">Mã thôn</th>
                      <th className="px-3 py-1.5 font-semibold">Tên thôn</th>
                      <th className="px-3 py-1.5 font-semibold">Tên xã</th>
                      <th className="px-3 py-1.5 text-right font-semibold">Khế ước</th>
                      <th className="px-3 py-1.5 text-right font-semibold">Tổng dư nợ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 dark:divide-amber-950/40">
                    {unassigned.map((t) => (
                      <tr key={t.maThon} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20">
                        <td className="px-3 py-1.5 font-mono text-slate-700 dark:text-slate-200">{t.maThon}</td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">{t.tenThon || <em className="text-slate-400">—</em>}</td>
                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{t.tenXa || '—'}</td>
                        <td className="px-3 py-1.5 text-right text-slate-700 dark:text-slate-200">{t.loanCount.toLocaleString('vi-VN')}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-slate-700 dark:text-slate-200">{fmtCompact(t.tongDuNo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="rounded-md border border-rose-200 dark:border-rose-900/60">
            <button
              onClick={() => setShowDuplicates((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-rose-50 px-3 py-2 text-left text-xs font-semibold text-rose-900 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60"
            >
              <span className="flex items-center gap-2">
                {showDuplicates ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Copy className="h-3.5 w-3.5" />
                Thôn bị gán cho nhiều ĐGD ({duplicates.length})
              </span>
            </button>
            {showDuplicates && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-rose-50/50 text-left uppercase tracking-wide text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                    <tr>
                      <th className="px-3 py-1.5 font-semibold">Mã thôn</th>
                      <th className="px-3 py-1.5 font-semibold">Tên thôn</th>
                      <th className="px-3 py-1.5 font-semibold">ĐGD trùng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 dark:divide-rose-950/40">
                    {duplicates.map((d) => (
                      <tr key={d.maThon} className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20">
                        <td className="px-3 py-1.5 font-mono text-slate-700 dark:text-slate-200">{d.maThon}</td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">
                          {d.tenThon || <em className="text-slate-400">—</em>}
                          {d.tenXa && <span className="text-slate-400"> · {d.tenXa}</span>}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {d.points.map((p) => (
                              <span
                                key={p.id}
                                className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                              >
                                {p.maDGD} — {p.tenDGD}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {orphans.length > 0 && (
          <div className="rounded-md border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setShowOrphans((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/60"
            >
              <span className="flex items-center gap-2">
                {showOrphans ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                Mã thôn đã gán nhưng không có trong Báo cáo 31 ({orphans.length})
              </span>
            </button>
            {showOrphans && (
              <div className="px-3 py-2">
                <p className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Có thể do gõ sai mã, hoặc thôn đã sáp nhập / đổi mã.
                </p>
                <div className="flex flex-wrap gap-1">
                  {orphans.map((m) => (
                    <span
                      key={m}
                      className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ok' | 'warn' | 'neutral';
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
        : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200';
  return (
    <div className={cn('rounded-md border px-3 py-2', toneClass)}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-0.5 text-xl font-bold">{value.toLocaleString('vi-VN')}</div>
    </div>
  );
}
