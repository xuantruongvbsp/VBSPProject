import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Legend,
  Cell,
} from 'recharts';
import { fmtDate, fmtNguonVon, fmtPercent, fmtTyAxis } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';
import type { LoanRecord } from '@/lib/types';

export type GrowthDimension = 'tenChuongTrinh' | 'nguonVon' | 'tenXa';

interface Props {
  prevRows: LoanRecord[];
  currRows: LoanRecord[];
  prevDate: Date | null;
  currDate: Date | null;
  dimension: GrowthDimension;
}

const TY = 1e9;

const BLUE_LIGHT = '#3b82f6';
const BLUE_DARK = '#60a5fa';
const YELLOW_LIGHT = '#facc15';
const YELLOW_DARK = '#fbbf24';
const RED_LIGHT = '#dc2626';
const RED_DARK = '#f87171';

interface RowDatum {
  name: string;
  base: number;
  cap: number;
  prev: number;
  curr: number;
  delta: number;
  isGrowth: boolean;
  total: number;
}

const OTHER_KEY = '__OTHER__';

function aggregate(rows: LoanRecord[], dim: GrowthDimension): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const raw = String(r[dim] ?? '').trim();
    const k = raw && raw !== '—' ? raw : OTHER_KEY;
    m.set(k, (m.get(k) ?? 0) + (r.tongDuNo || 0));
  }
  return m;
}

export function PeriodGrowthStacked({
  prevRows,
  currRows,
  prevDate,
  currDate,
  dimension,
}: Props) {
  const cc = useChartColors();
  const blue = cc.isDark ? BLUE_DARK : BLUE_LIGHT;
  const yellow = cc.isDark ? YELLOW_DARK : YELLOW_LIGHT;
  const red = cc.isDark ? RED_DARK : RED_LIGHT;

  const data: RowDatum[] = useMemo(() => {
    const prevMap = aggregate(prevRows, dimension);
    const currMap = aggregate(currRows, dimension);
    const keys = new Set<string>([...prevMap.keys(), ...currMap.keys()]);
    const rows: RowDatum[] = [];
    for (const k of keys) {
      const p = prevMap.get(k) ?? 0;
      const c = currMap.get(k) ?? 0;
      if (p === 0 && c === 0) continue;
      const d = c - p;
      const isGrowth = d >= 0;
      const displayName =
        k === OTHER_KEY ? 'Khác' : dimension === 'nguonVon' ? fmtNguonVon(k) : k;
      rows.push({
        name: displayName,
        base: isGrowth ? p : c,
        cap: Math.abs(d),
        prev: p,
        curr: c,
        delta: d,
        isGrowth,
        total: isGrowth ? c : p,
      });
    }
    // If empty after filtering or only one distinct value, collapse to a single overall row.
    if (rows.length <= 1) {
      const p = [...prevMap.values()].reduce((s, v) => s + v, 0);
      const c = [...currMap.values()].reduce((s, v) => s + v, 0);
      const d = c - p;
      const isGrowth = d >= 0;
      return [{
        name: 'Dư nợ',
        base: isGrowth ? p : c,
        cap: Math.abs(d),
        prev: p,
        curr: c,
        delta: d,
        isGrowth,
        total: isGrowth ? c : p,
      }];
    }
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [prevRows, currRows, dimension]);

  // Use horizontal Bar Chart for "Nguồn vốn" (few categories, long labels look
  // best as full-width rows). Other dimensions use vertical Column Chart.
  const isHorizontal = dimension === 'nguonVon';
  const axisMax = Math.max(...data.map((r) => r.total), 1) * (isHorizontal ? 1.28 : 1.18);

  const baseLegend = `Dư nợ gốc${prevDate ? ` (${fmtDate(prevDate)})` : ''}`;
  const capLegend = `Biến động${currDate ? ` (đến ${fmtDate(currDate)})` : ''}`;

  // Label renderers — branch on layout. In horizontal layout segments are wide
  // (use width thresholds); in vertical layout they're tall (use height).
  const renderBaseLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    const row = data[index];
    if (!row) return null;
    const cx = (x as number) + (width as number) / 2;
    const cy = (y as number) + (height as number) / 2;
    const span = isHorizontal ? (width as number) : (height as number);
    if (span < (isHorizontal ? 60 : 30)) return null;
    const baseLabel = row.isGrowth ? 'Gốc' : 'Còn lại';
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={700}
        fill="#ffffff"
      >
        <tspan x={cx} dy="-0.5em">{(row.base / TY).toFixed(2)} tỷ</tspan>
        <tspan x={cx} dy="1.2em" fontSize={10} fontWeight={500}>({baseLabel})</tspan>
      </text>
    );
  };

  const renderCapLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    const row = data[index];
    if (!row || row.cap === 0) return null;
    const sign = row.isGrowth ? '+' : '−';
    const w = width as number;
    const h = height as number;
    const cx = (x as number) + w / 2;
    const cy = (y as number) + h / 2;
    const inside = isHorizontal ? w >= 60 : h >= 28;
    // Inside the cap segment.
    if (inside) {
      const labelColor = row.isGrowth ? '#1f2937' : '#ffffff';
      const capLabel = row.isGrowth ? 'Tăng' : 'Giảm';
      return (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={700}
          fill={labelColor}
        >
          <tspan x={cx} dy="-0.5em">{sign}{(row.cap / TY).toFixed(2)} tỷ</tspan>
          <tspan x={cx} dy="1.2em" fontSize={9} fontWeight={500}>({capLabel})</tspan>
        </text>
      );
    }
    // Outside fallback.
    const outsideColor = row.isGrowth ? (cc.isDark ? '#fbbf24' : '#b45309') : red;
    if (isHorizontal) {
      // Right of the bar end.
      return (
        <text
          x={(x as number) + w + 6}
          y={cy}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={11}
          fontWeight={700}
          fill={outsideColor}
        >
          {sign}{(row.cap / TY).toFixed(2)} tỷ
        </text>
      );
    }
    // Above the column top.
    return (
      <text
        x={cx}
        y={(y as number) - 6}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={outsideColor}
      >
        {sign}{(row.cap / TY).toFixed(2)} tỷ
      </text>
    );
  };

  const renderTotalLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    const row = data[index];
    if (!row) return null;
    if (isHorizontal) {
      // Past the right edge of the bar; offset further when cap label is outside.
      const capIsOutside = row.cap > 0 && (width as number) < 60;
      const offset = capIsOutside ? 76 : 10;
      return (
        <text
          x={(x as number) + (width as number) + offset}
          y={(y as number) + (height as number) / 2}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={12}
          fontWeight={700}
          fill={red}
        >
          Tổng: {(row.total / TY).toFixed(2)} tỷ
        </text>
      );
    }
    // Vertical: above the column.
    const capIsOutside = row.cap > 0 && (height as number) < 28;
    const offset = capIsOutside ? 22 : 8;
    const cx = (x as number) + (width as number) / 2;
    return (
      <text
        x={cx}
        y={(y as number) - offset}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill={red}
      >
        Tổng: {(row.total / TY).toFixed(2)} tỷ
      </text>
    );
  };

  // Sizing: horizontal scales height with row count; vertical fixes height
  // and grows width via inner min-width to keep columns readable.
  const chartHeight = isHorizontal
    ? Math.max(220, data.length * 100 + 100)
    : 440;
  const minChartWidth = isHorizontal ? 0 : Math.max(640, data.length * 110);

  const baseRadius: [number, number, number, number] = isHorizontal
    ? [4, 0, 0, 4]
    : [0, 0, 4, 4];
  const capRadius: [number, number, number, number] = isHorizontal
    ? [0, 4, 4, 0]
    : [4, 4, 0, 0];

  const tooltipFormatter = (value: number, name: string, entry: any) => {
    const row: RowDatum | undefined = entry?.payload;
    if (!row) return null as any;
    if (name === 'base') {
      const lbl = row.isGrowth ? 'Dư nợ gốc' : 'Dư nợ kỳ sau';
      return [`${(value / TY).toFixed(2)} tỷ`, lbl];
    }
    if (name === 'cap' && value > 0) {
      const sign = row.isGrowth ? '+' : '−';
      const pct = row.prev > 0 ? (row.delta / row.prev) * 100 : null;
      const pctStr = pct !== null ? ` · ${fmtPercent(Math.abs(pct), 2)}` : '';
      return [
        `${sign}${(value / TY).toFixed(2)} tỷ${pctStr}`,
        row.isGrowth ? 'Phần tăng thêm' : 'Phần giảm',
      ];
    }
    return null as any;
  };

  const legendPayload = [
    { value: baseLegend, type: 'square' as const, color: blue, id: 'base' },
    { value: `${capLegend} — Tăng`, type: 'square' as const, color: yellow, id: 'cap-up' },
    { value: `${capLegend} — Giảm`, type: 'square' as const, color: red, id: 'cap-dn' },
  ];

  return (
    <div className={`space-y-2${isHorizontal ? '' : ' overflow-x-auto'}`}>
      <div style={isHorizontal ? undefined : { minWidth: minChartWidth }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            layout={isHorizontal ? 'vertical' : 'horizontal'}
            margin={
              isHorizontal
                ? { top: 8, right: 200, left: 16, bottom: 56 }
                : { top: 56, right: 24, left: 16, bottom: 56 }
            }
            barCategoryGap="18%"
          >
            <CartesianGrid
              stroke={cc.grid}
              strokeDasharray="3 3"
              horizontal={!isHorizontal}
              vertical={isHorizontal}
            />
            {isHorizontal ? (
              <>
                <XAxis
                  type="number"
                  fontSize={11}
                  tick={{ fill: cc.axis }}
                  tickLine={false}
                  axisLine={{ stroke: cc.axis }}
                  domain={[0, axisMax]}
                  tickFormatter={fmtTyAxis}
                  label={{
                    value: 'Giá trị (Tỷ VNĐ)',
                    position: 'insideBottom',
                    offset: -10,
                    fontSize: 11,
                    fill: cc.axis,
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  fontSize={12}
                  width={140}
                  stroke={cc.axis}
                  tick={{ fill: cc.text, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
              </>
            ) : (
              <>
                <XAxis
                  type="category"
                  dataKey="name"
                  fontSize={12}
                  tick={{ fill: cc.text, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: cc.axis }}
                  interval={0}
                  angle={data.length > 6 ? -20 : 0}
                  textAnchor={data.length > 6 ? 'end' : 'middle'}
                  height={data.length > 6 ? 60 : 30}
                />
                <YAxis
                  type="number"
                  fontSize={11}
                  tick={{ fill: cc.axis }}
                  tickLine={false}
                  axisLine={{ stroke: cc.axis }}
                  domain={[0, axisMax]}
                  tickFormatter={fmtTyAxis}
                  label={{
                    value: 'Giá trị (Tỷ VNĐ)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    fontSize: 11,
                    fill: cc.axis,
                    style: { textAnchor: 'middle' },
                  }}
                />
              </>
            )}
            <Tooltip
              cursor={{ fill: cc.cartesianBg }}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                background: cc.tooltipBg,
                borderColor: cc.tooltipBorder,
                color: cc.text,
              }}
              formatter={tooltipFormatter}
            />
            <Legend
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: 11, paddingTop: 12, bottom: -8 }}
              iconType="square"
              iconSize={12}
              payload={legendPayload}
            />

            <Bar
              dataKey="base"
              name="base"
              stackId="a"
              radius={baseRadius}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={blue} />
              ))}
              <LabelList content={renderBaseLabel} />
            </Bar>
            <Bar
              dataKey="cap"
              name="cap"
              stackId="a"
              radius={capRadius}
              isAnimationActive={false}
            >
              {data.map((row, i) => (
                <Cell key={i} fill={row.isGrowth ? yellow : red} />
              ))}
              <LabelList content={renderCapLabel} />
              <LabelList content={renderTotalLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
