import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChartTypeOption<T extends string = string> {
  id: T;
  icon: LucideIcon;
  tooltip: string;
}

interface ChartSwitcherProps<T extends string> {
  options: ChartTypeOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ChartSwitcher<T extends string>({
  options,
  value,
  onChange,
}: ChartSwitcherProps<T>) {
  return (
    <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-600 dark:bg-slate-700">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            title={opt.tooltip}
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded transition-colors',
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
