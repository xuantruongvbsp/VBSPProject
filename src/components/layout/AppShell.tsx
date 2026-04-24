import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitCompare,
  Table,
  Landmark,
  RefreshCw,
  ArrowLeft,
  Moon,
  Sun,
  AlertTriangle,
  Snowflake,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '@/store/useDataStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useIsOwner } from '@/store/useAuthStore';
import { fmtDate } from '@/lib/format';
import { PublishButton } from '@/components/owner/PublishButton';

const navItems = [
  { to: '/snapshot', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/snapshot/no-xau', label: 'Báo cáo NPL', icon: AlertTriangle },
  { to: '/snapshot/no-khoanh', label: 'Báo cáo Dư nợ khoanh', icon: Snowflake },
  { to: '/snapshot/so-sanh', label: 'Báo cáo so sánh', icon: GitCompare },
  { to: '/snapshot/du-lieu', label: 'Tra cứu chi tiết', icon: Table },
];

export function AppShell() {
  const { rows, ngaySoLieu, reset } = useDataStore();
  const navigate = useNavigate();
  const isOwner = useIsOwner();
  const { theme, toggle: toggleTheme } = useThemeStore();
  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-900">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-2 inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-300"
          >
            <ArrowLeft className="h-3 w-3" /> Quay lại trang chính
          </button>
          <div className="flex items-center gap-3 px-2">
            <div className="rounded-lg bg-brand-700 p-2 text-white dark:bg-brand-500 dark:text-slate-950">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                NHCSXH
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Phân tích danh mục
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {isOwner ? 'Tệp dữ liệu hiện tại' : 'Bộ dữ liệu đang phân tích'}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {rows.length.toLocaleString('vi-VN')} khế ước
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Ngày số liệu: {fmtDate(ngaySoLieu)}
          </div>
          {isOwner && (
            <>
              <button
                onClick={reset}
                className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
              >
                <RefreshCw className="h-3 w-3" /> Tải tệp khác
              </button>
              <div className="mt-3">
                <PublishButton kind="snapshot" />
              </div>
            </>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <Outlet />
      </main>
    </div>
  );
}
