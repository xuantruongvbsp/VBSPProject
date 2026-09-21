import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Download, HardDriveDownload, Upload, X } from 'lucide-react';
import {
  downloadAppBackup,
  hasBackupData,
  readAppBackup,
  restoreAppBackup,
  type AppBackup,
} from '@/lib/app-backup';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function AppBackupMenu() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AppBackup | null>(null);
  const canExport = hasBackupData();

  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            title="Sao lưu và khôi phục dữ liệu cấu hình"
          >
            <HardDriveDownload className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Sao lưu</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={8}
            align="end"
            className="z-40 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3 px-2 pb-2 pt-1">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Sao lưu dữ liệu</div>
                <div className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  Danh mục, quyết định, kế hoạch và PDF đính kèm
                </div>
              </div>
              <Popover.Close className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Đóng">
                <X className="h-3.5 w-3.5" />
              </Popover.Close>
            </div>

            <button
              type="button"
              disabled={!canExport}
              onClick={() => {
                setError(null);
                void (async () => {
                  try {
                    await downloadAppBackup();
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Không thể xuất bản sao lưu.');
                  }
                })();
              }}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4 text-brand-600 dark:text-brand-300" />
              <span>
                <span className="block font-semibold">Xuất bản sao lưu</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Lưu thành một tệp nén .json.gz</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                inputRef.current?.click();
              }}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Upload className="h-4 w-4 text-plan-700 dark:text-plan-300" />
              <span>
                <span className="block font-semibold">Khôi phục từ tệp</span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">Thay dữ liệu cấu hình trên máy này</span>
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,application/gzip,.json,.json.gz,.gz"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                try {
                  setPending(await readAppBackup(file));
                  setError(null);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Không đọc được tệp sao lưu.');
                }
              }}
            />

            {error && (
              <div role="alert" className="mx-2 mt-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs leading-5 text-rose-700 dark:border-rose-800 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Khôi phục bản sao lưu?"
        description="Danh mục cán bộ, điểm giao dịch, quyết định, kế hoạch và PDF đính kèm hiện tại trên máy này sẽ được thay bằng dữ liệu trong tệp sao lưu."
        confirmLabel="Khôi phục dữ liệu"
        onConfirm={() => {
          if (!pending) return;
          void (async () => {
            try {
              await restoreAppBackup(pending);
              window.location.reload();
            } catch {
              setPending(null);
              setError('Không thể lưu bản sao trên trình duyệt này. Dữ liệu cũ đã được giữ nguyên.');
            }
          })();
        }}
      />
    </>
  );
}
