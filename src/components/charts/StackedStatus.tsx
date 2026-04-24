import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Treemap,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { fmtCompact, fmtCurrency, fmtPercent } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';
import type { GroupAgg } from '@/lib/metrics';

export type StackedChartType = 'stacked' | 'grouped' | 'percent' | 'treemap';

interface Props {
  data: GroupAgg[];
  limit?: number;
  onClick?: (key: string) => void;
  chartType?: StackedChartType;
}

const STATUS_KEYS = ['duNoTrongHan', 'duNoQuaHan', 'duNoKhoanh'] as const;
const STATUS_LABELS: Record<string, string> = {
  duNoTrongHan: 'Trong hạn',
  duNoQuaHan: 'Quá hạn',
  duNoKhoanh: 'Khoanh',
};
export function StackedStatus({ data, limit = 10, onClick, chartType = 'stacked' }: Props) {
  const cc = useChartColors();
  const STATUS_COLORS = useMemo<Record<string, string>>(
    () => ({
      duNoTrongHan: cc.semantic.duNoTrongHan,
      duNoQuaHan: cc.semantic.duNoQuaHan,
      // Khoanh = amber — dùng slot amber (3) trong palette để đồng bộ với chart khác.
      duNoKhoanh: cc.palette[3],
    }),
    [cc.semantic.duNoTrongHan, cc.semantic.duNoQuaHan, cc.palette],
  );
  const DVUT_PALETTE = cc.palette;
  const top = data.slice(0, limit);
  const handleBarClick = (d: any) => {
    const key = d?.key ?? d?.payload?.key;
    if (key && onClick) onClick(key);
  };
  const cursor = onClick ? 'pointer' : undefined;
  const h = Math.max(260, top.length * 30 + 40);

  /* single pie: one slice per ĐVUT by total dư nợ */
  const dvutPieData = useMemo(() => {
    if (chartType !== 'percent') return { slices: [], total: 0 };
    const total = top.reduce(
      (s, d) => s + (d.duNoTrongHan || 0) + (d.duNoQuaHan || 0) + (d.duNoKhoanh || 0),
      0,
    );
    const slices = top.map((d, i) => {
      const v = (d.duNoTrongHan || 0) + (d.duNoQuaHan || 0) + (d.duNoKhoanh || 0);
      return {
        name: d.label,
        value: v,
        key: d.key,
        fill: DVUT_PALETTE[i % DVUT_PALETTE.length],
        pct: total > 0 ? (v / total) * 100 : 0,
      };
    }).filter((s) => s.value > 0);
    return { slices, total };
  }, [top, chartType, DVUT_PALETTE]);

  /* treemap flat data */
  const treemapData = useMemo(() => {
    if (chartType !== 'treemap') return [];
    return top.flatMap((d) =>
      STATUS_KEYS.map((sk) => ({
        name: `${d.label} — ${STATUS_LABELS[sk]}`,
        size: (d as any)[sk] as number || 0,
        fill: STATUS_COLORS[sk],
        key: d.key,
      })),
    ).filter((d) => d.size > 0);
  }, [top, chartType, STATUS_COLORS]);

  if (chartType === 'treemap') {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <Treemap
          data={treemapData}
          dataKey="size"
          nameKey="name"
          stroke="#fff"
          onClick={(node: any) => {
            const key = node?.key ?? node?.payload?.key;
            if (key && onClick) onClick(key);
          }}
          isAnimationActive={false}
        >
          {treemapData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} cursor={cursor} />
          ))}
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
            formatter={(v: number) => fmtCurrency(v)}
          />
        </Treemap>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'percent') {
    const { slices, total } = dvutPieData;
    return (
      <div className="flex items-center gap-6">
        <div className="h-[260px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                paddingAngle={2}
                label={({ pct }: any) => fmtPercent(pct, 1)}
                isAnimationActive={false}
                onClick={(d: any) => {
                  const key = d?.key ?? d?.payload?.key;
                  if (key && onClick) onClick(key);
                }}
                cursor={cursor}
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
                formatter={(v: number, name: string) => [fmtCurrency(v), name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 pr-2">
          {slices.map((s) => (
            <div
              key={s.key}
              onClick={() => onClick?.(s.key)}
              className={`flex items-center gap-2 rounded-md px-2 py-1 ${cursor ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''}`}
            >
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: s.fill }} />
              <div>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{s.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {fmtCurrency(s.value)} · <span className="font-semibold" style={{ color: s.fill }}>{fmtPercent(s.pct, 1)}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="border-t border-slate-100 dark:border-slate-700 pt-1 pl-2 text-[10px] text-slate-400 dark:text-slate-500">
            Tổng: {fmtCurrency(total)}
          </div>
        </div>
      </div>
    );
  }

  const isGrouped = chartType === 'grouped';

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={top} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={fmtCompact}
          fontSize={11}
          stroke={cc.axis}
        />
        <YAxis type="category" dataKey="label" width={140} fontSize={11} stroke={cc.axis} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
          formatter={(v: number) => fmtCurrency(v)}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="duNoTrongHan"
          name="Trong hạn"
          stackId={isGrouped ? undefined : 'a'}
          fill={STATUS_COLORS.duNoTrongHan}
          radius={isGrouped ? [4, 4, 4, 4] : [4, 0, 0, 4]}
          onClick={handleBarClick}
          cursor={cursor}
        />
        <Bar
          dataKey="duNoQuaHan"
          name="Quá hạn"
          stackId={isGrouped ? undefined : 'a'}
          fill={STATUS_COLORS.duNoQuaHan}
          radius={isGrouped ? [4, 4, 4, 4] : undefined}
          onClick={handleBarClick}
          cursor={cursor}
        />
        <Bar
          dataKey="duNoKhoanh"
          name="Khoanh"
          stackId={isGrouped ? undefined : 'a'}
          fill={STATUS_COLORS.duNoKhoanh}
          radius={isGrouped ? [4, 4, 4, 4] : [0, 4, 4, 0]}
          onClick={handleBarClick}
          cursor={cursor}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
