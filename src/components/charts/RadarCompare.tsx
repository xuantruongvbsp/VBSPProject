import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { fmtNumber } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';

export type RadarChartType = 'radar' | 'groupedBar';

interface Props {
  data: Array<Record<string, string | number>>;
  groups: Array<{ label: string }>;
  chartType?: RadarChartType;
}

export function RadarCompare({ data, groups, chartType = 'radar' }: Props) {
  const cc = useChartColors();
  const palette = cc.palette;
  if (chartType === 'groupedBar') {
    return (
      <>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 60 }}>
            <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="metric"
              fontSize={9}
              stroke={cc.axis}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={70}
            />
            <YAxis
              fontSize={10}
              stroke={cc.axis}
              tickFormatter={(v: number) => fmtNumber(v)}
              domain={[0, 100]}
            />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {groups.map((g, i) => (
              <Bar
                key={g.label}
                dataKey={g.label}
                fill={palette[i % palette.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
          Mỗi chỉ tiêu được chuẩn hóa theo giá trị lớn nhất trong nhóm so sánh (max = 100).
        </div>
      </>
    );
  }

  /* default: radar */
  return (
    <>
      <ResponsiveContainer width="100%" height={360}>
        <RadarChart data={data} outerRadius={120}>
          <PolarGrid stroke={cc.grid} />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: cc.text }} />
          <PolarRadiusAxis angle={90} tick={{ fontSize: 9 }} />
          {groups.map((g, i) => (
            <Radar
              key={g.label}
              name={g.label}
              dataKey={g.label}
              stroke={palette[i % palette.length]}
              fill={palette[i % palette.length]}
              fillOpacity={0.2}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
        Mỗi chỉ tiêu được chuẩn hóa theo giá trị lớn nhất trong nhóm so sánh (max = 100).
      </div>
    </>
  );
}
