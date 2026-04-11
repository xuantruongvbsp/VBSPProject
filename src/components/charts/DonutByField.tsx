import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { fmtCurrency, fmtNumber } from '@/lib/format';
import type { GroupAgg } from '@/lib/metrics';

const palette = ['#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#a21caf', '#4338ca', '#dc2626', '#0e7490'];

interface Props {
  data: GroupAgg[];
  metric?: 'tongDuNo' | 'soKheUoc' | 'soKhachHang';
  onClick?: (key: string) => void;
}

export function DonutByField({ data, metric = 'tongDuNo', onClick }: Props) {
  const top = data.slice(0, 8);
  const handleSliceClick = (d: any) => {
    const key = d?.key ?? d?.payload?.key;
    if (key && onClick) onClick(key);
  };
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
          onClick={handleSliceClick}
          cursor={onClick ? 'pointer' : undefined}
        >
          {top.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) =>
            metric === 'tongDuNo' ? fmtCurrency(v) : fmtNumber(v)
          }
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
