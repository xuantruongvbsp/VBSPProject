import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  FileDown,
  BarChart3,
  FileText,
  Landmark,
  ArrowLeft,
  Moon,
  Sun,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { useThemeStore } from '@/store/useThemeStore';

const navItems = [
  { to: '/credit-plan/decisions', label: 'Quyết định', icon: FileText },
  { to: '/credit-plan/plans', label: 'Kế hoạch', icon: ClipboardList },
  { to: '/credit-plan/actual', label: 'Thực tế', icon: FileDown },
  { to: '/credit-plan/reports', label: 'Báo cáo', icon: BarChart3 },
  { to: '/credit-plan/performance', label: 'Báo cáo thực hiện', icon: Activity },
];

export function CreditPlanShell() {
  const navigate = useNavigate();
  const plans = useCreditPlanStore((s) => s.plans);
  const actuals = useCreditPlanStore((s) => s.actuals);
  const actualDate = useCreditPlanStore((s) => s.actualDate);
  const nq11Summaries = useCreditPlanStore((s) => s.nq11Summaries);
  const nq11TotalRows = useCreditPlanStore((s) => s.nq11TotalRows);
  const { theme, toggle: toggleTheme } = useThemeStore();

  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-900">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-700">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-2 inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-plan-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-plan-300"
          >
            <ArrowLeft className="h-3 w-3" /> Quay lại trang chính
          </button>
          <div className="flex items-center gap-3 px-2">
            <div className="rounded-lg bg-plan-700 p-2 text-white">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                NHCSXH
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Kế hoạch tín dụng
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-plan-50 text-plan-800 dark:bg-plan-900/30 dark:text-plan-300'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tình trạng dữ liệu
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Giao diện tối' : 'Giao diện sáng'}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {plans.length} mục kế hoạch
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {actuals.length > 0
              ? `${actuals.length} nhóm thực tế · ${actualDate ?? ''}`
              : 'Chưa nhập dữ liệu thực tế'}
          </div>
          {nq11Summaries.length > 0 && (
            <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              NQ11: {nq11TotalRows.toLocaleString('vi-VN')} món / {nq11Summaries.length} xã
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <Outlet />
      </main>
    </div>
  );
}
