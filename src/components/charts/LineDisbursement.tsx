import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtCompact, fmtCurrency } from '@/lib/format';

interface Props {
  data: { month: string; giaiNgan: number; soKheUoc: number }[];
  onClick?: (month: string) => void;
}

export function LineDisbursement({ data, onClick }: Props) {
  const handleClick = (e: any) => {
    const month = e?.activePayload?.[0]?.payload?.month;
    if (month && onClick) onClick(month);
  };
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={data}
        margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
        onClick={onClick ? handleClick : undefined}
        style={{ cursor: onClick ? 'pointer' : undefined }}
      >
        <defs>
          <linearGradient id="gnGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis dataKey="month" fontSize={10} stroke="#64748b" />
        <YAxis tickFormatter={fmtCompact} fontSize={10} stroke="#64748b" />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, name: string) =>
            name === 'giaiNgan' ? [fmtCurrency(v), 'Giải ngân'] : [v, 'Số khế ước']
          }
        />
        <Area type="monotone" dataKey="giaiNgan" stroke="#1d4ed8" strokeWidth={2} fill="url(#gnGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
