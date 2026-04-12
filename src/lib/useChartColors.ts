import { useThemeStore } from '@/store/useThemeStore';

/** Recharts-compatible colors that react to the current theme. */
export function useChartColors() {
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  return {
    axis: dark ? '#94a3b8' : '#64748b',       // slate-400 / slate-500
    grid: dark ? '#334155' : '#e2e8f0',        // slate-700 / slate-200
    tick: dark ? '#94a3b8' : '#64748b',
    tooltipBg: dark ? '#1e293b' : '#ffffff',   // slate-800 / white
    tooltipBorder: dark ? '#334155' : '#e2e8f0',
    text: dark ? '#e2e8f0' : '#475569',        // slate-200 / slate-600
    cartesianBg: dark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)',
  };
}
