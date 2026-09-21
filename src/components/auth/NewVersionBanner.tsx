import { RefreshCw, X } from 'lucide-react';

interface NewVersionBannerProps {
  remoteBuildId: string | null;
  onReload: () => void;
  onDismiss: () => void;
}

/**
 * Thanh thông báo nổi (fixed) — KHÔNG phải modal/dialog nên tuyệt đối không
 * chặn thao tác. Người dùng có thể đang nhập Excel dở; modal chặn sẽ làm mất
 * công việc của họ.
 */
export function NewVersionBanner({ remoteBuildId, onReload, onDismiss }: NewVersionBannerProps) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-white px-4 py-3 shadow-lg dark:border-brand-800 dark:bg-slate-900">
      <div className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">
        Chủ máy đã cập nhật bản mới{remoteBuildId ? ` (build ${remoteBuildId})` : ''}. Tải lại
        trang để nhận bản mới.
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReload}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-800 dark:bg-brand-400 dark:text-slate-950 dark:hover:bg-brand-300"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Tải lại
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng thông báo"
          className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
