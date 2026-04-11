import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  METRIC_EXPLANATIONS,
  type MetricExplanation,
} from '@/lib/metric-explanations';

interface InfoPopoverProps {
  /** Diễn giải đầy đủ của chỉ tiêu. Ưu tiên dùng nếu được truyền vào. */
  explanation?: MetricExplanation;
  /** Hoặc tra cứu diễn giải theo khóa trong METRIC_EXPLANATIONS. */
  metricKey?: string;
  /** Lớp CSS bổ sung cho nút kích hoạt. */
  className?: string;
  /** Nhãn trợ năng cho nút (mặc định: "Xem diễn giải chỉ tiêu"). */
  ariaLabel?: string;
}

/**
 * Nút thông tin (ⓘ) mở popover hiển thị diễn giải chi tiết về một chỉ tiêu.
 *
 * Cách dùng:
 *   <InfoPopover explanation={METRIC_EXPLANATIONS.tongDuNo} />
 *   <InfoPopover metricKey="tongDuNo" />
 */
export function InfoPopover({
  explanation,
  metricKey,
  className,
  ariaLabel = 'Xem diễn giải chỉ tiêu',
}: InfoPopoverProps) {
  const data: MetricExplanation | undefined =
    explanation ?? (metricKey ? METRIC_EXPLANATIONS[metricKey] : undefined);

  if (!data) return null;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full',
            'text-slate-400 transition-colors',
            'hover:bg-slate-100 hover:text-slate-700',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1',
            className
          )}
        >
          <Info className="h-4 w-4" strokeWidth={2} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            'z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg',
            'text-left text-slate-700',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">
              {data.title}
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              {data.definition}
            </p>

            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Cách tính
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                {data.formula}
              </p>
            </div>

            {data.note && (
              <div className="space-y-1 border-t border-slate-100 pt-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Ghi chú
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  {data.note}
                </p>
              </div>
            )}
          </div>
          <Popover.Arrow className="fill-white" width={10} height={5} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
