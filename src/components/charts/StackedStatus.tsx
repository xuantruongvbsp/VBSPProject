import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Treemap,
  Cell,
  PieChart,
  Pie,
  ComposedChart,
  Line,
} from 'recharts';
import { fmtCompact, fmtCurrency, fmtPercent } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';
import type { GroupAgg } from '@/lib/metrics';

export type StackedChartType = 'stacked' | 'grouped' | 'percent' | 'treemap';

interface Props {
  data: GroupAgg[];
  limit?: number;
  onClick?: (key: string) => void;
  chartType?: StackedChartType;
  /** Khi true: pie + treemap dùng bảng màu hội đoàn (Pink/Green/Blue/Brown) match
   *  theo tên ĐVUT. Mặc định false (dùng palette categorical chung). */
  dvutColors?: boolean;
}

/** Bảng màu nhận diện hội đoàn — đồng nhất với BarByGroup colorMode='dvut'. */
const DVUT_COLOR_RULES: ReadonlyArray<{ match: RegExp; color: string }> = [
  { match: /(phụ\s*nữ|hội\s*lhpn)/i,        color: '#D81B60' },
  { match: /(nông\s*dân|hnd)/i,              color: '#2E7D32' },
  { match: /(thanh\s*niên|đoàn\s*tn)/i,     color: '#1565C0' },
  { match: /(cựu\s*chiến\s*binh|cccb)/i,    color: '#5D4037' },
];
function dvutColorOf(label: string, fallback: string): string {
  for (const r of DVUT_COLOR_RULES) if (r.match.test(label)) return r.color;
  return fallback;
}

const STATUS_KEYS = ['duNoTrongHan', 'duNoQuaHan', 'duNoKhoanh'] as const;
const STATUS_LABELS: Record<string, string> = {
  duNoTrongHan: 'Trong hạn',
  duNoQuaHan: 'Quá hạn',
  duNoKhoanh: 'Khoanh',
};
export function StackedStatus({ data, limit = 10, onClick, chartType = 'stacked', dvutColors = false }: Props) {
  const cc = useChartColors();
  const STATUS_COLORS = useMemo<Record<string, string>>(
    () => ({
      duNoTrongHan: cc.semantic.duNoTrongHan,
      duNoQuaHan: cc.semantic.duNoQuaHan,
      // Khoanh = amber — dùng slot amber (3) trong palette để đồng bộ với chart khác.
      duNoKhoanh: cc.palette[3],
    }),
    [cc.semantic.duNoTrongHan, cc.semantic.duNoQuaHan, cc.palette],
  );
  // Palette dùng cho pie/donut (mỗi item = 1 màu).
  // Dải Cyan → Indigo → Emerald → Amber: hài hoà nhưng vẫn dễ phân biệt.
  // 4 màu đầu là khuyến nghị cho top-4 CBTD; các slot sau dùng analogous palette.
  const DVUT_PALETTE = cc.isDark
    ? ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#c084fc', '#fb7185', '#2dd4bf', '#fb923c']
    : ['#0EA5E9', '#6366F1', '#10B981', '#F59E0B', '#9333EA', '#BE185D', '#0F766E', '#C2410C'];
  const top = data.slice(0, limit);
  const handleBarClick = (d: any) => {
    const key = d?.key ?? d?.payload?.key;
    if (key && onClick) onClick(key);
  };
  const cursor = onClick ? 'pointer' : undefined;
  const h = Math.max(260, top.length * 30 + 40);

  /* single pie: one slice per ĐVUT by total dư nợ */
  const dvutPieData = useMemo(() => {
    if (chartType !== 'percent') return { slices: [], total: 0 };
    const total = top.reduce(
      (s, d) => s + (d.duNoTrongHan || 0) + (d.duNoQuaHan || 0) + (d.duNoKhoanh || 0),
      0,
    );
    const slices = top.map((d, i) => {
      const v = (d.duNoTrongHan || 0) + (d.duNoQuaHan || 0) + (d.duNoKhoanh || 0);
      const fallback = DVUT_PALETTE[i % DVUT_PALETTE.length];
      return {
        name: d.label,
        value: v,
        key: d.key,
        fill: dvutColors ? dvutColorOf(d.label, fallback) : fallback,
        pct: total > 0 ? (v / total) * 100 : 0,
      };
    }).filter((s) => s.value > 0);
    return { slices, total };
  }, [top, chartType, DVUT_PALETTE, dvutColors]);

  /* treemap flat data */
  const treemapData = useMemo(() => {
    if (chartType !== 'treemap') return [];
    return top.flatMap((d) =>
      STATUS_KEYS.map((sk) => ({
        name: `${d.label} — ${STATUS_LABELS[sk]}`,
        size: (d as any)[sk] as number || 0,
        fill: STATUS_COLORS[sk],
        key: d.key,
      })),
    ).filter((d) => d.size > 0);
  }, [top, chartType, STATUS_COLORS]);

  /* Stacked/Grouped data: cộng dồn QH+Khoanh + tỷ lệ % riêng từng loại
     (so với tổng dư nợ của xã = TH+QH+Kh). Grouped mode vẽ 2 line riêng:
     "Tỷ lệ Quá hạn" và "Tỷ lệ Khoanh". */
  const topCombined = useMemo(
    () =>
      top.map((d) => {
        const th = d.duNoTrongHan || 0;
        const qh = d.duNoQuaHan || 0;
        const kh = d.duNoKhoanh || 0;
        const total = th + qh + kh;
        return {
          ...d,
          quaHanKhoanh: qh + kh,
          quaHanPct: total > 0 ? (qh / total) * 100 : 0,
          khoanhPct: total > 0 ? (kh / total) * 100 : 0,
        };
      }),
    [top],
  );

  if (chartType === 'treemap') {
    return (
      <ResponsiveContainer width="100%" height={h}>
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
            formatter={(v: number) => fmtCurrency(v)}
          />
        </Treemap>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'percent') {
    const { slices, total } = dvutPieData;
    return (
      <div className="flex items-center gap-6">
        <div className="h-[260px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={100}
                paddingAngle={4}
                label={({ pct }: any) => fmtPercent(pct, 1)}
                isAnimationActive={false}
                onClick={(d: any) => {
                  const key = d?.key ?? d?.payload?.key;
                  if (key && onClick) onClick(key);
                }}
                cursor={cursor}
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
                formatter={(v: number, name: string) => [fmtCurrency(v), name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 pr-2">
          {slices.map((s) => (
            <div
              key={s.key}
              onClick={() => onClick?.(s.key)}
              className={`flex items-center gap-2 rounded-md px-2 py-1 ${cursor ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''}`}
            >
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: s.fill }} />
              <div>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{s.name}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {fmtCurrency(s.value)} · <span className="font-semibold" style={{ color: s.fill }}>{fmtPercent(s.pct, 1)}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="border-t border-slate-100 dark:border-slate-700 pt-1 pl-2 text-[10px] text-slate-400 dark:text-slate-500">
            Tổng: {fmtCurrency(total)}
          </div>
        </div>
      </div>
    );
  }

  const isGrouped = chartType === 'grouped';
  // Bar "Trong hạn" dùng xanh dương — màu tài chính, đại diện cho ổn định/tin cậy.
  // 2 line: Tỷ lệ Quá hạn (đỏ cinnabar) + Tỷ lệ Khoanh (amber) — đúng semantic mapping.
  const TH_COLOR = cc.isDark ? '#60a5fa' : '#1d4ed8';   // blue 700↔400
  const QH_COLOR = cc.isDark ? '#fb7185' : '#dc2626';   // red 600↔rose 400
  const KH_COLOR = cc.isDark ? '#fbbf24' : '#b45309';   // amber 700↔400

  // Grouped → combo chart: Bar (Trong hạn) + Line (Quá hạn + Khoanh) trên trục Y phụ bên phải.
  // Hai trục có scale độc lập → đường QH+Khoanh không bị "đè bẹp" dù giá trị nhỏ hơn nhiều lần.
  if (isGrouped) {
    const ch = Math.max(380, top.length * 50 + 120);
    return (
      <ResponsiveContainer width="100%" height={ch}>
        <ComposedChart data={topCombined} margin={{ top: 16, right: 16, left: 8, bottom: 56 }} barCategoryGap="35%">
          <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            angle={-30}
            textAnchor="end"
            interval={0}
            height={60}
            fontSize={11}
            stroke={cc.axis}
          />
          <YAxis
            yAxisId="th"
            tickFormatter={fmtCompact}
            fontSize={11}
            stroke={TH_COLOR}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 0.2]}
            ticks={[0, 0.05, 0.1, 0.15, 0.2]}
            tickFormatter={(v: number) => `${v.toFixed(2)}%`}
            fontSize={11}
            stroke={cc.axis}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
            formatter={(v: number, _name, item: any) => {
              if (item?.dataKey === 'quaHanPct' || item?.dataKey === 'khoanhPct')
                return `${v.toFixed(2)}%`;
              return fmtCurrency(v);
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            yAxisId="th"
            dataKey="duNoTrongHan"
            name="Trong hạn"
            fill={TH_COLOR}
            radius={[4, 4, 0, 0]}
            onClick={handleBarClick}
            cursor={cursor}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="quaHanPct"
            name="Tỷ lệ Quá hạn"
            stroke={QH_COLOR}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 6, fill: QH_COLOR, stroke: cc.isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="khoanhPct"
            name="Tỷ lệ Khoanh"
            stroke={KH_COLOR}
            strokeWidth={2.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 6, fill: KH_COLOR, stroke: cc.isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // Stacked: cả 2 đại lượng trên cùng 1 trục, cộng dồn (giữ cảm giác "tổng dư nợ").
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart
        data={topCombined}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        barCategoryGap="30%"
      >
        <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={fmtCompact} fontSize={11} stroke={cc.axis} />
        <YAxis type="category" dataKey="label" width={140} fontSize={11} stroke={cc.axis} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
          formatter={(v: number) => fmtCurrency(v)}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="duNoTrongHan"
          name="Trong hạn"
          stackId="a"
          fill={STATUS_COLORS.duNoTrongHan}
          radius={[4, 0, 0, 4]}
          onClick={handleBarClick}
          cursor={cursor}
        />
        <Bar
          dataKey="quaHanKhoanh"
          name="Quá hạn + Khoanh"
          stackId="a"
          fill={QH_COLOR}
          radius={[0, 4, 4, 0]}
          onClick={handleBarClick}
          cursor={cursor}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
