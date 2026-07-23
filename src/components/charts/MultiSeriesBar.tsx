// Biểu đồ thanh ngang nhiều chuỗi (grouped bar) — dùng cho các biểu đồ bám
// theo báo cáo BĐD-HĐQT (VD: Nợ quá hạn & nợ khoanh theo Hội đoàn thể) và
// biểu đồ chất lượng tín dụng (một chuỗi, mỗi cột một màu).
//
// Thanh NGANG (category ở trục Y) để chứa nhãn tiếng Việt dài mà không chồng.
// Nhãn trục Y khai báo `text-anchor` ở cả prop lẫn inline style để html2canvas
// (khi xuất PDF) không cắt/đẩy lệch chữ.

import type { ReactElement } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  LabelList,
} from 'recharts';
import { fmtCompact, fmtCurrency } from '@/lib/format';
import { useChartColors } from '@/lib/useChartColors';

export interface BarSeries {
  /** Khóa số liệu trong mỗi phần tử `data`. */
  key: string;
  /** Tên hiển thị (legend + tooltip). */
  name: string;
  /** Màu cột; bỏ trống sẽ lấy theo palette. */
  color?: string;
}

/** Mỗi phần tử: `label` (nhãn category) + các khóa chuỗi số. `fill` tùy chọn
 *  chỉ áp dụng khi biểu đồ 1 chuỗi (mỗi cột một màu riêng). */
export type MultiSeriesRow = { label: string; fill?: string } & Record<
  string,
  string | number | undefined
>;

interface Props {
  data: MultiSeriesRow[];
  series: BarSeries[];
  /** Chiều cao mỗi hàng (px). Default 42. */
  rowHeight?: number;
  /** Định dạng giá trị trong tooltip. Default `fmtCurrency`. */
  valueFormatter?: (v: number) => string;
  /** Bề rộng cột nhãn trục Y. Default 160. */
  yAxisWidth?: number;
  /** Hiện số ở cuối mỗi thanh (hữu ích cho ảnh PDF tĩnh). Default `true`. */
  showValues?: boolean;
  /** Định dạng số nhãn tại thanh. Default `fmtCompact` (gọn). */
  labelFormatter?: (v: number) => string;
}

/** Nhãn số ở CUỐI thanh ngang — an toàn với html2canvas (neo đầu inline). */
function makeBarLabel(fmt: (v: number) => string, color: string) {
  return function BarValueLabel(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    value?: number | string;
  }): ReactElement {
    const x = Number(props.x);
    const y = Number(props.y);
    const width = Number(props.width);
    const height = Number(props.height);
    const v = Number(props.value);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isFinite(v) ||
      v === 0
    )
      return <g />;
    return (
      <text
        x={x + width + 3}
        y={y + height / 2}
        dy={3}
        textAnchor="start"
        style={{ textAnchor: 'start' }}
        fontSize={8.5}
        fontWeight={600}
        fill={color}
      >
        {fmt(v)}
      </text>
    );
  };
}

/** Tick trục Y an toàn với html2canvas (neo cuối + cắt bớt nhãn quá dài). */
function makeYTick(fill: string, max = 26) {
  return function YTick(props: {
    x?: number;
    y?: number;
    payload?: { value?: string | number };
  }) {
    const x = props.x ?? 0;
    const y = props.y ?? 0;
    const s = String(props.payload?.value ?? '');
    const shown = s.length > max ? s.slice(0, max - 1) + '…' : s;
    return (
      <text
        x={x - 6}
        y={y}
        dy={4}
        textAnchor="end"
        style={{ textAnchor: 'end' }}
        fontSize={11}
        fill={fill}
      >
        <title>{s}</title>
        {shown}
      </text>
    );
  };
}

export function MultiSeriesBar({
  data,
  series,
  rowHeight = 42,
  valueFormatter = fmtCurrency,
  yAxisWidth = 160,
  showValues = true,
  labelFormatter = fmtCompact,
}: Props) {
  const cc = useChartColors();
  const single = series.length === 1;
  const h = Math.max(180, data.length * rowHeight + 60);

  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 52, left: 8, bottom: 8 }}
        barCategoryGap="25%"
      >
        <CartesianGrid stroke={cc.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={fmtCompact} fontSize={11} stroke={cc.axis} />
        <YAxis
          type="category"
          dataKey="label"
          width={yAxisWidth}
          stroke={cc.axis}
          interval={0}
          tick={makeYTick(cc.text)}
        />
        <Tooltip
          cursor={{ fill: cc.cartesianBg }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            background: cc.tooltipBg,
            borderColor: cc.tooltipBorder,
            color: cc.text,
          }}
          formatter={(v: number, name: string) => [valueFormatter(v), name]}
        />
        {!single && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s, si) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color ?? cc.palette[si % cc.palette.length]}
            radius={[0, 4, 4, 0]}
          >
            {single &&
              data.map((d, i) => (
                <Cell key={i} fill={d.fill ?? cc.palette[i % cc.palette.length]} />
              ))}
            {showValues && (
              <LabelList
                dataKey={s.key}
                content={makeBarLabel(
                  labelFormatter,
                  single ? cc.text : s.color ?? cc.palette[si % cc.palette.length]
                )}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export default MultiSeriesBar;
