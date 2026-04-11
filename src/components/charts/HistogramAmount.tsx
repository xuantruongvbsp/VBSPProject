import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtNumber } from '@/lib/format';
import type { HistogramBucket } from '@/lib/metrics';

interface Props {
  data: HistogramBucket[];
  onClick?: (bucket: HistogramBucket) => void;
}

export function HistogramAmount({ data, onClick }: Props) {
  const handleBarClick = (d: any) => {
    const payload = d?.payload ?? d;
    if (payload && onClick) onClick(payload as HistogramBucket);
  };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis dataKey="bucket" fontSize={11} stroke="#64748b" />
        <YAxis fontSize={11} stroke="#64748b" tickFormatter={fmtNumber as any} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [fmtNumber(v) + ' khế ước', 'Số lượng']}
        />
        <Bar
          dataKey="count"
          fill="#0891b2"
          radius={[6, 6, 0, 0]}
          onClick={handleBarClick}
          cursor={onClick ? 'pointer' : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
