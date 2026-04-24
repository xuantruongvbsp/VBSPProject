import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Treemap,
} from 'recharts';
import { useMemo } from 'react';
import { fmtCompact, fmtCurrency, fmtNumber, fmtPercent } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';
import type { GroupAgg } from '@/lib/metrics';

export type DonutChartType = 'donut' | 'bar' | 'hbar' | 'treemap';

interface Props {
  data: GroupAgg[];
  metric?: 'tongDuNo' | 'soKheUoc' | 'soKhachHang';
  onClick?: (key: string) => void;
  chartType?: DonutChartType;
}

export function DonutByField({ data, metric = 'tongDuNo', onClick, chartType = 'donut' }: Props) {
  const cc = useChartColors();
  const palette = cc.palette;
  const top = data.slice(0, 8);
  const cursor = onClick ? 'pointer' : undefined;

  const handleClick = (d: any) => {
    const key = d?.key ?? d?.payload?.key;
    if (key && onClick) onClick(key);
  };

  const fmt = (v: number) => (metric === 'tongDuNo' ? fmtCurrency(v) : fmtNumber(v));

  const treemapData = useMemo(() => {
    if (chartType !== 'treemap') return [];
    return top.map((d, i) => ({
      name: d.label,
      size: (d as any)[metric] as number || 0,
      key: d.key,
      fill: palette[i % palette.length],
    })).filter((d) => d.size > 0);
  }, [top, chartType, metric, palette]);

  if (chartType === 'treemap') {
    return (
      <ResponsiveContainer width="100%" height={280}>
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
            formatter={(v: number) => fmt(v)}
          />
        </Treemap>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'bar' || chartType === 'hbar') {
    const isH = chartType === 'hbar';
    const h = isH ? Math.max(280, top.length * 32 + 40) : 280;
    return (
      <ResponsiveContainer width="100%" height={h}>
        <BarChart
          data={top}
          layout={isH ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" horizontal={!isH} vertical={isH} />
          {isH ? (
            <>
              <XAxis type="number" tickFormatter={fmtCompact} fontSize={11} stroke={cc.axis} />
              <YAxis type="category" dataKey="label" width={120} fontSize={11} stroke={cc.axis} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" fontSize={10} stroke={cc.axis} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis tickFormatter={fmtCompact} fontSize={11} stroke={cc.axis} />
            </>
          )}
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
            formatter={(v: number) => fmt(v)}
          />
          <Bar
            dataKey={metric}
            radius={[4, 4, 4, 4]}
            onClick={handleClick}
            cursor={cursor}
          >
            {top.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  /* default: donut — match "Dư nợ theo ĐVUT" (percent-mode) layout:
     donut có nhãn % bên ngoài + legend phải (tên · số tiền · %) + dòng Tổng. */
  const slices = top
    .map((d, i) => {
      const value = (d as any)[metric] as number || 0;
      return {
        name: d.label,
        value,
        key: d.key,
        fill: palette[i % palette.length],
      };
    })
    .filter((s) => s.value > 0);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const slicesWithPct = slices.map((s) => ({
    ...s,
    pct: total > 0 ? (s.value / total) * 100 : 0,
  }));

  return (
    <div className="flex items-center gap-6">
      <div className="h-[260px] flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slicesWithPct}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={100}
              paddingAngle={2}
              label={({ pct }: any) => fmtPercent(pct, 1)}
              isAnimationActive={false}
              onClick={handleClick}
              cursor={cursor}
            >
              {slicesWithPct.map((s, i) => (
                <Cell key={i} fill={s.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
              formatter={(v: number, name: string) => [fmt(v), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 pr-2">
        {slicesWithPct.map((s) => (
          <div
            key={s.key}
            onClick={() => onClick?.(s.key)}
            className={`flex items-center gap-2 rounded-md px-2 py-1 ${cursor ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''}`}
          >
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: s.fill }} />
            <div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{s.name}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {fmt(s.value)} · <span className="font-semibold" style={{ color: s.fill }}>{fmtPercent(s.pct, 1)}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="border-t border-slate-100 dark:border-slate-700 pt-1 pl-2 text-[10px] text-slate-400 dark:text-slate-500">
          Tổng: {fmt(total)}
        </div>
      </div>
    </div>
  );
}
