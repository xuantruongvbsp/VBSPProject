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
} from 'recharts';
import { useMemo } from 'react';
import { fmtCompact, fmtCurrency, fmtPercent } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';
import type { GroupAgg } from '@/lib/metrics';

export type BarGroupChartType = 'bar' | 'treemap';

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
}

const palette = ['#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#a21caf', '#4338ca'];

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

function makeMultiLineTick(perLine: number, fillColor = '#475569') {
  return function MultiLineTick(props: any) {
    const { x, y, payload } = props;
    const value = String(payload?.value ?? '');
    const lines = splitTwoLines(value, perLine);
    const lineHeight = 11;
    const startDy = lines.length === 1 ? 4 : -1;
    return (
      <g transform={`translate(${x}, ${y})`}>
        <text textAnchor="end" fontSize={10} fill={fillColor}>
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
}: Props) {
  const cc = useChartColors();
  const trimmed = data.slice(0, limit);
  const isVertical = layout === 'vertical';
  const h = Math.max(280, trimmed.length * 38 + 40);
  const cursor = onClick ? 'pointer' : undefined;

  /* treemap data */
  const treemapData = useMemo(() => {
    if (chartType !== 'treemap') return [];
    const items = trimmed.map((d, i) => ({
      name: d.label,
      size: (d as any)[metric] as number || 0,
      key: d.key,
      fill: palette[i % palette.length],
    })).filter((d) => d.size > 0);
    return items;
  }, [trimmed, chartType, metric]);

  const treemapTotal = useMemo(
    () => treemapData.reduce((s, d) => s + d.size, 0),
    [treemapData],
  );


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
      >
        <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" horizontal={!isVertical} vertical={isVertical} />
        {isVertical ? (
          <>
            <XAxis type="number" tickFormatter={fmtCompact} fontSize={11} stroke={cc.axis} />
            <YAxis
              type="category"
              dataKey="label"
              width={yAxisWidth}
              fontSize={11}
              stroke={cc.axis}
              interval={0}
              tick={makeMultiLineTick(charsPerLine, cc.text)}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="label" fontSize={11} stroke={cc.axis} />
            <YAxis tickFormatter={fmtCompact} fontSize={11} stroke={cc.axis} />
          </>
        )}
        <Tooltip
          cursor={{ fill: cc.cartesianBg }}
          contentStyle={{ fontSize: 12, borderRadius: 8, background: cc.tooltipBg, borderColor: cc.tooltipBorder, color: cc.text }}
          formatter={(v: number) => [fmtCurrency(v), 'Tổng dư nợ']}
        />
        <Bar
          dataKey={metric as string}
          radius={[4, 4, 4, 4]}
          onClick={(d: any) => onClick?.(d?.key)}
          cursor={cursor}
        >
          {trimmed.map((d, i) => (
            <Cell
              key={d.key}
              fill={d.key === highlightKey ? '#dc2626' : palette[i % palette.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
