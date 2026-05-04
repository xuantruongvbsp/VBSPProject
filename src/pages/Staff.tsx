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
  Users,
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
  useStaffStore,
  exportStaffJson,
  parseStaffJson,
} from '@/store/useStaffStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import { useIsOwner } from '@/store/useAuthStore';
import { fmtCompact } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import type { StaffRecord, TxnPointRecord } from '@/lib/types';

interface DuplicateRow {
  point: TxnPointRecord;
  staff: StaffRecord[];
}

/**
 * Trang quản lý cán bộ — danh sách + form thêm/sửa + import/export JSON.
 * Cán bộ được gán theo Điểm giao dịch (mỗi cán bộ phụ trách nhiều ĐGD).
 * Mã thôn của cán bộ tự suy ra từ tổng các Mã thôn của các ĐGD đó.
 */
export function StaffPage() {
  const rows = useDataStore((s) => s.rows);
  const staff = useStaffStore((s) => s.staff);
  const addStaff = useStaffStore((s) => s.addStaff);
  const updateStaff = useStaffStore((s) => s.updateStaff);
  const removeStaff = useStaffStore((s) => s.removeStaff);
  const importStaff = useStaffStore((s) => s.importStaff);

  const points = useTxnPointStore((s) => s.points);
  const isOwner = useIsOwner();

  // Bản đồ Mã ĐGD → record (đối chiếu nhanh từ maDGDs của cán bộ).
  const pointByMa = useMemo(() => {
    const m = new Map<string, TxnPointRecord>();
    for (const p of points) m.set(p.maDGD, p);
    return m;
  }, [points]);

  // Tổng dư nợ + số khế ước theo Mã thôn — để hiện preview cho từng cán bộ.
  const thonStats = useMemo(() => {
    const map = new Map<string, { loanCount: number; tongDuNo: number }>();
    for (const r of rows) {
      const ma = (r.maThon ?? '').trim();
      if (!ma) continue;
      const ex = map.get(ma);
      if (ex) {
        ex.loanCount += 1;
        ex.tongDuNo += r.tongDuNo;
      } else {
        map.set(ma, { loanCount: 1, tongDuNo: r.tongDuNo });
      }
    }
    return map;
  }, [rows]);

  // Bản đồ Mã ĐGD → danh sách cán bộ phụ trách (length > 1 = trùng).
  const assignmentMap = useMemo(() => {
    const m = new Map<string, StaffRecord[]>();
    for (const s of staff) {
      for (const ma of s.maDGDs) {
        const list = m.get(ma);
        if (list) list.push(s);
        else m.set(ma, [s]);
      }
    }
    return m;
  }, [staff]);

  // ĐGD chưa cán bộ nào phụ trách
  const unassignedPoints = useMemo<TxnPointRecord[]>(
    () => points.filter((p) => !assignmentMap.has(p.maDGD)),
    [points, assignmentMap]
  );

  // ĐGD bị gán cho ≥ 2 cán bộ
  const duplicateRows = useMemo<DuplicateRow[]>(() => {
    const out: DuplicateRow[] = [];
    for (const p of points) {
      const list = assignmentMap.get(p.maDGD);
      if (list && list.length >= 2) out.push({ point: p, staff: list });
    }
    return out;
  }, [points, assignmentMap]);

  // Mã ĐGD nằm trong dữ liệu cán bộ nhưng KHÔNG có trong danh mục ĐGD
  // (có thể do ĐGD đã bị xóa/đổi mã sau khi gán cho cán bộ).
  const orphanAssignedDGDs = useMemo<string[]>(() => {
    if (points.length === 0) return [];
    const inCatalog = new Set(points.map((p) => p.maDGD));
    const out: string[] = [];
    for (const ma of assignmentMap.keys()) {
      if (!inCatalog.has(ma)) out.push(ma);
    }
    return out.sort();
  }, [assignmentMap, points]);

  const assignedPointCount = points.length - unassignedPoints.length;

  const [editing, setEditing] = useState<StaffRecord | null>(null);
  const [draft, setDraft] = useState<{ maNV: string; tenNV: string; maDGDs: string[] } | null>(
    null
  );
  const [search, setSearch] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.maNV.toLowerCase().includes(q) ||
        s.tenNV.toLowerCase().includes(q) ||
        s.maDGDs.some((m) => m.toLowerCase().includes(q))
    );
  }, [staff, search]);

  function startAdd() {
    setEditing(null);
    setDraft({ maNV: '', tenNV: '', maDGDs: [] });
  }

  function startEdit(rec: StaffRecord) {
    setEditing(rec);
    setDraft({ maNV: rec.maNV, tenNV: rec.tenNV, maDGDs: [...rec.maDGDs] });
  }

  function cancelEdit() {
    setEditing(null);
    setDraft(null);
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.maNV.trim()) {
      alert('Vui lòng nhập Mã NV.');
      return;
    }
    if (!draft.tenNV.trim()) {
      alert('Vui lòng nhập Tên NV.');
      return;
    }
    if (editing) {
      updateStaff(editing.id, {
        maNV: draft.maNV,
        tenNV: draft.tenNV,
        maDGDs: draft.maDGDs,
      });
    } else {
      if (staff.some((s) => s.maNV.trim() === draft.maNV.trim())) {
        if (!confirm(`Mã NV "${draft.maNV}" đã tồn tại. Vẫn thêm dòng mới?`)) return;
      }
      addStaff({
        maNV: draft.maNV,
        tenNV: draft.tenNV,
        maDGDs: draft.maDGDs,
      });
    }
    cancelEdit();
  }

  function handleDelete(rec: StaffRecord) {
    if (confirm(`Xóa cán bộ "${rec.maNV} — ${rec.tenNV}"?`)) {
      removeStaff(rec.id);
      if (editing?.id === rec.id) cancelEdit();
    }
  }

  function handleExport() {
    const json = exportStaffJson(staff);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `can-bo-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const records = parseStaffJson(text);
      const mode = staff.length === 0
        ? 'replace'
        : confirm(
            `Tìm thấy ${records.length} cán bộ trong tệp. Bấm OK để GỘP (trùng Mã NV sẽ bị ghi đè), bấm Hủy để THAY THẾ toàn bộ.`
          )
          ? 'merge'
          : 'replace';
      importStaff(records, mode);
      alert(`Đã import ${records.length} cán bộ (${mode === 'merge' ? 'gộp' : 'thay thế'}).`);
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
            <Users className="h-5 w-5 text-brand-700 dark:text-brand-300" />
            Danh mục cán bộ
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Mỗi cán bộ phụ trách nhiều <strong>Điểm giao dịch (ĐGD)</strong>. Mã thôn của cán
            bộ được suy ra tự động từ các ĐGD đã gán. Quản lý ĐGD ở{' '}
            <Link to="/snapshot/diem-giao-dich" className="text-brand-700 hover:underline dark:text-brand-300">
              danh mục Điểm giao dịch
            </Link>
            .
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
              disabled={staff.length === 0}
              title={staff.length === 0 ? 'Chưa có cán bộ để xuất' : 'Tải xuống tệp JSON'}
            >
              <Download className="h-3.5 w-3.5" /> Export JSON
            </Button>
            <Button size="sm" onClick={startAdd} disabled={points.length === 0}>
              <Plus className="h-3.5 w-3.5" /> Thêm cán bộ
            </Button>
          </div>
        )}
      </div>

      {points.length === 0 && isOwner && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
          <CardContent className="flex items-center gap-3 py-3 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              Chưa có Điểm giao dịch nào. Hãy{' '}
              <Link
                to="/snapshot/diem-giao-dich"
                className="font-semibold text-amber-900 underline hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
              >
                tạo danh mục ĐGD trước
              </Link>{' '}
              rồi quay lại đây gán cho cán bộ.
            </div>
          </CardContent>
        </Card>
      )}

      <CoveragePanel
        points={points}
        unassigned={unassignedPoints}
        duplicates={duplicateRows}
        orphans={orphanAssignedDGDs}
        assignedPointCount={assignedPointCount}
      />

      <div className={cn('grid grid-cols-1 gap-4', isOwner && 'lg:grid-cols-3')}>
        {/* Cột danh sách cán bộ */}
        <Card className={cn(isOwner && 'lg:col-span-2')}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Danh sách ({staff.length})</CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo Mã NV, Tên NV, Mã ĐGD..."
                className="h-8 w-72 rounded-md border border-slate-200 bg-white pl-7 pr-3 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                {staff.length === 0
                  ? isOwner
                    ? 'Chưa có cán bộ. Bấm "Thêm cán bộ" để bắt đầu.'
                    : 'Chưa có cán bộ. Vui lòng liên hệ quản trị viên.'
                  : 'Không tìm thấy cán bộ phù hợp.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Mã NV</th>
                      <th className="px-4 py-2.5 font-semibold">Tên NV</th>
                      <th className="px-4 py-2.5 font-semibold">ĐGD phụ trách</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Thôn / Khế ước</th>
                      {isOwner && (
                        <th className="px-4 py-2.5 text-right font-semibold">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.map((s) => {
                      const derivedThons = new Set<string>();
                      let invalidCount = 0;
                      for (const ma of s.maDGDs) {
                        const p = pointByMa.get(ma);
                        if (!p) {
                          invalidCount += 1;
                          continue;
                        }
                        for (const t of p.maThons) derivedThons.add(t);
                      }
                      let loanCount = 0;
                      let tongDuNo = 0;
                      for (const t of derivedThons) {
                        const stat = thonStats.get(t);
                        if (stat) {
                          loanCount += stat.loanCount;
                          tongDuNo += stat.tongDuNo;
                        }
                      }
                      return (
                        <tr
                          key={s.id}
                          className={cn(
                            'transition-colors',
                            editing?.id === s.id
                              ? 'bg-brand-50/60 dark:bg-brand-900/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          )}
                        >
                          <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                            {s.maNV}
                          </td>
                          <td className="px-4 py-2 text-slate-800 dark:text-slate-100">{s.tenNV}</td>
                          <td className="px-4 py-2">
                            {s.maDGDs.length === 0 ? (
                              <span className="text-xs italic text-slate-400">chưa gán ĐGD</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {s.maDGDs.slice(0, 4).map((ma) => {
                                  const p = pointByMa.get(ma);
                                  const ok = !!p;
                                  return (
                                    <span
                                      key={ma}
                                      className={cn(
                                        'rounded px-1.5 py-0.5 text-[11px]',
                                        ok
                                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                          : 'bg-rose-100 text-rose-700 line-through dark:bg-rose-900/40 dark:text-rose-300'
                                      )}
                                      title={ok ? p.tenDGD : 'ĐGD không còn trong danh mục'}
                                    >
                                      <span className="font-mono">{ma}</span>
                                      {ok && (
                                        <span className="ml-1 hidden md:inline">— {p.tenDGD}</span>
                                      )}
                                    </span>
                                  );
                                })}
                                {s.maDGDs.length > 4 && (
                                  <span className="text-[11px] text-slate-500">
                                    +{s.maDGDs.length - 4}
                                  </span>
                                )}
                                {invalidCount > 0 && (
                                  <span className="text-[11px] text-rose-600 dark:text-rose-400">
                                    ({invalidCount} ĐGD không hợp lệ)
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-slate-700 dark:text-slate-200">
                            <div>
                              <span className="font-semibold">{derivedThons.size}</span> thôn
                            </div>
                            {rows.length > 0 && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {loanCount.toLocaleString('vi-VN')} KƯ · {fmtCompact(tongDuNo)}
                              </div>
                            )}
                          </td>
                          {isOwner && (
                            <td className="px-4 py-2 text-right">
                              <div className="inline-flex gap-1">
                                <button
                                  onClick={() => startEdit(s)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30 dark:hover:text-brand-300"
                                  title="Sửa"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(s)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                                  title="Xóa"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cột form thêm/sửa — chỉ hiện cho chủ sở hữu */}
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle>{editing ? 'Sửa cán bộ' : draft ? 'Thêm cán bộ mới' : 'Chi tiết'}</CardTitle>
              {!draft && (
                <CardDescription>Chọn một cán bộ trong danh sách để sửa, hoặc bấm "Thêm cán bộ".</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!draft ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Chưa chọn cán bộ.</div>
              ) : (
                <StaffForm
                  draft={draft}
                  setDraft={setDraft}
                  points={points}
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

function StaffForm({
  draft,
  setDraft,
  points,
  onSave,
  onCancel,
  isEditing,
}: {
  draft: { maNV: string; tenNV: string; maDGDs: string[] };
  setDraft: (d: { maNV: string; tenNV: string; maDGDs: string[] }) => void;
  points: TxnPointRecord[];
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}) {
  const [pointQuery, setPointQuery] = useState('');
  const selectedSet = useMemo(() => new Set(draft.maDGDs), [draft.maDGDs]);

  const filteredPoints = useMemo(() => {
    const q = pointQuery.trim().toLowerCase();
    if (!q) return points;
    return points.filter(
      (p) =>
        p.maDGD.toLowerCase().includes(q) ||
        p.tenDGD.toLowerCase().includes(q)
    );
  }, [points, pointQuery]);

  // Tổng số thôn duy nhất từ các ĐGD đã chọn (để hiển thị preview).
  const derivedThonCount = useMemo(() => {
    const set = new Set<string>();
    for (const ma of draft.maDGDs) {
      const p = points.find((x) => x.maDGD === ma);
      if (p) for (const t of p.maThons) set.add(t);
    }
    return set.size;
  }, [draft.maDGDs, points]);

  function togglePoint(maDGD: string) {
    const set = new Set(draft.maDGDs);
    if (set.has(maDGD)) set.delete(maDGD);
    else set.add(maDGD);
    setDraft({ ...draft, maDGDs: Array.from(set) });
  }

  function selectAll() {
    setDraft({ ...draft, maDGDs: filteredPoints.map((p) => p.maDGD) });
  }

  function deselectAll() {
    const remove = new Set(filteredPoints.map((p) => p.maDGD));
    setDraft({ ...draft, maDGDs: draft.maDGDs.filter((m) => !remove.has(m)) });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Mã NV *</label>
        <input
          value={draft.maNV}
          onChange={(e) => setDraft({ ...draft, maNV: e.target.value })}
          placeholder="VD: NV001"
          className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tên NV *</label>
        <input
          value={draft.tenNV}
          onChange={(e) => setDraft({ ...draft, tenNV: e.target.value })}
          placeholder="VD: Nguyễn Văn A"
          className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Điểm giao dịch phụ trách ({draft.maDGDs.length})
          </label>
          {draft.maDGDs.length > 0 && (
            <button
              onClick={() => setDraft({ ...draft, maDGDs: [] })}
              className="text-xs text-slate-500 hover:text-rose-600"
            >
              Bỏ chọn tất cả
            </button>
          )}
        </div>

        {draft.maDGDs.length > 0 && (
          <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex flex-wrap gap-1">
              {draft.maDGDs.map((ma) => {
                const p = points.find((x) => x.maDGD === ma);
                const ok = !!p;
                return (
                  <span
                    key={ma}
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs shadow-sm',
                      ok
                        ? 'bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                        : 'bg-rose-50 text-rose-700 line-through dark:bg-rose-900/40 dark:text-rose-300'
                    )}
                    title={ok ? `${p.tenDGD} (${p.maThons.length} thôn)` : 'ĐGD không còn trong danh mục'}
                  >
                    <span className="font-mono">{ma}</span>
                    {ok && <span className="hidden md:inline">— {p.tenDGD}</span>}
                    <button
                      onClick={() => togglePoint(ma)}
                      className="rounded text-slate-400 hover:text-rose-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            {draft.maDGDs.length > 0 && (
              <div className="mt-1.5 border-t border-slate-200 pt-1.5 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Tự suy ra: <span className="font-semibold text-slate-700 dark:text-slate-200">{derivedThonCount}</span> Mã thôn duy nhất
              </div>
            )}
          </div>
        )}

        {points.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={pointQuery}
                onChange={(e) => setPointQuery(e.target.value)}
                placeholder={`Lọc trong ${points.length} ĐGD...`}
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {filteredPoints.length > 0 && pointQuery && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{filteredPoints.length} ĐGD hiển thị</span>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-brand-700 hover:underline dark:text-brand-300">
                    Chọn tất cả
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <button onClick={deselectAll} className="text-slate-500 hover:text-rose-600">
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>
            )}

            <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
              {filteredPoints.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-slate-400">
                  Không có ĐGD phù hợp.
                </div>
              ) : (
                filteredPoints.map((p) => {
                  const active = selectedSet.has(p.maDGD);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePoint(p.maDGD)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs',
                        active
                          ? 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">{p.maDGD}</span>
                        <span className="truncate">{p.tenDGD}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400">{p.maThons.length} thôn</span>
                        {active && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">
            Chưa có ĐGD nào. Hãy{' '}
            <Link to="/snapshot/diem-giao-dich" className="text-brand-700 underline dark:text-brand-300">
              tạo danh mục Điểm giao dịch
            </Link>{' '}
            trước.
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

/**
 * Bảng kiểm soát phủ ĐGD — đối chiếu Mã ĐGD trong danh mục Điểm giao
 * dịch với danh sách Mã ĐGD đã gán cho cán bộ.
 */
function CoveragePanel({
  points,
  unassigned,
  duplicates,
  orphans,
  assignedPointCount,
}: {
  points: TxnPointRecord[];
  unassigned: TxnPointRecord[];
  duplicates: DuplicateRow[];
  orphans: string[];
  assignedPointCount: number;
}) {
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showOrphans, setShowOrphans] = useState(false);

  if (points.length === 0) {
    return null;
  }

  const totalPoints = points.length;
  const allAssigned = unassigned.length === 0 && duplicates.length === 0 && orphans.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kiểm soát phủ Điểm giao dịch</CardTitle>
        <CardDescription>
          Đối chiếu danh mục ĐGD với danh sách cán bộ phụ trách.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryChip label="Tổng số ĐGD" value={totalPoints} tone="neutral" />
          <SummaryChip label="Đã gán cán bộ" value={assignedPointCount} tone="ok" />
          <SummaryChip
            label="Chưa gán"
            value={unassigned.length}
            tone={unassigned.length === 0 ? 'ok' : 'warn'}
          />
          <SummaryChip
            label="Gán trùng"
            value={duplicates.length}
            tone={duplicates.length === 0 ? 'ok' : 'warn'}
          />
        </div>

        {allAssigned && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Check className="h-3.5 w-3.5" />
            Tất cả {totalPoints} ĐGD đã được gán đúng cho cán bộ.
          </div>
        )}

        {unassigned.length > 0 && (
          <div className="rounded-md border border-amber-200 dark:border-amber-900/60">
            <button
              onClick={() => setShowUnassigned((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-amber-50 px-3 py-2 text-left text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
            >
              <span className="flex items-center gap-2">
                {showUnassigned ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <AlertTriangle className="h-3.5 w-3.5" />
                ĐGD chưa gán cán bộ ({unassigned.length})
              </span>
            </button>
            {showUnassigned && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-amber-50/50 text-left uppercase tracking-wide text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <tr>
                      <th className="px-3 py-1.5 font-semibold">Mã ĐGD</th>
                      <th className="px-3 py-1.5 font-semibold">Tên ĐGD</th>
                      <th className="px-3 py-1.5 text-right font-semibold">Số thôn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 dark:divide-amber-950/40">
                    {unassigned.map((p) => (
                      <tr key={p.id} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20">
                        <td className="px-3 py-1.5 font-mono text-slate-700 dark:text-slate-200">
                          {p.maDGD}
                        </td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">
                          {p.tenDGD}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-700 dark:text-slate-200">
                          {p.maThons.length}
                        </td>
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
                {showDuplicates ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <Copy className="h-3.5 w-3.5" />
                ĐGD bị gán cho nhiều cán bộ ({duplicates.length})
              </span>
            </button>
            {showDuplicates && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-rose-50/50 text-left uppercase tracking-wide text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                    <tr>
                      <th className="px-3 py-1.5 font-semibold">Mã ĐGD</th>
                      <th className="px-3 py-1.5 font-semibold">Tên ĐGD</th>
                      <th className="px-3 py-1.5 font-semibold">Cán bộ trùng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 dark:divide-rose-950/40">
                    {duplicates.map((d) => (
                      <tr key={d.point.id} className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20">
                        <td className="px-3 py-1.5 font-mono text-slate-700 dark:text-slate-200">
                          {d.point.maDGD}
                        </td>
                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">
                          {d.point.tenDGD}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {d.staff.map((s) => (
                              <span
                                key={s.id}
                                className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                              >
                                {s.maNV} — {s.tenNV}
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
                {showOrphans ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                Mã ĐGD đã gán cho cán bộ nhưng không còn trong danh mục ({orphans.length})
              </span>
            </button>
            {showOrphans && (
              <div className="px-3 py-2">
                <p className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Có thể do ĐGD đã bị xóa hoặc đổi mã. Hãy mở từng cán bộ liên quan để xóa các Mã ĐGD này.
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
