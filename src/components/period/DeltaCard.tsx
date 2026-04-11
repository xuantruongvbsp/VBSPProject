// Thẻ KPI hiển thị giá trị kỳ trước → kỳ sau và phần thay đổi.
// Khác với KpiCard thường (chỉ một con số), DeltaCard luôn cho thấy
// "đã thay đổi như thế nào" — đặc trưng cốt lõi của ứng dụng so sánh.

import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DeltaTone = 'neutral' | 'good-up' | 'bad-up';

interface Props {
  label: string;
  prevValue: number;
  currValue: number;
  formatter: (n: number) => string;
  /** Diễn giải dòng phụ dưới giá trị (ví dụ "tỷ lệ NQH"). Tùy chọn. */
  caption?: string;
  /**
   * Cách hiểu chiều biến thiên:
   *  - good-up: tăng = tốt (xanh lá), giảm = xấu (đỏ). Ví dụ: tổng dư nợ.
   *  - bad-up:  tăng = xấu (đỏ),  giảm = tốt (xanh lá). Ví dụ: NQH.
   *  - neutral: chỉ hiển thị màu xám trung tính.
   */
  tone?: DeltaTone;
  /** Nếu có pctOverride (đã chuẩn bị bên ngoài: 0..1), dùng thay vì delta/prev */
  pctOverride?: number | null;
  /**
   * Khi `primary='abs'` (ví dụ "Tỷ lệ NQH"), giá trị bản thân đã là phần
   * trăm — chỉ cần hiện chênh lệch tuyệt đối, không tính tỷ lệ %. Mặc định
   * `pct`: hiện cả số tuyệt đối và phần trăm cùng lúc.
   */
  primary?: 'pct' | 'abs';
}

export function DeltaCard({
  label,
  prevValue,
  currValue,
  formatter,
  caption,
  tone = 'neutral',
  pctOverride,
  primary = 'pct',
}: Props) {
  const delta = currValue - prevValue;
  const pct =
    pctOverride !== undefined ? pctOverride : prevValue === 0 ? null : delta / prevValue;

  const direction: 'up' | 'down' | 'flat' =
    Math.abs(delta) < 1e-9 ? 'flat' : delta > 0 ? 'up' : 'down';

  let color = 'text-slate-500';
  if (tone !== 'neutral' && direction !== 'flat') {
    const isGood = tone === 'good-up' ? direction === 'up' : direction === 'down';
    color = isGood ? 'text-emerald-600' : 'text-rose-600';
  }

  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const showPct = primary !== 'abs' && pct !== null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {formatter(currValue)}
      </div>
      {caption && <div className="mt-0.5 text-[11px] text-slate-500">{caption}</div>}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-400">Kỳ trước: {formatter(prevValue)}</span>
        <span className={cn('inline-flex items-center gap-1 font-semibold', color)}>
          <Icon className="h-3 w-3 shrink-0" />
          <span>
            {delta > 0 ? '+' : ''}
            {formatter(delta)}
          </span>
          {showPct && (
            <span className="text-[10px] font-medium opacity-80">
              ({pct! > 0 ? '+' : ''}
              {(pct! * 100).toFixed(2)}%)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
