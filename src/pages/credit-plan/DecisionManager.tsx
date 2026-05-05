import { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  FileText,
  Paperclip,
  Eye,
  Download,
  Upload,
  CircleCheck,
  CircleDashed,
  Archive,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { useIsOwner } from '@/store/useAuthStore';
import {
  NGUON_VON_LIST,
  nguonVonListLabel,
  type Decision,
  type DecisionStatus,
} from '@/lib/credit-plan-types';
import {
  saveAttachmentBlob,
  deleteAttachmentBlob,
  getAttachmentBlob,
  openAttachmentInNewTab,
  downloadAttachment,
  formatBytes,
  MAX_ATTACHMENT_SIZE,
} from '@/lib/decision-attachments';
import {
  publishAttachment,
  unpublishAttachment,
  publicAttachmentUrl,
} from '@/lib/publish';

interface DecisionForm {
  soQD: string;
  ngayQD: string;
  tenQD: string;
  maNguonVonList: string[];
  ngayHieuLuc: string;
  trangThai: DecisionStatus;
  ghiChu: string;
  maNhaDauTu: string;
}

const emptyForm: DecisionForm = {
  soQD: '',
  ngayQD: '',
  tenQD: '',
  maNguonVonList: [],
  ngayHieuLuc: '',
  trangThai: 'active',
  ghiChu: '',
  maNhaDauTu: '',
};

const statusLabel: Record<DecisionStatus, string> = {
  draft: 'Nháp',
  active: 'Hiệu lực',
  archived: 'Lưu trữ',
};

const statusColor: Record<DecisionStatus, string> = {
  draft: 'bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800',
  archived: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800',
};

const statusIcon: Record<DecisionStatus, typeof CircleCheck> = {
  draft: CircleDashed,
  active: CircleCheck,
  archived: Archive,
};

function fmtMoney(n: number) {
  return n.toLocaleString('vi-VN');
}

/** Label chuẩn cho form — giúp alignment đều và required-marker nhất quán. */
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-plan-500 focus:outline-none focus:ring-1 focus:ring-plan-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500';

export function DecisionManager() {
  const decisions = useCreditPlanStore((s) => s.decisions);
  const plans = useCreditPlanStore((s) => s.plans);
  const addDecision = useCreditPlanStore((s) => s.addDecision);
  const updateDecision = useCreditPlanStore((s) => s.updateDecision);
  const deleteDecision = useCreditPlanStore((s) => s.deleteDecision);
  const isOwner = useIsOwner();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterNV, setFilterNV] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | DecisionStatus>('');

  // PDF attachment state (chỉ thao tác trong phiên chỉnh sửa)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
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
    if (filterNV && !d.maNguonVonList.includes(filterNV)) return false;
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
    if (!form.soQD || !form.ngayQD || form.maNguonVonList.length === 0) return;
    if (isSaving) return;
    setIsSaving(true);
    try {
      const existing = editId ? decisions.find((d) => d.id === editId) : undefined;
      const decisionId = editId ?? crypto.randomUUID();

      // Xử lý attachment trước để metadata kèm theo lúc save decision.
      // Cả hai bên: lưu IDB (owner đọc nhanh) + publish lên server tĩnh
      // (viewer mở qua URL công khai). Lỗi publish → ném lên catch ngoài
      // để báo cho người dùng — không làm im lặng.
      let nextAttachment = existing?.attachment;
      if (pendingFile) {
        await saveAttachmentBlob(decisionId, pendingFile);
        await publishAttachment(decisionId, pendingFile);
        nextAttachment = {
          fileName: pendingFile.name,
          size: pendingFile.size,
          mime: pendingFile.type || 'application/pdf',
          uploadedAt: new Date().toISOString(),
        };
      } else if (removeExistingFile && existing?.attachment) {
        await deleteAttachmentBlob(decisionId).catch(() => undefined);
        await unpublishAttachment(decisionId).catch(() => undefined);
        nextAttachment = undefined;
      }

      const hasNvXa = form.maNguonVonList.includes('3');
      const payload: Omit<Decision, 'id'> = {
        soQD: form.soQD.trim(),
        ngayQD: form.ngayQD,
        tenQD: form.tenQD.trim(),
        maNguonVonList: [...form.maNguonVonList].sort(),
        ngayHieuLuc: form.ngayHieuLuc || undefined,
        trangThai: form.trangThai,
        ghiChu: form.ghiChu.trim() || undefined,
        attachment: nextAttachment,
        maNhaDauTu: hasNvXa ? (form.maNhaDauTu.trim() || undefined) : undefined,
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
      maNguonVonList: [...d.maNguonVonList],
      ngayHieuLuc: d.ngayHieuLuc ?? '',
      trangThai: d.trangThai,
      ghiChu: d.ghiChu ?? '',
      maNhaDauTu: d.maNhaDauTu ?? '',
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
    await unpublishAttachment(d.id).catch(() => undefined);
    updateDecision(d.id, { attachment: undefined });
  };

  const confirmDelete = async (d: Decision) => {
    const s = stats.get(d.id);
    const msg = s
      ? `Xóa QĐ "${d.soQD}" sẽ xóa luôn ${s.count} dòng kế hoạch (tổng ${fmtMoney(s.total)} tr.đ). Tiếp tục?`
      : `Xóa QĐ "${d.soQD}"?`;
    if (!confirm(msg)) return;
    if (d.attachment) {
      await unpublishAttachment(d.id).catch(() => undefined);
    }
    deleteDecision(d.id);
  };

  // Viewer mở/tải PDF từ URL công khai. Owner ưu tiên blob trong IndexedDB
  // (đã có sẵn) — fallback URL trong trường hợp IDB rỗng (vd: vừa import dữ
  // liệu từ máy khác). Đặt fallback nhẹ này giúp owner luôn xem được file.
  const handleViewAttachment = async (d: Decision) => {
    if (isOwner) {
      const url = await openAttachmentInNewTab(d.id);
      if (url) return;
    }
    window.open(publicAttachmentUrl(d.id), '_blank', 'noopener');
  };

  const handleDownloadAttachment = async (d: Decision) => {
    if (!d.attachment) return;
    if (isOwner) {
      const blob = await getAttachmentBlob(d.id).catch(() => null);
      if (blob) {
        await downloadAttachment(d.id, d.attachment.fileName);
        return;
      }
    }
    const a = document.createElement('a');
    a.href = publicAttachmentUrl(d.id);
    a.download = d.attachment.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const totalPlannedAll = Array.from(stats.values()).reduce((a, b) => a + b.total, 0);
  const hasNvXa = form.maNguonVonList.includes('3');

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Quyết định</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Danh mục QĐ giao kế hoạch — dùng khi nhập kế hoạch dư nợ
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> Thêm QĐ
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tổng số QĐ</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{decisions.length}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">quyết định</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">QĐ hiệu lực</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {decisions.filter((d) => d.trangThai === 'active').length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">đang áp dụng</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tổng kế hoạch</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-plan-700 dark:text-plan-300">{fmtMoney(Math.round(totalPlannedAll))}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">triệu đồng</div>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editId ? 'Sửa Quyết định' : 'Thêm Quyết định'}</CardTitle>
            <CardDescription>
              {editId
                ? 'Thay đổi thông tin QĐ. Lưu ý: chỉnh sửa nguồn vốn có thể ảnh hưởng đến các dòng kế hoạch đã liên kết.'
                : 'Điền thông tin Quyết định trước khi nhập kế hoạch dư nợ theo QĐ này.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Section 1: thông tin cơ bản */}
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Thông tin Quyết định
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <FieldLabel required>Số QĐ</FieldLabel>
                  <input
                    className={inputClass}
                    value={form.soQD}
                    onChange={(e) => setForm((f) => ({ ...f, soQD: e.target.value }))}
                    placeholder="VD: 64/QĐ-NHCS"
                  />
                </div>
                <div>
                  <FieldLabel required>Ngày QĐ</FieldLabel>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.ngayQD}
                    onChange={(e) => setForm((f) => ({ ...f, ngayQD: e.target.value }))}
                  />
                </div>
                <div>
                  <FieldLabel>Ngày hiệu lực</FieldLabel>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.ngayHieuLuc}
                    onChange={(e) => setForm((f) => ({ ...f, ngayHieuLuc: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-3">
                  <FieldLabel>Tên / trích yếu</FieldLabel>
                  <input
                    className={inputClass}
                    value={form.tenQD}
                    onChange={(e) => setForm((f) => ({ ...f, tenQD: e.target.value }))}
                    placeholder="VD: Giao kế hoạch dư nợ tín dụng năm 2026"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: nguồn vốn & trạng thái */}
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Phạm vi & trạng thái
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <FieldLabel required>Nguồn vốn</FieldLabel>
                  <div className="flex flex-col gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm dark:border-slate-600 dark:bg-slate-700">
                    {NGUON_VON_LIST.map((n) => {
                      const checked = form.maNguonVonList.includes(n.ma);
                      return (
                        <label key={n.ma} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setForm((f) => ({
                                ...f,
                                maNguonVonList: checked
                                  ? f.maNguonVonList.filter((x) => x !== n.ma)
                                  : [...f.maNguonVonList, n.ma],
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-plan-700 focus:ring-plan-600"
                          />
                          {n.ten}
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Chọn một hoặc cả hai.</div>
                </div>

                <div>
                  <FieldLabel required={hasNvXa}>Mã nhà đầu tư</FieldLabel>
                  <input
                    className={`${inputClass} font-mono`}
                    value={form.maNhaDauTu}
                    onChange={(e) => setForm((f) => ({ ...f, maNhaDauTu: e.target.value }))}
                    disabled={!hasNvXa}
                    placeholder={hasNvXa ? 'VD: INV2503260091396' : 'Chỉ cho QĐ có NV Địa phương xã'}
                  />
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {hasNvXa
                      ? 'Dùng để nhận diện dòng CT=03 thuộc "Cho vay GQVL xã" trong Báo cáo 31.'
                      : 'Chọn Nguồn vốn "Địa phương xã" để nhập Mã NĐT.'}
                  </div>
                </div>

                <div>
                  <FieldLabel>Trạng thái</FieldLabel>
                  <select
                    className={inputClass}
                    value={form.trangThai}
                    onChange={(e) => setForm((f) => ({ ...f, trangThai: e.target.value as DecisionStatus }))}
                  >
                    <option value="draft">Nháp</option>
                    <option value="active">Hiệu lực</option>
                    <option value="archived">Lưu trữ</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: ghi chú */}
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ghi chú
              </div>
              <textarea
                className={inputClass}
                rows={2}
                value={form.ghiChu}
                onChange={(e) => setForm((f) => ({ ...f, ghiChu: e.target.value }))}
                placeholder="Ghi chú nội bộ (tùy chọn)"
              />
            </div>

            {/* Section 4: attachment */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  File PDF đính kèm
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                  Tối đa {formatBytes(MAX_ATTACHMENT_SIZE)}
                </div>
              </div>
              {(() => {
                const existing = editId ? decisions.find((d) => d.id === editId)?.attachment : undefined;
                const showExisting = existing && !pendingFile && !removeExistingFile;
                const hasAnyFileUi = showExisting || pendingFile || removeExistingFile;
                return (
                  <div className="space-y-2">
                    {showExisting && existing && (
                      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                        <Paperclip className="h-4 w-4 shrink-0 text-plan-700 dark:text-plan-300" />
                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={existing.fileName}>
                          {existing.fileName}
                        </span>
                        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{formatBytes(existing.size)}</span>
                        <button
                          type="button"
                          onClick={() => openAttachmentInNewTab(editId!)}
                          className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-plan-700 dark:hover:bg-slate-700 dark:hover:text-plan-300"
                          title="Xem"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveExistingFile(true)}
                          className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700"
                          title="Xóa file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {pendingFile && (
                      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-900/30">
                        <Paperclip className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                        <span className="min-w-0 flex-1 truncate text-emerald-800 dark:text-emerald-200" title={pendingFile.name}>
                          {pendingFile.name}
                          <span className="ml-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                            (sẽ lưu khi bấm {editId ? 'Cập nhật' : 'Lưu'})
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-emerald-700 dark:text-emerald-300">{formatBytes(pendingFile.size)}</span>
                        <button
                          type="button"
                          onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="rounded p-1 text-emerald-700 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                          title="Hủy file"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {removeExistingFile && (
                      <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm dark:border-rose-800 dark:bg-rose-900/30">
                        <Trash2 className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
                        <span className="flex-1 text-rose-800 dark:text-rose-200">
                          File sẽ bị xóa khi bấm {editId ? 'Cập nhật' : 'Lưu'}.
                        </span>
                        <button
                          type="button"
                          onClick={() => setRemoveExistingFile(false)}
                          className="rounded px-2 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/50"
                        >
                          Hoàn tác
                        </button>
                      </div>
                    )}

                    {!hasAnyFileUi && (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setFileDragOver(true); }}
                        onDragLeave={() => setFileDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setFileDragOver(false);
                          const f = e.dataTransfer.files?.[0];
                          if (f) handleFilePick(f);
                        }}
                        className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-5 text-center transition-colors ${
                          fileDragOver
                            ? 'border-plan-400 bg-plan-50 dark:border-plan-600 dark:bg-plan-900/20'
                            : 'border-slate-300 bg-slate-50/50 hover:border-plan-300 hover:bg-plan-50/40 dark:border-slate-600 dark:bg-slate-800/40 dark:hover:border-plan-700 dark:hover:bg-plan-900/10'
                        }`}
                      >
                        <Upload className="mb-2 h-6 w-6 text-slate-400 dark:text-slate-500" />
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                          Kéo thả file PDF vào đây hoặc
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="ml-1 font-medium text-plan-700 hover:underline dark:text-plan-300"
                          >
                            chọn file
                          </button>
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          Tối đa {formatBytes(MAX_ATTACHMENT_SIZE)} · .pdf
                        </p>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => { handleFilePick(e.target.files?.[0] ?? null); }}
                      className="hidden"
                    />
                    {fileError && (
                      <div className="text-xs text-rose-600 dark:text-rose-400">{fileError}</div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
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
      <div className="flex flex-wrap gap-2">
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
        <select
          className={`${inputClass} h-9 w-auto`}
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
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <th className="px-4 py-3">Số QĐ</th>
                  <th className="px-4 py-3">Ngày QĐ</th>
                  <th className="px-4 py-3">Tên / trích yếu</th>
                  <th className="px-4 py-3">Nguồn vốn</th>
                  <th className="px-4 py-3">Mã NĐT</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3 text-right">Số dòng</th>
                  <th className="px-4 py-3 text-right">Tổng KH (tr.đ)</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800">
                          <FileText className="h-6 w-6 text-slate-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            {decisions.length === 0 ? 'Chưa có Quyết định nào' : 'Không có kết quả phù hợp'}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {decisions.length === 0
                              ? 'Tạo QĐ để bắt đầu nhập kế hoạch dư nợ.'
                              : 'Thử thay đổi bộ lọc phía trên.'}
                          </div>
                        </div>
                        {decisions.length === 0 && isOwner && (
                          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
                            <Plus className="h-3.5 w-3.5" /> Thêm QĐ
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((d, idx) => {
                    const s = stats.get(d.id);
                    const StatusIc = statusIcon[d.trangThai];
                    return (
                      <tr
                        key={d.id}
                        className={`border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/50 ${
                          idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{d.soQD}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 dark:text-slate-300">{d.ngayQD}</td>
                        <td className="max-w-[260px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-300" title={d.tenQD}>
                          {d.tenQD || <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{nguonVonListLabel(d.maNguonVonList)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {d.maNhaDauTu ? d.maNhaDauTu : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusColor[d.trangThai]}`}>
                            <StatusIc className="h-3 w-3" />
                            {statusLabel[d.trangThai]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {d.attachment ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Paperclip className="h-3.5 w-3.5 shrink-0 text-plan-700 dark:text-plan-300" />
                              <span className="max-w-[140px] truncate text-slate-600 dark:text-slate-300" title={`${d.attachment.fileName} · ${formatBytes(d.attachment.size)}`}>
                                {d.attachment.fileName}
                              </span>
                              <button
                                onClick={() => handleViewAttachment(d)}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-plan-700 dark:hover:bg-slate-700 dark:hover:text-plan-300"
                                title="Xem PDF"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDownloadAttachment(d)}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700"
                                title="Tải về"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              {isOwner && (
                                <button
                                  onClick={() => handleRowRemoveFile(d)}
                                  className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-700"
                                  title="Xóa file"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">{s?.count ?? 0}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">{fmtMoney(Math.round(s?.total ?? 0))}</td>
                        <td className="px-4 py-2.5">
                          {isOwner ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => startEdit(d)}
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700"
                                title="Sửa"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => confirmDelete(d)}
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
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
