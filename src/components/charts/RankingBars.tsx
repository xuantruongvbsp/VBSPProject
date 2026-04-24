import { useChartColors } from '@/lib/useChartColors';

export type RankingChartType = 'bar' | 'lollipop';

interface RankingItem {
  label: string;
  v: number;
  idx: number;
}

interface Props {
  kpiLabel: string;
  items: RankingItem[];
  fmt: (v: number) => string;
  chartType?: RankingChartType;
}

export function RankingBars({ kpiLabel, items, fmt, chartType = 'bar' }: Props) {
  const palette = useChartColors().palette;
  const max = Math.max(...items.map((s) => s.v), 1);

  if (chartType === 'lollipop') {
    return (
      <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
        <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{kpiLabel}</div>
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className="w-24 truncate text-[10px] text-slate-600 dark:text-slate-300">{s.label}</div>
              <div className="relative h-4 flex-1">
                {/* line */}
                <div
                  className="absolute top-1/2 left-0 h-px -translate-y-1/2"
                  style={{
                    width: `${(s.v / max) * 100}%`,
                    background: palette[s.idx % palette.length],
                  }}
                />
                {/* dot */}
                <div
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
                  style={{
                    left: `calc(${(s.v / max) * 100}% - 5px)`,
                    background: palette[s.idx % palette.length],
                  }}
                />
              </div>
              <div className="w-20 text-right text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                {fmt(s.v)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* default: bar */
  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-700 p-3">
      <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{kpiLabel}</div>
      <div className="space-y-1.5">
        {items.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-24 truncate text-[10px] text-slate-600 dark:text-slate-300">{s.label}</div>
            <div className="relative h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${(s.v / max) * 100}%`,
                  background: palette[s.idx % palette.length],
                }}
              />
            </div>
            <div className="w-20 text-right text-[10px] font-semibold text-slate-700 dark:text-slate-200">
              {fmt(s.v)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
