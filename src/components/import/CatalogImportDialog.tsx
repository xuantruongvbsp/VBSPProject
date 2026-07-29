import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface CatalogPreviewRow {
  /** Mã ĐGD / Mã NV */
  code: string;
  /** Tên ĐGD / Tên NV */
  name: string;
  /** Mã con: Mã thôn (cho ĐGD) hoặc Mã ĐGD (cho cán bộ) */
  items: string[];
  /** Mã con không tồn tại trong nguồn đối chiếu (BC 31 / danh mục ĐGD) */
  unknownItems: string[];
  /** Mã đã có trong danh mục hiện tại ⇒ import "gộp" sẽ ghi đè */
  isExisting: boolean;
}

export interface CatalogImportPreview {
  rows: CatalogPreviewRow[];
  issues: string[];
  /** Nhãn cột mã con, ví dụ "Mã thôn" */
  itemLabel: string;
  /** Nguồn đối chiếu mã con, ví dụ "Báo cáo 31" */
  itemSourceLabel: string;
  fileName: string;
}

/**
 * Hộp thoại xem trước kết quả đọc file Excel/CSV trước khi ghi vào danh mục.
 * Dùng chung cho danh mục Điểm giao dịch và danh mục Cán bộ.
 */
export function CatalogImportDialog({
  open,
  title,
  preview,
  existingCount,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  preview: CatalogImportPreview | null;
  existingCount: number;
  onCancel: () => void;
  onConfirm: (mode: 'merge' | 'replace') => void;
}) {
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');

  useEffect(() => {
    if (open) setMode(existingCount === 0 ? 'replace' : 'merge');
  }, [open, existingCount]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  const stats = useMemo(() => {
    if (!preview) return null;
    const newCount = preview.rows.filter((r) => !r.isExisting).length;
    const itemCount = preview.rows.reduce((s, r) => s + r.items.length, 0);
    const unknownCount = preview.rows.reduce((s, r) => s + r.unknownItems.length, 0);
    return {
      total: preview.rows.length,
      newCount,
      updateCount: preview.rows.length - newCount,
      itemCount,
      unknownCount,
    };
  }, [preview]);

  if (!open || !preview || !stats) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <FileSpreadsheet className="h-4 w-4 text-brand-700 dark:text-brand-300" />
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{preview.fileName}</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Đọc được" value={stats.total} />
            <Stat label="Thêm mới" value={stats.newCount} tone="ok" />
            <Stat label="Ghi đè (đã có)" value={stats.updateCount} tone={stats.updateCount ? 'warn' : 'neutral'} />
            <Stat label={preview.itemLabel} value={stats.itemCount} />
          </div>

          {stats.unknownCount > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {stats.unknownCount} {preview.itemLabel.toLowerCase()} không có trong{' '}
                {preview.itemSourceLabel} (in đỏ bên dưới). Vẫn import được, nhưng nên kiểm tra lại
                mã gõ sai hoặc mã đã sáp nhập.
              </span>
            </div>
          )}

          {preview.issues.length > 0 && (
            <ul className="space-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              {preview.issues.slice(0, 8).map((m, i) => (
                <li key={i}>• {m}</li>
              ))}
              {preview.issues.length > 8 && (
                <li className="italic text-slate-400">…và {preview.issues.length - 8} cảnh báo khác</li>
              )}
            </ul>
          )}

          <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">Mã</th>
                  <th className="px-3 py-1.5 font-semibold">Tên</th>
                  <th className="px-3 py-1.5 font-semibold">{preview.itemLabel}</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.rows.map((r) => {
                  const unknown = new Set(r.unknownItems);
                  return (
                    <tr key={r.code} className="align-top">
                      <td className="px-3 py-1.5 font-mono text-slate-700 dark:text-slate-200">{r.code}</td>
                      <td className="px-3 py-1.5 text-slate-800 dark:text-slate-100">{r.name}</td>
                      <td className="px-3 py-1.5">
                        {r.items.length === 0 ? (
                          <span className="italic text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {r.items.slice(0, 12).map((it) => (
                              <span
                                key={it}
                                className={cn(
                                  'rounded px-1.5 py-0.5 font-mono text-[11px]',
                                  unknown.has(it)
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                )}
                              >
                                {it}
                              </span>
                            ))}
                            {r.items.length > 12 && (
                              <span className="text-[11px] text-slate-500">+{r.items.length - 12}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {r.isExisting ? (
                          <span className="text-amber-700 dark:text-amber-300">đã có</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-300">mới</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
                disabled={existingCount === 0}
              />
              <span>
                Gộp vào danh mục hiện có ({existingCount}) — trùng mã sẽ bị ghi đè
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              <span className="text-rose-700 dark:text-rose-300">
                Thay thế toàn bộ danh mục hiện có
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              <X className="h-3.5 w-3.5" /> Hủy
            </Button>
            <Button size="sm" onClick={() => onConfirm(mode)} disabled={preview.rows.length === 0}>
              <Check className="h-3.5 w-3.5" /> Import {preview.rows.length} dòng
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn' | 'neutral';
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'
        : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200';
  return (
    <div className={cn('rounded-md border px-3 py-1.5', toneClass)}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-bold">{value.toLocaleString('vi-VN')}</div>
    </div>
  );
}
