import * as React from 'react';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InfoPopover } from '@/components/ui/InfoPopover';
import type { MetricExplanation } from '@/lib/metric-explanations';

export type Tone =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'forecast'
  | 'frozen'
  | 'teal'
  | 'alert';
export type Trend = 'up' | 'down' | 'flat';

// Tone tokens — màu pastel nhẹ + shadow mềm để cards trông "sang" không gắt.
// Hex map theo brief design thủ công:
//   danger  : #FEF2F2 / #991B1B / #FCA5A5  (red-50 / red-900 / red-300)
//   warning : #FFFBEB / #92400E / #FDE68A  (amber-50 / amber-800 / yellow-300)
//   forecast: #FAF5FF / #6B21A8 / #E9D5FF  (purple-50 / purple-800 / purple-200)
//   success : #F0FDF4 / #166534 / #BBF7D0  (green-50 / green-800 / green-200)
// Dùng `shadow-md shadow-slate-200/60` thay cho `ring-*` để cảm giác hiện đại hơn.
const toneMap: Record<Tone, { card: string; label: string; value: string; chip: string }> = {
  default: {
    card: 'bg-white shadow-md shadow-slate-200/60 dark:bg-slate-900 dark:shadow-slate-950/40',
    label: 'text-slate-600 dark:text-slate-300',
    value: 'text-slate-900 dark:text-slate-100',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  primary: {
    card: 'bg-brand-50 shadow-md shadow-slate-200/60 dark:bg-brand-500/10 dark:shadow-slate-950/40',
    label: 'text-brand-700 dark:text-brand-300',
    value: 'text-brand-900 dark:text-brand-200',
    chip: 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200',
  },
  success: {
    card: 'bg-green-50 shadow-md shadow-slate-200/60 dark:bg-green-500/10 dark:shadow-slate-950/40',
    label: 'text-green-800 dark:text-green-300',
    value: 'text-green-800 dark:text-green-200',
    chip: 'bg-green-200 text-green-900 dark:bg-green-500/20 dark:text-green-200',
  },
  warning: {
    card: 'bg-amber-50 shadow-md shadow-slate-200/60 dark:bg-amber-500/10 dark:shadow-slate-950/40',
    label: 'text-amber-800 dark:text-amber-300',
    value: 'text-amber-800 dark:text-amber-200',
    chip: 'bg-yellow-200 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  },
  danger: {
    card: 'bg-red-50 shadow-md shadow-slate-200/60 dark:bg-red-500/10 dark:shadow-slate-950/40',
    label: 'text-red-900 dark:text-red-300',
    value: 'text-red-900 dark:text-red-200',
    chip: 'bg-red-200 text-red-900 dark:bg-red-500/20 dark:text-red-200',
  },
  forecast: {
    card: 'bg-purple-50 shadow-md shadow-slate-200/60 dark:bg-purple-500/10 dark:shadow-slate-950/40',
    label: 'text-purple-800 dark:text-purple-300',
    value: 'text-purple-800 dark:text-purple-200',
    chip: 'bg-purple-200 text-purple-900 dark:bg-purple-500/20 dark:text-purple-200',
  },
  // Trạng thái "đóng băng" — sky-50 / sky-700 / sky-200 cho cảm giác tĩnh,
  // ổn định, đúng tinh thần nợ khoanh.
  frozen: {
    card: 'bg-sky-50 ring-1 ring-sky-200 shadow-md shadow-slate-200/60 dark:bg-sky-500/10 dark:ring-sky-500/30 dark:shadow-slate-950/40',
    label: 'text-sky-700 dark:text-sky-300',
    value: 'text-sky-800 dark:text-sky-200',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  },
  // Đối tượng "con người" (khách hàng) — teal nhấn khác với màu tiền tệ.
  teal: {
    card: 'bg-teal-50 ring-1 ring-teal-200 shadow-md shadow-slate-200/60 dark:bg-teal-500/10 dark:ring-teal-500/30 dark:shadow-slate-950/40',
    label: 'text-teal-700 dark:text-teal-300',
    value: 'text-teal-700 dark:text-teal-200',
    chip: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200',
  },
  // Cảnh báo "sắp đến hạn" — amber-600 ấm hơn warning chuẩn để gọi sự chú ý.
  alert: {
    card: 'bg-amber-50 ring-1 ring-amber-200 shadow-md shadow-slate-200/60 dark:bg-amber-500/10 dark:ring-amber-500/30 dark:shadow-slate-950/40',
    label: 'text-amber-700 dark:text-amber-300',
    value: 'text-amber-700 dark:text-amber-200',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  },
};

interface Props {
  label: string;
  value: number | string;
  caption?: string;
  delta?: number;
  trend?: Trend;
  tone?: Tone;
  icon?: React.ReactNode;
  formatter?: (v: number) => string;
  /** Diễn giải chỉ tiêu — hiển thị qua nút ⓘ ở góc trên bên phải. */
  info?: MetricExplanation;
  /** Hoặc truyền khóa diễn giải trong METRIC_EXPLANATIONS. */
  infoKey?: string;
}

export function KpiCard({
  label,
  value,
  caption,
  delta,
  trend = 'flat',
  tone = 'default',
  icon,
  formatter,
  info,
  infoKey,
}: Props) {
  const t = toneMap[tone];
  const numeric = typeof value === 'number';
  const motionValue = useSpring(0, { damping: 30, stiffness: 90 });
  const display = useTransform(motionValue, (latest) =>
    formatter ? formatter(latest) : Math.round(latest).toLocaleString('vi-VN')
  );

  React.useEffect(() => {
    if (numeric) {
      const c = animate(motionValue, value as number, { duration: 0.9, ease: 'easeOut' });
      return c.stop;
    }
  }, [value, numeric, motionValue]);

  const DeltaIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const deltaColor =
    trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend === 'down'
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-500 dark:text-slate-400';

  const hasInfo = info !== undefined || infoKey !== undefined;

  return (
    <div className={cn('relative overflow-hidden rounded-xl p-4 shadow-sm', t.card)}>
      <span className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-black/5 dark:bg-white/5" />
      {hasInfo && (
        <div className="absolute right-2 top-2 z-10">
          <InfoPopover explanation={info} metricKey={infoKey} />
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className={cn('text-xs font-semibold uppercase tracking-wide', t.label)}>
            {label}
          </div>
          {numeric ? (
            <motion.div className={cn('truncate text-2xl font-bold tracking-tight', t.value)}>
              {display}
            </motion.div>
          ) : (
            <div className={cn('truncate text-2xl font-bold tracking-tight', t.value)}>
              {value}
            </div>
          )}
          {caption && <div className="text-xs text-slate-500 dark:text-slate-400">{caption}</div>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {icon && (
            <div className={cn('rounded-full p-1.5', t.chip)}>{icon}</div>
          )}
          {delta !== undefined && (
            <div className={cn('flex items-center gap-1 text-xs font-semibold', deltaColor)}>
              <DeltaIcon className="h-3 w-3" />
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
