import { useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, FileText, Paperclip, Eye, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import {
  NGUON_VON_LIST,
  nguonVonLabel,
  type Decision,
  type DecisionStatus,
} from '@/lib/credit-plan-types';
import {
  saveAttachmentBlob,
  deleteAttachmentBlob,
  openAttachmentInNewTab,
  downloadAttachment,
  formatBytes,
  MAX_ATTACHMENT_SIZE,
} from '@/lib/decision-attachments';

interface DecisionForm {
  soQD: string;
  ngayQD: string;
  tenQD: string;
  maNguonVon: string;
  ngayHieuLuc: string;
  trangThai: DecisionStatus;
  ghiChu: string;
}

const emptyForm: DecisionForm = {
  soQD: '',
  ngayQD: '',
  tenQD: '',
  maNguonVon: '',
  ngayHieuLuc: '',
  trangThai: 'active',
  ghiChu: '',
};

const statusLabel: Record<DecisionStatus, string> = {
  draft: 'Nháp',
  active: 'Hiệu lực',
  archived: 'Lưu trữ',
};

const statusColor: Record<DecisionStatus, string> = {
  draft: 'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  archived: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
};

function fmtMoney(n: number) {
  return n.toLocaleString('vi-VN');
}

export function DecisionManager() {
  const decisions = useCreditPlanStore((s) => s.decisions);
  const plans = useCreditPlanStore((s) => s.plans);
  const addDecision = useCreditPlanStore((s) => s.addDecision);
  const updateDecision = useCreditPlanStore((s) => s.updateDecision);
  const deleteDecision = useCreditPlanStore((s) => s.deleteDecision);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterNV, setFilterNV] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | DecisionStatus>('');

  // PDF attachment state (chỉ thao tác trong phiên chỉnh sửa)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePick = (file: File | null) => {
    setFileError(null);
    if (!file) {
      setPendingFile(null);
      return;
    }
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Chỉ chấp nhận file PDF.');
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setFileError(`File quá lớn (tối đa ${formatBytes(MAX_ATTACHMENT_SIZE)}).`);
      return;
    }
    setPendingFile(file);
    setRemoveExistingFile(false);
  };

  // Aggregate per decision: số dòng + tổng kế hoạch
  const stats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const p of plans) {
      const e = map.get(p.decisionId);
      if (e) {
        e.count++;
        e.total += p.soTien;
      } else {
        map.set(p.decisionId, { count: 1, total: p.soTien });
      }
    }
    return map;
  }, [plans]);

  const filtered = decisions.filter((d) => {
    if (filterNV && d.maNguonVon !== filterNV) return false;
    if (filterStatus && d.trangThai !== filterStatus) return false;
    return true;
  });

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(false);
    setPendingFile(null);
    setRemoveExistingFile(false);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!form.soQD || !form.ngayQD || !form.maNguonVon) return;
    if (isSaving) return;
    setIsSaving(true);
    try {
      const existing = editId ? decisions.find((d) => d.id === editId) : undefined;
      const decisionId = editId ?? crypto.randomUUID();

      // Xử lý attachment trước để metadata kèm theo lúc save decision
      let nextAttachment = existing?.attachment;
      if (pendingFile) {
        await saveAttachmentBlob(decisionId, pendingFile);
        nextAttachment = {
          fileName: pendingFile.name,
          size: pendingFile.size,
          mime: pendingFile.type || 'application/pdf',
          uploadedAt: new Date().toISOString(),
        };
      } else if (removeExistingFile && existing?.attachment) {
        await deleteAttachmentBlob(decisionId).catch(() => undefined);
        nextAttachment = undefined;
      }

      const payload: Omit<Decision, 'id'> = {
        soQD: form.soQD.trim(),
        ngayQD: form.ngayQD,
        tenQD: form.tenQD.trim(),
        maNguonVon: form.maNguonVon,
        ngayHieuLuc: form.ngayHieuLuc || undefined,
        trangThai: form.trangThai,
        ghiChu: form.ghiChu.trim() || undefined,
        attachment: nextAttachment,
      };

      if (editId) {
        updateDecision(editId, payload);
      } else {
        addDecision({ id: decisionId, ...payload });
      }
      resetForm();
    } catch (err) {
      console.error('Save decision failed', err);
      setFileError('Lưu file PDF thất bại. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (d: Decision) => {
    setEditId(d.id);
    setForm({
      soQD: d.soQD,
      ngayQD: d.ngayQD,
      tenQD: d.tenQD,
      maNguonVon: d.maNguonVon,
      ngayHieuLuc: d.ngayHieuLuc ?? '',
      trangThai: d.trangThai,
      ghiChu: d.ghiChu ?? '',
    });
    setPendingFile(null);
    setRemoveExistingFile(false);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(true);
  };

  const handleRowRemoveFile = async (d: Decision) => {
    if (!d.attachment) return;
    if (!confirm(`Xóa file "${d.attachment.fileName}" khỏi QĐ "${d.soQD}"?`)) return;
    await deleteAttachmentBlob(d.id).catch(() => undefined);
    updateDecision(d.id, { attachment: undefined });
  };

  const confirmDelete = (d: Decision) => {
    const s = stats.get(d.id);
    const msg = s
      ? `Xóa QĐ "${d.soQD}" sẽ xóa luôn ${s.count} dòng kế hoạch (tổng ${fmtMoney(s.total)} tr.đ). Tiếp tục?`
      : `Xóa QĐ "${d.soQD}"?`;
    if (confirm(msg)) deleteDecision(d.id);
  };

  const totalPlannedAll = Array.from(stats.values()).reduce((a, b) => a + b.total, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Quyết định</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Danh mục QĐ giao kế hoạch — dùng khi nhập kế hoạch dư nợ
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Thêm QĐ
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Tổng số QĐ</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{decisions.length}</div>
            <div className="text-xs text-slate-500">quyết định</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">QĐ hiệu lực</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">
              {decisions.filter((d) => d.trangThai === 'active').length}
            </div>
            <div className="text-xs text-slate-500">đang áp dụng</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Tổng kế hoạch</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">{fmtMoney(Math.round(totalPlannedAll))}</div>
            <div className="text-xs text-slate-500">triệu đồng</div>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editId ? 'Sửa Quyết định' : 'Thêm Quyết định'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Số QĐ *</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={form.soQD}
                  onChange={(e) => setForm((f) => ({ ...f, soQD: e.target.value }))}
                  placeholder="VD: 64/QĐ-NHCS"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Ngày QĐ *</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={form.ngayQD}
                  onChange={(e) => setForm((f) => ({ ...f, ngayQD: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Nguồn vốn *</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={form.maNguonVon}
                  onChange={(e) => setForm((f) => ({ ...f, maNguonVon: e.target.value }))}
                >
                  <option value="">-- Chọn nguồn vốn --</option>
                  {NGUON_VON_LIST.map((n) => (
                    <option key={n.ma} value={n.ma}>{n.ten}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Tên / trích yếu</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={form.tenQD}
                  onChange={(e) => setForm((f) => ({ ...f, tenQD: e.target.value }))}
                  placeholder="VD: Giao kế hoạch dư nợ tín dụng năm 2026"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Ngày hiệu lực</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={form.ngayHieuLuc}
                  onChange={(e) => setForm((f) => ({ ...f, ngayHieuLuc: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Trạng thái</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  value={form.trangThai}
                  onChange={(e) => setForm((f) => ({ ...f, trangThai: e.target.value as DecisionStatus }))}
                >
                  <option value="draft">Nháp</option>
                  <option value="active">Hiệu lực</option>
                  <option value="archived">Lưu trữ</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Ghi chú</label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  rows={2}
                  value={form.ghiChu}
                  onChange={(e) => setForm((f) => ({ ...f, ghiChu: e.target.value }))}
                />
              </div>
              {/* Attachment */}
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  File PDF đính kèm <span className="text-slate-400">(tối đa {formatBytes(MAX_ATTACHMENT_SIZE)})</span>
                </label>
                {(() => {
                  const existing = editId ? decisions.find((d) => d.id === editId)?.attachment : undefined;
                  const showExisting = existing && !pendingFile && !removeExistingFile;
                  return (
                    <div className="space-y-2">
                      {showExisting && existing && (
                        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                          <Paperclip className="h-4 w-4 text-plan-700" />
                          <span className="flex-1 truncate text-slate-700 dark:text-slate-200" title={existing.fileName}>
                            {existing.fileName}
                          </span>
                          <span className="text-xs text-slate-500">{formatBytes(existing.size)}</span>
                          <button
                            type="button"
                            onClick={() => openAttachmentInNewTab(editId!)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-plan-700 dark:hover:bg-slate-700"
                            title="Xem"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemoveExistingFile(true)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700"
                            title="Xóa file"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {pendingFile && (
                        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-900/30">
                          <Paperclip className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                          <span className="flex-1 truncate text-emerald-800 dark:text-emerald-200" title={pendingFile.name}>
                            {pendingFile.name} <span className="text-xs">(sẽ lưu khi bấm {editId ? 'Cập nhật' : 'Lưu'})</span>
                          </span>
                          <span className="text-xs text-emerald-700 dark:text-emerald-300">{formatBytes(pendingFile.size)}</span>
                          <button
                            type="button"
                            onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                            className="rounded p-1 text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                            title="Hủy file"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      {removeExistingFile && (
                        <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm dark:border-rose-800 dark:bg-rose-900/30">
                          <span className="flex-1 text-rose-800 dark:text-rose-200">
                            File sẽ bị xóa khi bấm {editId ? 'Cập nhật' : 'Lưu'}.
                          </span>
                          <button
                            type="button"
                            onClick={() => setRemoveExistingFile(false)}
                            className="rounded px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/50"
                          >
                            Hoàn tác
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-plan-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-plan-800 dark:text-slate-300"
                        />
                      </div>
                      {fileError && (
                        <div className="text-xs text-rose-600 dark:text-rose-400">{fileError}</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleSubmit} disabled={isSaving}>
                <Save className="h-4 w-4" /> {isSaving ? 'Đang lưu…' : (editId ? 'Cập nhật' : 'Lưu')}
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={isSaving}>
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
          value={filterNV}
          onChange={(e) => setFilterNV(e.target.value)}
        >
          <option value="">Tất cả nguồn vốn</option>
          {NGUON_VON_LIST.map((n) => (
            <option key={n.ma} value={n.ma}>{n.ten}</option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as '' | DecisionStatus)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="active">Hiệu lực</option>
          <option value="archived">Lưu trữ</option>
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
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Tên / trích yếu</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Nguồn vốn</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Trạng thái</th>
                  <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">File</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Số dòng</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Tổng KH (tr.đ)</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                      Chưa có Quyết định nào. Nhấn "Thêm QĐ" để bắt đầu.
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => {
                    const s = stats.get(d.id);
                    return (
                      <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{d.soQD}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{d.ngayQD}</td>
                        <td className="max-w-[260px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300" title={d.tenQD}>{d.tenQD || <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{nguonVonLabel(d.maNguonVon)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusColor[d.trangThai]}`}>
                            {statusLabel[d.trangThai]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {d.attachment ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Paperclip className="h-3.5 w-3.5 text-plan-700" />
                              <span className="max-w-[140px] truncate text-slate-600 dark:text-slate-300" title={`${d.attachment.fileName} · ${formatBytes(d.attachment.size)}`}>
                                {d.attachment.fileName}
                              </span>
                              <button
                                onClick={() => openAttachmentInNewTab(d.id)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-plan-700 dark:hover:bg-slate-700"
                                title="Xem PDF"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => downloadAttachment(d.id, d.attachment!.fileName)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700"
                                title="Tải về"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleRowRemoveFile(d)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700"
                                title="Xóa file"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">{s?.count ?? 0}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-900 dark:text-white">{fmtMoney(Math.round(s?.total ?? 0))}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(d)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => confirmDelete(d)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
