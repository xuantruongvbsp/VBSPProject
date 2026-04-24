import * as React from 'react';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InfoPopover } from '@/components/ui/InfoPopover';
import type { MetricExplanation } from '@/lib/metric-explanations';

export type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger';
export type Trend = 'up' | 'down' | 'flat';

// Dark tone tokens giảm độ bão hoà (500/10 + ring 500/25) để KPI không
// trông như một cảnh báo liên tục — 900/30 alpha cũ bị coi là "đã tô màu"
// và đánh cắp attention khỏi con số.
const toneMap: Record<Tone, { card: string; label: string; value: string; chip: string }> = {
  default: {
    card: 'bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800',
    label: 'text-slate-600 dark:text-slate-300',
    value: 'text-slate-900 dark:text-slate-100',
    chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  primary: {
    card: 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/25',
    label: 'text-brand-700 dark:text-brand-300',
    value: 'text-brand-900 dark:text-brand-200',
    chip: 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200',
  },
  success: {
    card: 'bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/25',
    label: 'text-emerald-700 dark:text-emerald-300',
    value: 'text-emerald-900 dark:text-emerald-200',
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  },
  warning: {
    card: 'bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/25',
    label: 'text-amber-700 dark:text-amber-300',
    value: 'text-amber-900 dark:text-amber-200',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  },
  danger: {
    card: 'bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/25',
    label: 'text-rose-700 dark:text-rose-300',
    value: 'text-rose-900 dark:text-rose-200',
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
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
