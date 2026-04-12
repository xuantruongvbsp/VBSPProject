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
import { fmtCompact, fmtCurrency, fmtNumber } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';
import type { GroupAgg } from '@/lib/metrics';

export type DonutChartType = 'donut' | 'bar' | 'hbar' | 'treemap';

const palette = ['#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#a21caf', '#4338ca', '#dc2626', '#0e7490'];

interface Props {
  data: GroupAgg[];
  metric?: 'tongDuNo' | 'soKheUoc' | 'soKhachHang';
  onClick?: (key: string) => void;
  chartType?: DonutChartType;
}

export function DonutByField({ data, metric = 'tongDuNo', onClick, chartType = 'donut' }: Props) {
  const cc = useChartColors();
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
  }, [top, chartType, metric]);

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

  /* default: donut */
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={top}
          dataKey={metric}
          nameKey="label"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          onClick={handleClick}
          cursor={cursor}
        >
          {top.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
          formatter={(v: number) => fmt(v)}
        />
        <Legend
          verticalAlign="bottom"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
