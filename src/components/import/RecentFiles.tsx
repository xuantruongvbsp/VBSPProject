import { useEffect, useState, useCallback } from 'react';
import { FileSpreadsheet, Trash2, History, Loader2 } from 'lucide-react';
import {
  listRecentFiles,
  loadRecentFile,
  removeRecentFile,
  clearAllRecentFiles,
  type RecentFileMeta,
} from '@/lib/recent-files';
import { useDataStore } from '@/store/useDataStore';
import { fmtDate, fmtNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  /** Gọi khi tải lại tệp thành công (đóng dropzone, chuyển trang, v.v.) */
  onLoaded?: () => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

export function RecentFiles({ onLoaded }: Props) {
  const setData = useDataStore((s) => s.setData);
  const setError = useDataStore((s) => s.setError);
  const [items, setItems] = useState<RecentFileMeta[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listRecentFiles();
      setItems(list);
    } catch (e) {
      setItems([]);
      // Không làm gián đoạn luồng nhập tệp gốc nếu IndexedDB lỗi
      console.warn('Không đọc được danh sách tệp gần đây:', e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLoad = useCallback(
    async (id: string) => {
      setLoadingId(id);
      setError(null);
      try {
        const result = await loadRecentFile(id);
        if (!result) {
          setError('Không tìm thấy tệp đã lưu. Có thể đã bị xóa khỏi bộ nhớ trình duyệt.');
          await refresh();
          return;
        }
        setData(result.rows, result.meta.ngaySoLieu);
        onLoaded?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lỗi khi tải lại tệp');
      } finally {
        setLoadingId(null);
      }
    },
    [setData, setError, onLoaded, refresh]
  );

  const handleRemove = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await removeRecentFile(id);
        await refresh();
      } catch (err) {
        console.warn('Không xóa được tệp:', err);
      }
    },
    [refresh]
  );

  const handleClearAll = useCallback(async () => {
    if (!confirm('Xóa toàn bộ danh sách tệp gần đây? Hành động này không thể hoàn tác.')) return;
    try {
      await clearAllRecentFiles();
      await refresh();
    } catch (err) {
      console.warn('Không xóa được danh sách:', err);
    }
  }, [refresh]);

  if (items === null) {
    return null; // im lặng trong khi đọc IndexedDB lần đầu
  }
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Tệp đã nhập gần đây</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {items.length}
          </span>
        </div>
        <button
          onClick={handleClearAll}
          className="text-[11px] text-slate-500 hover:text-rose-600"
        >
          Xóa tất cả
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((it) => {
          const isLoading = loadingId === it.id;
          const disabled = loadingId !== null;
          return (
            <div
              key={it.id}
              className={cn(
                'group relative flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors',
                'hover:border-brand-400 hover:bg-brand-50',
                disabled && 'pointer-events-none opacity-60'
              )}
            >
              <button
                type="button"
                onClick={() => handleLoad(it.id)}
                disabled={disabled}
                className="absolute inset-0 rounded-xl"
                aria-label={`Mở lại tệp ${it.filename}`}
              />
              <div className="pointer-events-none mt-0.5 rounded-lg bg-white p-2 text-brand-700 shadow-sm">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
              </div>
              <div className="pointer-events-none min-w-0 flex-1">
                <div
                  className="truncate text-sm font-semibold text-slate-800"
                  title={it.filename}
                >
                  {it.filename}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {fmtNumber(it.totalRows)} khế ước · Ngày số liệu: {fmtDate(it.ngaySoLieu)}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  {formatBytes(it.size)} · Mở {formatRelative(it.lastOpenedAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => handleRemove(it.id, e)}
                title="Xóa khỏi danh sách"
                className="relative z-10 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-slate-400">
        Dữ liệu được lưu cục bộ trong trình duyệt. Xóa cache trình duyệt sẽ xóa luôn danh sách này.
      </p>
    </div>
  );
}
