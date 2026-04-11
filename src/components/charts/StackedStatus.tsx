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
import { fmtCompact, fmtCurrency } from '@/lib/format';
import type { GroupAgg } from '@/lib/metrics';

interface Props {
  data: GroupAgg[];
  limit?: number;
  onClick?: (key: string) => void;
}

export function StackedStatus({ data, limit = 10, onClick }: Props) {
  const top = data.slice(0, limit);
  const handleBarClick = (d: any) => {
    const key = d?.key ?? d?.payload?.key;
    if (key && onClick) onClick(key);
  };
  const cursor = onClick ? 'pointer' : undefined;
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, top.length * 30 + 40)}>
      <BarChart data={top} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={fmtCompact} fontSize={11} stroke="#64748b" />
        <YAxis type="category" dataKey="label" width={140} fontSize={11} stroke="#64748b" />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => fmtCurrency(v)}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="duNoTrongHan"
          name="Trong hạn"
          stackId="a"
          fill="#16a34a"
          radius={[4, 0, 0, 4]}
          onClick={handleBarClick}
          cursor={cursor}
        />
        <Bar
          dataKey="duNoQuaHan"
          name="Quá hạn"
          stackId="a"
          fill="#dc2626"
          onClick={handleBarClick}
          cursor={cursor}
        />
        <Bar
          dataKey="duNoKhoanh"
          name="Khoanh"
          stackId="a"
          fill="#f59e0b"
          radius={[0, 4, 4, 0]}
          onClick={handleBarClick}
          cursor={cursor}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
