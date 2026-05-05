import { useThemeStore } from '@/store/useThemeStore';

// Categorical palette — 10 màu đồng nhất với "Dư nợ theo Chương trình tín dụng"
// (mapping cố định từng CT). Khi chart không match name-rule, vẫn dùng các màu
// này theo thứ tự i % 10 → toàn bộ dashboard share 1 hệ màu nhất quán.
// Slot order: blue · teal · green · amber · purple · fuchsia · violet · slate · indigo · rose.
const PALETTE_LIGHT = [
  '#1A56DB', // Royal Blue   — Việc làm
  '#0095A8', // Teal         — Nước sạch
  '#22C55E', // Emerald      — Học sinh/SV
  '#D97706', // Amber        — Nhà ở
  '#9333EA', // Purple       — Hộ cận nghèo
  '#C026D3', // Fuchsia      — Hộ mới thoát nghèo
  '#A855F7', // Violet       — Ưu đãi hộ nghèo
  '#94A3B8', // Slate Gray   — Khác
  '#6366F1', // Indigo       — Người chấp hành án
  '#BE185D', // Rose         — Đi LĐ nước ngoài
] as const;

// Dark mode: dịch lên shade 400 để contrast tốt trên slate-950 (Atlassian symmetry).
const PALETTE_DARK = [
  '#60a5fa', // blue-400
  '#2dd4bf', // teal-400
  '#4ade80', // green-400
  '#fbbf24', // amber-400
  '#c084fc', // purple-400
  '#e879f9', // fuchsia-400
  '#a78bfa', // violet-400
  '#cbd5e1', // slate-300 (sáng hơn để đọc rõ trên nền tối)
  '#a5b4fc', // indigo-400
  '#fb7185', // rose-400
] as const;

/** Recharts-compatible colors that react to the current theme. */
export function useChartColors() {
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  return {
    /** `true` khi theme = 'dark' — tiện cho chart cần rẽ nhánh nhiều biến hình. */
    isDark: dark,
    axis: dark ? '#94a3b8' : '#64748b',       // slate-400 / slate-500
    grid: dark ? '#334155' : '#e2e8f0',        // slate-700 / slate-200
    tick: dark ? '#94a3b8' : '#64748b',
    tooltipBg: dark ? '#1e293b' : '#ffffff',   // slate-800 / white
    tooltipBorder: dark ? '#334155' : '#e2e8f0',
    text: dark ? '#e2e8f0' : '#475569',        // slate-200 / slate-600
    cartesianBg: dark ? 'rgba(96,165,250,0.08)' : 'rgba(59,130,246,0.06)',

    /** Bảng màu phân loại 8 slot — chart cycle theo chỉ số i % 8. */
    palette: (dark ? PALETTE_DARK : PALETTE_LIGHT) as readonly string[],

    /** Màu theo ngữ nghĩa — symmetry 700/400 theo Atlassian (xanh = tốt, đỏ = xấu, vàng = cảnh báo). */
    semantic: {
      // Dư nợ trong hạn (tín hiệu tích cực) — green 700↔400
      duNoTrongHan: dark ? '#4ade80' : '#15803d',
      // Dư nợ quá hạn (cảnh báo) — red 700↔400
      duNoQuaHan: dark ? '#f87171' : '#b91c1c',
      // Dư nợ khoanh — yellow/amber (chưa thu được nhưng KHÔNG phải bad-debt) — amber 700↔400
      duNoKhoanh: dark ? '#fbbf24' : '#b45309',
      // Highlight một phần tử trong ranking (cùng hệ cảnh báo)
      highlight: dark ? '#f87171' : '#b91c1c',
      // Chuỗi chính của time-series (line/histogram area) — blue 700↔400
      areaBase: dark ? '#60a5fa' : '#1d4ed8',
      /**
       * Chuỗi RGB dùng cho gradient / heatmap opacity. Caller tự ghép alpha:
       *   `rgba(${cc.semantic.heatmapRgb}, ${0.1 + intensity * 0.7})`.
       * Dark = sky-400 (56,189,248) để ngay alpha thấp vẫn ≥ 3:1 trên slate-800;
       * Light = blue-700 (29,78,216) cho đủ depth trên nền trắng.
       */
      heatmapRgb: dark ? '56,189,248' : '29,78,216',
      /** Dạng hex của heatmapRgb — tiện khi chart cần màu đầy đủ 100%. */
      heatmapBase: dark ? '#38bdf8' : '#1d4ed8',
    },
  };
}
