import { useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { fmtCompact, fmtCurrency, fmtNumber, fmtPercent } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';
import { cn } from '@/lib/utils';

export type HeatmapChartType = 'heatmap' | 'stackedBar';

/** Nhãn hiển thị tuỳ biến — cho phép cùng component dùng cho lịch đáo hạn
 *  (tongDuNo, "đến hạn theo GDXA") và lịch hết hạn khoanh (duNoKhoanh,
 *  "hết hạn khoanh"). Mặc định giữ nguyên hành vi cũ. */
export interface HeatmapLabels {
  popoverHeader: string;
  popoverFooter: string;
  emptyText: string;
  caption: string;
  countLabel: string;
  amountLabel: string;
  amountTotalLabel: string;
}

const DEFAULT_LABELS: HeatmapLabels = {
  popoverHeader: 'Đáo hạn theo tháng',
  popoverFooter: 'Số khế ước có ngày đến hạn theo GDXA rơi vào tháng này.',
  emptyText: 'Không có dữ liệu đáo hạn',
  caption:
    'Mỗi ô = số khế ước đến hạn theo tháng. Bấm vào ô để xem chi tiết dư nợ, tỷ trọng và chuyển sang danh sách khế ước.',
  countLabel: 'Số khế ước',
  amountLabel: 'Tổng dư nợ',
  amountTotalLabel: 'tổng dư nợ',
};

interface Props {
  data: { ym: string; count: number; tongDuNo: number }[];
  chartType?: HeatmapChartType;
  /** Called when user clicks a cell; receives "YYYY-MM" string */
  onClick?: (ym: string) => void;
  /** Tuỳ biến nhãn cho biến thể "khoanh expiry" / khác. Khi không truyền,
   *  dùng nhãn mặc định cho lịch đáo hạn (giữ tương thích ngược). */
  labels?: Partial<HeatmapLabels>;
}

const MONTH_LABELS_VI: Record<number, string> = {
  1: 'Tháng 1', 2: 'Tháng 2', 3: 'Tháng 3', 4: 'Tháng 4',
  5: 'Tháng 5', 6: 'Tháng 6', 7: 'Tháng 7', 8: 'Tháng 8',
  9: 'Tháng 9', 10: 'Tháng 10', 11: 'Tháng 11', 12: 'Tháng 12',
};

const MONTH_COLORS_LIGHT = [
  '#1d4ed8', '#2563eb', '#3b82f6', '#0891b2', '#06b6d4', '#14b8a6',
  '#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626', '#a21caf',
];
// Light-mode palette giảm sâu luminance khiến ô tháng cuối (magenta/đỏ/cam)
// bị glow khó chịu trên nền tối. Dark palette dịch lên -400 để đảm bảo mọi
// ô đều clear 3:1 so với slate-950 mà không chiếm attention quá mức.
const MONTH_COLORS_DARK = [
  '#60a5fa', '#93c5fd', '#bfdbfe', '#38bdf8', '#7dd3fc', '#5eead4',
  '#34d399', '#a3e635', '#facc15', '#fb923c', '#fb7185', '#c084fc',
];

export function HeatmapMaturity({
  data,
  chartType = 'heatmap',
  onClick,
  labels: labelOverrides,
}: Props) {
  const cc = useChartColors();
  const MONTH_COLORS = cc.isDark ? MONTH_COLORS_DARK : MONTH_COLORS_LIGHT;
  const L: HeatmapLabels = { ...DEFAULT_LABELS, ...labelOverrides };

  const byYear = useMemo(() => {
    const m = new Map<string, { month: number; v: typeof data[number] }[]>();
    for (const d of data) {
      const [y, mo] = d.ym.split('-');
      const arr = m.get(y) ?? [];
      arr.push({ month: Number(mo), v: d });
      m.set(y, arr);
    }
    return m;
  }, [data]);

  const years = useMemo(() => Array.from(byYear.keys()).sort(), [byYear]);
  const months = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], []);

  /* stacked bar data: one row per year, T1..T12 as keys */
  const stackedData = useMemo(() => {
    if (chartType !== 'stackedBar') return [];
    return years.map((y) => {
      const arr = byYear.get(y) ?? [];
      const row: Record<string, string | number> = { year: y };
      for (const m of months) {
        const found = arr.find((a) => a.month === m);
        row[`T${m}`] = found ? found.v.count : 0;
      }
      return row;
    });
  }, [years, byYear, chartType, months]);

  if (!data.length) {
    return (
      <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
        {L.emptyText}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const totalDuNo = data.reduce((s, d) => s + d.tongDuNo, 0);

  if (chartType === 'stackedBar') {
    return (
      <div className="space-y-2">
        <ResponsiveContainer width="100%" height={Math.max(300, years.length * 40 + 80)}>
          <BarChart data={stackedData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" />
            <XAxis dataKey="year" fontSize={11} stroke={cc.axis} />
            <YAxis tickFormatter={(v: number) => fmtCompact(v)} fontSize={11} stroke={cc.axis} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
              formatter={(v: number, name: string) => [fmtNumber(v) + ' khế ước', name]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {months.map((m, i) => (
              <Bar
                key={m}
                dataKey={`T${m}`}
                name={`T${m}`}
                stackId="a"
                fill={MONTH_COLORS[i]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="text-[10px] text-slate-500 dark:text-slate-400">
          Mỗi cột = tổng khế ước đến hạn trong năm, phân theo tháng.
        </div>
      </div>
    );
  }

  /* default: heatmap table */
  return (
    <div className="space-y-2">
      <div className="scrollbar-thin max-h-[440px] overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-white dark:bg-slate-800">
            <tr>
              <th className="bg-white dark:bg-slate-800 px-2 py-1 text-left text-slate-500 dark:text-slate-400">Năm</th>
              {months.map((m) => (
                <th key={m} className="bg-white dark:bg-slate-800 px-1 py-1 text-center text-slate-500 dark:text-slate-400">
                  T{m}
                </th>
              ))}
              <th className="border-l-2 border-slate-300 bg-slate-50 px-3 py-1 text-right text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200">
                Tổng
              </th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const arr = byYear.get(y) ?? [];
              const map = new Map(arr.map((a) => [a.month, a.v]));
              const yearCount = arr.reduce((s, a) => s + a.v.count, 0);
              const yearAmount = arr.reduce((s, a) => s + a.v.tongDuNo, 0);
              return (
                <tr key={y}>
                  <td className="px-2 py-1 font-semibold text-slate-700 dark:text-slate-200">{y}</td>
                  {months.map((m) => {
                    const c = map.get(m);
                    const intensity = c ? c.count / max : 0;
                    if (!c) {
                      return (
                        <td key={m} className="p-0.5">
                          <div
                            className="flex h-9 items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-medium text-slate-300 dark:text-slate-600"
                          >
                            ·
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={m} className="p-0.5">
                        <Popover.Root>
                          <Popover.Trigger asChild>
                            <button
                              type="button"
                              aria-label={`${MONTH_LABELS_VI[m]} ${y} — ${c.count} khế ước`}
                              className={cn(
                                'flex h-9 w-full items-center justify-center rounded text-[10px] font-medium',
                                'cursor-pointer text-slate-900 dark:text-slate-100 transition-transform',
                                'hover:scale-105 hover:ring-2 hover:ring-brand-400 hover:ring-offset-1',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1'
                              )}
                              style={{
                                background: `rgba(${cc.semantic.heatmapRgb}, ${0.12 + intensity * 0.72})`,
                                color: intensity > 0.5 ? 'white' : undefined,
                              }}
                            >
                              {fmtNumber(c.count)}
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content
                              side="top"
                              align="center"
                              sideOffset={6}
                              collisionPadding={12}
                              className={cn(
                                'z-50 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-lg',
                                'text-left text-slate-700 dark:text-slate-200',
                                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
                              )}
                            >
                              <div className="space-y-3">
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    {L.popoverHeader}
                                  </div>
                                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {MONTH_LABELS_VI[m]} {y}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                                  <div>
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{L.countLabel}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-slate-100">{fmtNumber(c.count)}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {fmtPercent(totalCount > 0 ? (c.count / totalCount) * 100 : 0)} tổng số
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{L.amountLabel}</div>
                                    <div className="text-base font-bold text-slate-900 dark:text-slate-100">{fmtCurrency(c.tongDuNo)}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {fmtPercent(totalDuNo > 0 ? (c.tongDuNo / totalDuNo) * 100 : 0)} {L.amountTotalLabel}
                                    </div>
                                  </div>
                                </div>
                                <div className="border-t border-slate-100 dark:border-slate-700 pt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                                  {L.popoverFooter}
                                </div>
                                {onClick && (
                                  <button
                                    type="button"
                                    onClick={() => onClick(`${y}-${String(m).padStart(2, '0')}`)}
                                    className="mt-2 w-full rounded-md bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-brand-700"
                                  >
                                    Xem danh sách khế ước
                                  </button>
                                )}
                              </div>
                              <Popover.Arrow className="fill-white dark:fill-slate-800" width={10} height={5} />
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap border-l-2 border-slate-300 bg-slate-50 px-3 py-1 text-right dark:border-slate-600 dark:bg-slate-700/40">
                    <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      {fmtNumber(yearCount)}
                    </div>
                    <div className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                      {fmtCompact(yearAmount)}
                    </div>
                  </td>
                </tr>
              );
            })}
            {/* Hàng tổng dưới cùng — tổng theo từng tháng + tổng toàn cục */}
            <tr className="border-t-2 border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700/60">
              <td className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                Tổng
              </td>
              {months.map((m) => {
                let count = 0;
                let amount = 0;
                for (const arr of byYear.values()) {
                  const e = arr.find((a) => a.month === m);
                  if (e) {
                    count += e.v.count;
                    amount += e.v.tongDuNo;
                  }
                }
                return (
                  <td key={m} className="whitespace-nowrap px-1 py-1.5 text-center">
                    <div className="text-[11px] font-bold tabular-nums text-slate-900 dark:text-white">
                      {count > 0 ? fmtNumber(count) : '·'}
                    </div>
                    <div className="text-[9px] tabular-nums text-slate-500 dark:text-slate-400">
                      {amount > 0 ? fmtCompact(amount) : ''}
                    </div>
                  </td>
                );
              })}
              <td className="whitespace-nowrap border-l-2 border-slate-300 bg-brand-50 px-3 py-1.5 text-right dark:border-slate-600 dark:bg-brand-500/15">
                <div className="text-sm font-extrabold tabular-nums text-brand-800 dark:text-brand-200">
                  {fmtNumber(totalCount)}
                </div>
                <div className="text-[10px] font-semibold tabular-nums text-brand-700/80 dark:text-brand-300/80">
                  {fmtCompact(totalDuNo)}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400">
        {L.caption}
      </div>
    </div>
  );
}
