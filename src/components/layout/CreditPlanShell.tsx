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
import { useIsOwner } from '@/store/useAuthStore';
import { CreditPlanAutoSync } from '@/components/owner/CreditPlanAutoSync';
import { ViewerEmptyState } from '@/components/auth/ViewerEmptyState';

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
  const decisions = useCreditPlanStore((s) => s.decisions);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const isOwner = useIsOwner();

  // Người xem chưa thấy dữ liệu nào — owner chưa nhập kế hoạch nào lên server.
  // (Khác Snapshot/Period: ở đây "chưa có dữ liệu" = không có decisions/plans
  // và không có actuals. NQ11 đứng một mình không đủ để xem báo cáo.)
  const hasAnyData = decisions.length > 0 || plans.length > 0 || actuals.length > 0;
  if (!isOwner && !hasAnyData) {
    return <ViewerEmptyState app="credit-plan" />;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-white dark:bg-slate-900 md:flex-row">
      {/* Sidebar — desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 md:flex">
        <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-700">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-2 inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-plan-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-plan-300"
          >
            <ArrowLeft className="h-3 w-3" /> Quay lại trang chính
          </button>
          <div className="flex items-center gap-3 px-2">
            <div className="rounded-lg bg-plan-700 p-2 text-white shadow-sm">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                NHCSXH
              </div>
              <div className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
                Kế hoạch tín dụng
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-plan-50 text-plan-800 shadow-sm dark:bg-plan-900/40 dark:text-plan-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-plan-600 dark:bg-plan-400" />
                  )}
                  <it.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-plan-700 dark:text-plan-300')} />
                  <span className="truncate">{it.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
          <div className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {plans.length} mục kế hoạch
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {actuals.length > 0
              ? `${actuals.length} nhóm thực tế · ${actualDate ?? ''}`
              : 'Chưa nhập dữ liệu thực tế'}
          </div>
          {nq11Summaries.length > 0 && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800">
              NQ11 · {nq11TotalRows.toLocaleString('vi-VN')} món / {nq11Summaries.length} xã
            </div>
          )}
          <div className="mt-2">
            <CreditPlanAutoSync />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 md:hidden">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title="Quay lại trang chính"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-plan-700 p-1.5 text-white">
            <Landmark className="h-4 w-4" />
          </div>
          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Kế hoạch tín dụng</div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Giao diện tối' : 'Giao diện sáng'}
          className="ml-auto rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </header>

      {/* Mobile tabs */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 md:hidden">
        {navItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-plan-50 text-plan-800 dark:bg-plan-900/40 dark:text-plan-200'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
              )
            }
          >
            <it.icon className="h-3.5 w-3.5" />
            {it.label}
          </NavLink>
        ))}
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <Outlet />
      </main>
    </div>
  );
}
