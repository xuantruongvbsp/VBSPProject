import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { fmtCompact, fmtCurrency } from '@/lib/format';
import type { GroupAgg } from '@/lib/metrics';

interface Props {
  data: GroupAgg[];
  onClick?: (key: string) => void;
  highlightKey?: string;
  limit?: number;
  layout?: 'horizontal' | 'vertical';
  metric?: keyof GroupAgg;
  /**
   * Độ rộng (px) của trục danh mục bên trái khi `layout='vertical'`. Mặc định
   * 220px — đủ chỗ cho hai dòng văn bản 24 ký tự ở 10px.
   */
  yAxisWidth?: number;
  /**
   * Số ký tự tối đa trên mỗi dòng nhãn. Nhãn dài hơn giá trị này × 2 sẽ
   * được cắt ngắn ở dòng thứ hai bằng dấu "…". Mặc định 24 ký tự.
   */
  charsPerLine?: number;
}

const palette = ['#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#a21caf', '#4338ca'];

/**
 * Tách một nhãn dài thành tối đa hai dòng tại biên từ gần nhất với điểm
 * giữa, để hiển thị trọn vẹn tên chương trình tín dụng dài bằng tiếng Việt
 * mà không cần cắt cụt. Trả về tối đa hai dòng — dòng thứ hai mới bị
 * truncate bằng "…" nếu vẫn còn quá dài.
 */
function splitTwoLines(s: string, perLine: number): string[] {
  if (!s) return [''];
  if (s.length <= perLine) return [s];

  // Tìm khoảng trắng gần điểm giữa nhất, ưu tiên các vị trí mà cả hai
  // nửa đều ≤ perLine.
  const ideal = Math.floor(s.length / 2);
  let bestFit = -1;
  let bestAny = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== ' ') continue;
    const left = i;
    const right = s.length - i - 1;
    if (left <= perLine && right <= perLine) {
      if (bestFit === -1 || Math.abs(i - ideal) < Math.abs(bestFit - ideal)) {
        bestFit = i;
      }
    }
    if (bestAny === -1 || Math.abs(i - ideal) < Math.abs(bestAny - ideal)) {
      bestAny = i;
    }
  }
  const splitAt = bestFit !== -1 ? bestFit : bestAny;
  if (splitAt === -1) {
    // Không có khoảng trắng — buộc phải cắt cứng
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

/**
 * Tick tùy biến cho YAxis dạng category — render nhãn trên một hoặc hai
 * dòng tự ngắt theo từ. Không dùng `<Text>` mặc định của recharts vì nó
 * có chiến lược ngắt dòng riêng, gây chồng chéo giữa các dòng dữ liệu.
 */
function makeMultiLineTick(perLine: number) {
  return function MultiLineTick(props: any) {
    const { x, y, payload } = props;
    const value = String(payload?.value ?? '');
    const lines = splitTwoLines(value, perLine);
    const lineHeight = 11;
    // Căn giữa khối văn bản theo chiều dọc quanh tọa độ y của tick
    const startDy = lines.length === 1 ? 4 : -1;
    return (
      <g transform={`translate(${x}, ${y})`}>
        <text textAnchor="end" fontSize={10} fill="#475569">
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
}: Props) {
  const trimmed = data.slice(0, limit);
  const isVertical = layout === 'vertical';

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, trimmed.length * 38 + 40)}>
      <BarChart
        data={trimmed}
        layout={isVertical ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={!isVertical} vertical={isVertical} />
        {isVertical ? (
          <>
            <XAxis type="number" tickFormatter={fmtCompact} fontSize={11} stroke="#64748b" />
            <YAxis
              type="category"
              dataKey="label"
              width={yAxisWidth}
              fontSize={11}
              stroke="#64748b"
              interval={0}
              tick={makeMultiLineTick(charsPerLine)}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="label" fontSize={11} stroke="#64748b" />
            <YAxis tickFormatter={fmtCompact} fontSize={11} stroke="#64748b" />
          </>
        )}
        <Tooltip
          cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [fmtCurrency(v), 'Tổng dư nợ']}
        />
        <Bar
          dataKey={metric as string}
          radius={[4, 4, 4, 4]}
          onClick={(d: any) => onClick?.(d?.key)}
          cursor={onClick ? 'pointer' : undefined}
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
