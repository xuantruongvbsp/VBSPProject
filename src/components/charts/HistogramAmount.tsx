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
  Cell,
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

// Sequential palette blue → indigo → đen-đậm.
// Bucket có giá trị thấp dùng shade nhạt, giá trị cao dùng shade đậm — người
// xem đọc được "độ nặng" qua sắc thái mà không cần nhìn trục số.
const HIST_GRADIENT_LIGHT = ['#E0E7FF', '#C7D2FE', '#818CF8', '#4F46E5', '#3730A3', '#1E1B4B'];
// Dark mode đảo chiều: shade nhạt nhất ~indigo-300; shade đậm nhất ~indigo-100.
const HIST_GRADIENT_DARK = ['#312e81', '#3730a3', '#4338ca', '#6366f1', '#a5b4fc', '#e0e7ff'];

export function HistogramAmount({ data, onClick, chartType = 'bar', unit = 'loan' }: Props) {
  const cc = useChartColors();
  const gradient = cc.isDark ? HIST_GRADIENT_DARK : HIST_GRADIENT_LIGHT;
  // Mỗi bucket nhận 1 shade trong dải gradient theo thứ tự (giả định data
  // đã sắp xếp tăng dần theo khoảng giá trị, đúng với output của
  // `histogramTongDuNo`).
  const colorFor = (i: number, total: number): string => {
    if (total <= 1) return gradient[gradient.length - 1];
    const idx = Math.round((i / (total - 1)) * (gradient.length - 1));
    return gradient[idx];
  };
  // Vẫn giữ hist color base cho area chart (single tone gradient).
  const histColor = gradient[gradient.length - 2];
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
      <ResponsiveContainer width="100%" height={Math.max(360, data.length * 52 + 60)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
          barCategoryGap="30%"
        >
          <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" fontSize={11} stroke={cc.axis} tickFormatter={fmtNumber as any} />
          <YAxis type="category" dataKey="bucket" width={80} fontSize={11} stroke={cc.axis} />
          <Tooltip {...tooltipProps} />
          <Bar
            dataKey="count"
            radius={[0, 6, 6, 0]}
            onClick={handleBarClick}
            cursor={cursor}
          >
            {data.map((d, i) => (
              <Cell key={d.bucket} fill={colorFor(i, data.length)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={340}>
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
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={data}
        margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
        barCategoryGap="30%"
      >
        <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" />
        <XAxis dataKey="bucket" fontSize={11} stroke={cc.axis} />
        <YAxis fontSize={11} stroke={cc.axis} tickFormatter={fmtNumber as any} />
        <Tooltip {...tooltipProps} />
        <Bar
          dataKey="count"
          radius={[6, 6, 0, 0]}
          onClick={handleBarClick}
          cursor={cursor}
        >
          {data.map((d, i) => (
            <Cell key={d.bucket} fill={colorFor(i, data.length)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
