import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Treemap,
  Legend,
  PieChart,
  Pie,
} from 'recharts';
import { useMemo } from 'react';
import { fmtCompact, fmtCurrency, fmtPercent } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';
import type { GroupAgg } from '@/lib/metrics';
import { cn } from '@/lib/utils';

export type BarGroupChartType = 'bar' | 'treemap' | 'pie';

/**
 * Chế độ màu của các thanh:
 * - `rainbow` (mặc định): mỗi thanh 1 màu trong palette categorical (8 hue).
 *    Dùng khi mỗi danh mục là 1 thực thể độc lập, không có thứ hạng.
 * - `monochrome`: tất cả thanh dùng 1 tông xám trung tính, riêng thanh
 *    có giá trị LỚN NHẤT (hoặc `highlightKey`) dùng màu accent. Dùng khi
 *    muốn nhấn mạnh đỉnh + giảm noise (theo khuyến nghị data-viz).
 * - `sequential`: gradient cùng 1 hue — đậm nhất ở giá trị cao nhất, nhạt
 *    dần về cuối. Dùng cho dữ liệu liên tục (số dư, mật độ).
 */
export type BarColorMode = 'rainbow' | 'monochrome' | 'sequential' | 'program' | 'dvut';
export type BarBaseHue = 'blue' | 'teal' | 'green' | 'purple' | 'amber' | 'rose';

interface Props {
  data: GroupAgg[];
  onClick?: (key: string) => void;
  highlightKey?: string;
  limit?: number;
  layout?: 'horizontal' | 'vertical';
  metric?: keyof GroupAgg;
  yAxisWidth?: number;
  charsPerLine?: number;
  chartType?: BarGroupChartType;
  /** Nhãn tooltip thay cho "Tổng dư nợ" mặc định — dùng khi metric khác tongDuNo */
  tooltipLabel?: string;
  /** Chế độ màu — xem chú thích `BarColorMode`. Default `rainbow`. */
  colorMode?: BarColorMode;
  /** Hue gốc dùng cho `monochrome` / `sequential`. Default `blue`. */
  baseHue?: BarBaseHue;
  /** Map khóa → hex. Khi truyền vào, sẽ ghi đè mọi colorMode cho cell có key trong map.
   *  Dùng để đồng nhất màu giữa nhiều chart (VD cùng "Định Quán" trên 2 chart). */
  colorByKey?: Record<string, string>;
  /** Chiều cao mỗi hàng (px) — tăng để bar dày & thưa hơn. Default 38. */
  rowHeight?: number;
  /** Cỡ chữ nhãn trục danh mục (tick). Default 10. */
  tickFontSize?: number;
  /** Cỡ chữ trục số. Default 11. */
  axisFontSize?: number;
}

// Hex của các hue cho monochrome/sequential — Atlassian symmetry 700/400.
const HUE_LIGHT: Record<BarBaseHue, string> = {
  blue: '#1d4ed8',
  teal: '#0f766e',
  green: '#15803d',
  purple: '#7e22ce',
  amber: '#b45309',
  rose: '#be123c',
};
const HUE_DARK: Record<BarBaseHue, string> = {
  blue: '#60a5fa',
  teal: '#2dd4bf',
  green: '#4ade80',
  purple: '#c084fc',
  amber: '#fbbf24',
  rose: '#fb7185',
};

/** Tính màu xám trung tính cho thanh "không nhấn" trong monochrome mode. */
function neutralBar(dark: boolean): string {
  return dark ? '#475569' : '#cbd5e1'; // slate-600 / slate-300
}

/**
 * Mapping màu cố định cho các chương trình tín dụng NHCSXH — dùng khi
 * colorMode='program'. Khớp theo từ khóa trong tên chương trình. Thứ tự
 * regex quan trọng (nhà ở phải đứng trước "ưu đãi hộ nghèo" để loại trừ
 * "hộ nghèo về nhà ở").
 */
const PROGRAM_COLOR_RULES: ReadonlyArray<{ match: RegExp; color: string }> = [
  { match: /(việc\s*l[àa]m|gqvl)/i,                         color: '#1A56DB' }, // Royal Blue
  { match: /(nước\s*sạch|vsmt|vệ\s*sinh\s*môi)/i,           color: '#0095A8' }, // Teal
  { match: /(học\s*sinh|sinh\s*viên|hssv|stem)/i,           color: '#22C55E' }, // Emerald
  { match: /nhà\s*ở/i,                                       color: '#D97706' }, // Amber
  { match: /cận\s*nghèo/i,                                   color: '#9333EA' }, // Purple
  { match: /(mới\s*thoát\s*nghèo|thoát\s*nghèo)/i,          color: '#C026D3' }, // Fuchsia
  { match: /chấp\s*hành/i,                                   color: '#6366F1' }, // Indigo
  { match: /(nước\s*ngoài|đtcs|đi\s*lao\s*động)/i,          color: '#BE185D' }, // Rose
  { match: /(ưu\s*đãi.*hộ\s*nghèo|^cho\s*vay\s*hộ\s*nghèo$|hộ\s*nghèo)/i, color: '#A855F7' }, // Violet
  { match: /khác/i,                                          color: '#94A3B8' }, // Slate Gray
];

function programColor(label: string, dark: boolean): string {
  for (const r of PROGRAM_COLOR_RULES) {
    if (r.match.test(label)) return r.color;
  }
  return dark ? '#64748b' : '#94a3b8'; // fallback slate
}

/** Mapping màu cố định cho Đơn vị ủy thác — dùng khi colorMode='dvut'.
 *  Mỗi hội đoàn có màu nhận diện truyền thống. */
const DVUT_COLOR_RULES: ReadonlyArray<{ match: RegExp; color: string }> = [
  { match: /(phụ\s*nữ|hội\s*lhpn)/i,           color: '#D81B60' }, // Pink (truyền thống Hội PN)
  { match: /(nông\s*dân|hnd)/i,                 color: '#2E7D32' }, // Green (nông nghiệp)
  { match: /(thanh\s*niên|đoàn\s*tn)/i,        color: '#1565C0' }, // Blue (áo xanh tình nguyện)
  { match: /(cựu\s*chiến\s*binh|cccb)/i,       color: '#5D4037' }, // Brown (lính, đất)
];

function dvutColor(label: string, dark: boolean): string {
  for (const r of DVUT_COLOR_RULES) {
    if (r.match.test(label)) return r.color;
  }
  return dark ? '#64748b' : '#94A3B8'; // slate gray fallback
}

/** Hex → rgba với alpha. Hỗ trợ #rrggbb. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function splitTwoLines(s: string, perLine: number): string[] {
  if (!s) return [''];
  if (s.length <= perLine) return [s];
  const ideal = Math.floor(s.length / 2);
  let bestFit = -1;
  let bestAny = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== ' ') continue;
    const left = i;
    const right = s.length - i - 1;
    if (left <= perLine && right <= perLine) {
      if (bestFit === -1 || Math.abs(i - ideal) < Math.abs(bestFit - ideal)) bestFit = i;
    }
    if (bestAny === -1 || Math.abs(i - ideal) < Math.abs(bestAny - ideal)) bestAny = i;
  }
  const splitAt = bestFit !== -1 ? bestFit : bestAny;
  if (splitAt === -1) {
    const line1 = s.slice(0, perLine);
    const tail = s.slice(perLine);
    const line2 = tail.length > perLine ? tail.slice(0, perLine - 1).trimEnd() + '…' : tail;
    return [line1, line2];
  }
  let line1 = s.slice(0, splitAt).trim();
  let line2 = s.slice(splitAt).trim();
  if (line1.length > perLine) line1 = line1.slice(0, perLine - 1).trimEnd() + '…';
  if (line2.length > perLine) line2 = line2.slice(0, perLine - 1).trimEnd() + '…';
  return [line1, line2];
}

function makeMultiLineTick(perLine: number, fillColor = '#475569', fontSize = 10) {
  return function MultiLineTick(props: any) {
    const { x, y, payload } = props;
    const value = String(payload?.value ?? '');
    const lines = splitTwoLines(value, perLine);
    const lineHeight = fontSize + 1;
    const startDy = lines.length === 1 ? 4 : -1;
    return (
      <g transform={`translate(${x}, ${y})`}>
        <text textAnchor="end" fontSize={fontSize} fill={fillColor}>
          <title>{value}</title>
          {lines.map((ln, i) => (
            <tspan key={i} x={-6} dy={i === 0 ? startDy : lineHeight}>
              {ln}
            </tspan>
          ))}
        </text>
      </g>
    );
  };
}

export function BarByGroup({
  data,
  onClick,
  highlightKey,
  limit = 12,
  layout = 'vertical',
  metric = 'tongDuNo',
  yAxisWidth = 220,
  charsPerLine = 28,
  chartType = 'bar',
  tooltipLabel = 'Tổng dư nợ',
  colorMode = 'rainbow',
  baseHue = 'blue',
  colorByKey,
  rowHeight = 38,
  tickFontSize = 10,
  axisFontSize = 11,
}: Props) {
  const cc = useChartColors();
  const palette = cc.palette;
  const highlightColor = cc.semantic.highlight;
  const trimmed = data.slice(0, limit);
  const isVertical = layout === 'vertical';
  const h = Math.max(280, trimmed.length * rowHeight + 40);
  const cursor = onClick ? 'pointer' : undefined;

  // Resolve màu cho từng cell theo colorMode.
  const accentHue = cc.isDark ? HUE_DARK[baseHue] : HUE_LIGHT[baseHue];
  const neutral = neutralBar(cc.isDark);
  const maxValue = useMemo(
    () => trimmed.reduce((m, d) => Math.max(m, (d as any)[metric] || 0), 0),
    [trimmed, metric],
  );
  const topKey = useMemo(() => {
    if (trimmed.length === 0) return undefined;
    let topVal = -Infinity;
    let topK: string | undefined;
    for (const d of trimmed) {
      const v = (d as any)[metric] as number || 0;
      if (v > topVal) {
        topVal = v;
        topK = d.key;
      }
    }
    return topK;
  }, [trimmed, metric]);

  /** Trả về fill cho cell theo index/giá trị. */
  const getCellColor = (d: GroupAgg, i: number): string => {
    // Override map có ưu tiên cao nhất — dùng để đồng nhất màu key qua nhiều chart.
    if (colorByKey && colorByKey[d.key]) return colorByKey[d.key];
    if (d.key === highlightKey) return highlightColor;
    if (colorMode === 'rainbow') {
      return palette[i % palette.length];
    }
    if (colorMode === 'monochrome') {
      // Thanh đỉnh (lớn nhất) dùng accent; còn lại neutral để giảm noise.
      return d.key === topKey ? accentHue : neutral;
    }
    if (colorMode === 'program') {
      // Mapping cố định theo tên chương trình tín dụng (NHCSXH).
      return programColor(d.label || d.key, cc.isDark);
    }
    if (colorMode === 'dvut') {
      return dvutColor(d.label || d.key, cc.isDark);
    }
    // sequential: opacity scaled theo value/maxValue (0.35 → 1.0)
    const v = (d as any)[metric] as number || 0;
    const ratio = maxValue > 0 ? v / maxValue : 0;
    const alpha = 0.35 + ratio * 0.65;
    return hexToRgba(accentHue, alpha);
  };

  /* treemap data */
  const treemapData = useMemo(() => {
    if (chartType !== 'treemap') return [];
    const items = trimmed.map((d, i) => ({
      name: d.label,
      size: (d as any)[metric] as number || 0,
      key: d.key,
      fill: getCellColor(d, i),
    })).filter((d) => d.size > 0);
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, chartType, metric, palette, colorMode, baseHue, cc.isDark, highlightKey, topKey]);

  const treemapTotal = useMemo(
    () => treemapData.reduce((s, d) => s + d.size, 0),
    [treemapData],
  );


  if (chartType === 'pie') {
    const pieData = trimmed
      .map((d, i) => ({
        key: d.key,
        label: d.label,
        value: (d as any)[metric] as number || 0,
        fill: getCellColor(d, i),
      }))
      .filter((d) => d.value > 0);
    const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

    const renderOuterLabel = (props: any) => {
      const { cx, cy, midAngle, outerRadius, percent, fill } = props;
      if (!percent || percent < 0.005) return null; // ẩn nhãn < 0,5% tránh rối
      const RAD = Math.PI / 180;
      const r = outerRadius + 16;
      const x = cx + r * Math.cos(-midAngle * RAD);
      const y = cy + r * Math.sin(-midAngle * RAD);
      return (
        <text
          x={x}
          y={y}
          fill={fill}
          fontSize={12}
          fontWeight={700}
          textAnchor={x > cx ? 'start' : 'end'}
          dominantBaseline="central"
        >
          {fmtPercent(percent * 100, 1)}
        </text>
      );
    };

    return (
      <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <ResponsiveContainer width="100%" height={340}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                onClick={(d: any) => onClick?.(d?.key ?? d?.payload?.key)}
                cursor={cursor}
                isAnimationActive={false}
                label={renderOuterLabel}
                labelLine={{ stroke: cc.axis, strokeWidth: 1 }}
              >
                {pieData.map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
                formatter={(v: number, _name: string, entry: any) => {
                  const pct = pieTotal > 0 ? (v / pieTotal) * 100 : 0;
                  return [`${fmtCurrency(v)} · ${fmtPercent(pct, 1)}`, entry?.payload?.label ?? ''];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex flex-col gap-2 text-[11px] lg:w-60 lg:shrink-0">
          {pieData.map((d) => {
            const pct = pieTotal > 0 ? (d.value / pieTotal) * 100 : 0;
            return (
              <li
                key={d.key}
                className={cn('flex items-start gap-2', onClick && 'cursor-pointer')}
                onClick={() => onClick?.(d.key)}
              >
                <span
                  className="mt-[5px] inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: d.fill }}
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-800 dark:text-slate-100" title={d.label}>
                    {d.label}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    {fmtCurrency(d.value)} · <span style={{ color: d.fill }}>{fmtPercent(pct, 1)}</span>
                  </div>
                </div>
              </li>
            );
          })}
          <li className="mt-1 border-t border-slate-200 pt-2 text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Tổng: {fmtCurrency(pieTotal)}
          </li>
        </ul>
      </div>
    );
  }

  if (chartType === 'treemap') {
    const renderContent = (props: any) => {
      const { x, y, width, height, name, root } = props;
      if (!width || !height || width < 4 || height < 4) return null;
      const val = props.size ?? props.value ?? 0;
      const idx = treemapData.findIndex((d) => d.name === name);
      const fill = idx >= 0 ? treemapData[idx].fill : palette[0];
      const pct = treemapTotal > 0 ? (val / treemapTotal) * 100 : 0;
      const showLabel = width > 60 && height > 40;
      const showPct = width > 30 && height > 20;
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={3}
            fill={fill}
            stroke="#fff"
            strokeWidth={2}
            style={{ cursor: cursor || 'default' }}
          />
          {showPct && (
            <text
              x={x + width / 2}
              y={y + height / 2 + (showLabel ? -6 : 0)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={showLabel ? 12 : 10}
              fill="#fff"
              fontWeight={700}
            >
              {fmtPercent(pct, 1)}
            </text>
          )}
          {showLabel && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fill="rgba(255,255,255,0.85)"
            >
              {name && name.length > Math.floor(width / 7)
                ? name.slice(0, Math.floor(width / 7) - 1) + '…'
                : name}
            </text>
          )}
        </g>
      );
    };

    return (
      <div>
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
            content={renderContent as any}
          />
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
          {treemapData.map((d, i) => (
            <span key={d.key} className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: d.fill }} />
              {d.name} — {fmtPercent(treemapTotal > 0 ? (d.size / treemapTotal) * 100 : 0, 1)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart
        data={trimmed}
        layout={isVertical ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        barCategoryGap="30%"
      >
        <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" horizontal={!isVertical} vertical={isVertical} />
        {isVertical ? (
          <>
            <XAxis type="number" tickFormatter={fmtCompact} fontSize={axisFontSize} stroke={cc.axis} />
            <YAxis
              type="category"
              dataKey="label"
              width={yAxisWidth}
              fontSize={tickFontSize}
              stroke={cc.axis}
              interval={0}
              tick={makeMultiLineTick(charsPerLine, cc.text, tickFontSize)}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="label" fontSize={axisFontSize} stroke={cc.axis} />
            <YAxis tickFormatter={fmtCompact} fontSize={axisFontSize} stroke={cc.axis} />
          </>
        )}
        <Tooltip
          cursor={{ fill: cc.cartesianBg }}
          contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
          formatter={(v: number) => [fmtCurrency(v), tooltipLabel]}
        />
        <Bar
          dataKey={metric as string}
          radius={[4, 4, 4, 4]}
          onClick={(d: any) => onClick?.(d?.key)}
          cursor={cursor}
        >
          {trimmed.map((d, i) => (
            <Cell key={d.key} fill={getCellColor(d, i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
