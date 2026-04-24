import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtCompact, fmtCurrency } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';

export type LineChartType = 'area' | 'line' | 'bar';

interface Props {
  data: { month: string; giaiNgan: number; soKheUoc: number }[];
  onClick?: (month: string) => void;
  chartType?: LineChartType;
}

export function LineDisbursement({ data, onClick, chartType = 'area' }: Props) {
  const cc = useChartColors();
  const seriesColor = cc.semantic.areaBase;
  const handleChartClick = (e: any) => {
    const month = e?.activePayload?.[0]?.payload?.month;
    if (month && onClick) onClick(month);
  };
  const handleBarClick = (d: any) => {
    const month = d?.month ?? d?.payload?.month;
    if (month && onClick) onClick(month);
  };

  const tooltipFormatter = (v: number, name: string) =>
    name === 'giaiNgan' ? [fmtCurrency(v), 'Giải ngân'] : [v, 'Số khế ước'];

  const sharedAxes = (
    <>
      <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" />
      <XAxis dataKey="month" fontSize={10} stroke={cc.axis} />
      <YAxis tickFormatter={fmtCompact} fontSize={10} stroke={cc.axis} />
      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }} formatter={tooltipFormatter} />
    </>
  );

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
          onClick={onClick ? handleChartClick : undefined}
          style={{ cursor: onClick ? 'pointer' : undefined }}
        >
          {sharedAxes}
          <Line
            type="monotone"
            dataKey="giaiNgan"
            stroke={seriesColor}
            strokeWidth={2}
            dot={{ r: 3, fill: seriesColor }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
        >
          {sharedAxes}
          <Bar
            dataKey="giaiNgan"
            fill={seriesColor}
            radius={[4, 4, 0, 0]}
            onClick={handleBarClick}
            cursor={onClick ? 'pointer' : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  /* default: area */
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={data}
        margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
        onClick={onClick ? handleChartClick : undefined}
        style={{ cursor: onClick ? 'pointer' : undefined }}
      >
        <defs>
          <linearGradient id="gnGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={seriesColor} stopOpacity={0.4} />
            <stop offset="100%" stopColor={seriesColor} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        {sharedAxes}
        <Area type="monotone" dataKey="giaiNgan" stroke={seriesColor} strokeWidth={2} fill="url(#gnGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
