import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtNumber } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';
import type { HistogramBucket } from '@/lib/metrics';

export type HistogramChartType = 'bar' | 'hbar' | 'area';

export type HistogramUnit = 'loan' | 'customer';

interface Props {
  data: HistogramBucket[];
  onClick?: (bucket: HistogramBucket) => void;
  chartType?: HistogramChartType;
  unit?: HistogramUnit;
}

export function HistogramAmount({ data, onClick, chartType = 'bar', unit = 'loan' }: Props) {
  const cc = useChartColors();
  // Chuỗi chính của histogram — dùng slot sky (index 1) cho light/dark đều sáng rõ.
  const histColor = cc.palette[1];
  const handleBarClick = (d: any) => {
    const payload = d?.payload ?? d;
    if (payload && onClick) onClick(payload as HistogramBucket);
  };
  const handleChartClick = (e: any) => {
    const payload = e?.activePayload?.[0]?.payload;
    if (payload && onClick) onClick(payload as HistogramBucket);
  };
  const cursor = onClick ? 'pointer' : undefined;
  const unitLabel = unit === 'customer' ? 'khách hàng' : 'khế ước';

  const tooltipProps = {
    contentStyle: { fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text },
    formatter: (v: number) => [fmtNumber(v) + ' ' + unitLabel, 'Số lượng'],
  } as const;

  if (chartType === 'hbar') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(260, data.length * 36 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" fontSize={11} stroke={cc.axis} tickFormatter={fmtNumber as any} />
          <YAxis type="category" dataKey="bucket" width={80} fontSize={11} stroke={cc.axis} />
          <Tooltip {...tooltipProps} />
          <Bar
            dataKey="count"
            fill={histColor}
            radius={[0, 6, 6, 0]}
            onClick={handleBarClick}
            cursor={cursor}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart
          data={data}
          margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
          onClick={onClick ? handleChartClick : undefined}
          style={{ cursor: cursor }}
        >
          <defs>
            <linearGradient id="histGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={histColor} stopOpacity={0.4} />
              <stop offset="100%" stopColor={histColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" />
          <XAxis dataKey="bucket" fontSize={11} stroke={cc.axis} />
          <YAxis fontSize={11} stroke={cc.axis} tickFormatter={fmtNumber as any} />
          <Tooltip {...tooltipProps} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={histColor}
            strokeWidth={2}
            fill="url(#histGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  /* default: bar */
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" />
        <XAxis dataKey="bucket" fontSize={11} stroke={cc.axis} />
        <YAxis fontSize={11} stroke={cc.axis} tickFormatter={fmtNumber as any} />
        <Tooltip {...tooltipProps} />
        <Bar
          dataKey="count"
          fill={histColor}
          radius={[6, 6, 0, 0]}
          onClick={handleBarClick}
          cursor={cursor}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
