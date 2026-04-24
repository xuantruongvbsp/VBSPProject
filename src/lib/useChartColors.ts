import { useThemeStore } from '@/store/useThemeStore';

// Categorical palette — thứ tự slot cố định để mọi biểu đồ đồng bộ màu:
// 0 blue · 1 sky · 2 emerald · 3 amber · 4 violet · 5 rose · 6 teal · 7 indigo.
// Biến thể "dark" dịch lên mức luminance cao hơn (-400) để tránh hiện tượng
// "hố đen" (blue-700 trên slate-950 chỉ có 2.7:1) và bớt chói (orange/magenta
// bão hoà cực đại trên nền tối bị glow theo cơ chế simultaneous contrast).
const PALETTE_LIGHT = [
  '#2563eb', // blue-600
  '#0891b2', // sky-600
  '#16a34a', // emerald-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#e11d48', // rose-600
  '#0d9488', // teal-600
  '#4f46e5', // indigo-600
] as const;

const PALETTE_DARK = [
  '#60a5fa', // blue-400
  '#38bdf8', // sky-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#a78bfa', // violet-400
  '#fb7185', // rose-400
  '#2dd4bf', // teal-400
  '#818cf8', // indigo-400
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

    /** Màu theo ngữ nghĩa — dùng khi ý nghĩa cố định (xanh = tốt, đỏ = xấu). */
    semantic: {
      // Dư nợ trong hạn (tín hiệu tích cực)
      duNoTrongHan: dark ? '#4ade80' : '#16a34a',
      // Dư nợ quá hạn (cảnh báo)
      duNoQuaHan: dark ? '#f87171' : '#dc2626',
      // Highlight một phần tử trong ranking (cùng hệ cảnh báo)
      highlight: dark ? '#f87171' : '#dc2626',
      // Chuỗi chính của time-series (line/histogram area)
      areaBase: dark ? '#60a5fa' : '#1d4ed8',
      /**
       * Chuỗi RGB dùng cho gradient / heatmap opacity. Caller tự ghép alpha:
       *   `rgba(${cc.semantic.heatmapRgb}, ${0.1 + intensity * 0.7})`.
       * Base dark = sky-400 (56,189,248): ngay cả ở alpha 0.1 vẫn đạt ~3.2:1
       * so với slate-800, trong khi blue-700 cũ biến mất hoàn toàn.
       */
      heatmapRgb: dark ? '56,189,248' : '29,78,216',
      /** Dạng hex của heatmapRgb — tiện khi chart cần màu đầy đủ 100%. */
      heatmapBase: dark ? '#38bdf8' : '#1d4ed8',
    },
  };
}
