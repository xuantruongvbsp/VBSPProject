import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: 'danger' | 'warning';
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = 'warning',
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-5 shadow-2xl focus:outline-none dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start gap-3">
            <div
              className={
                tone === 'danger'
                  ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
              }
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-bold text-slate-900 dark:text-slate-100">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Đóng"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="ghost">Hủy</Button>
            </Dialog.Close>
            <Button
              type="button"
              variant={tone === 'danger' ? 'danger' : 'default'}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
