import { useState } from 'react';
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
  Users,
  MapPin,
  UserCheck,
  TrendingUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDataStore } from '@/store/useDataStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useIsOwner } from '@/store/useAuthStore';
import { usePublishedMetaStore } from '@/store/usePublishedMetaStore';
import { PublishedAtBadge } from '@/components/auth/PublishedAtBadge';
import { fmtDate } from '@/lib/format';
import { DataAutoSync } from '@/components/owner/DataAutoSync';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const navItems = [
  { to: '/snapshot', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/snapshot/no-xau', label: 'Báo cáo nợ quá hạn', icon: AlertTriangle },
  { to: '/snapshot/no-khoanh', label: 'Báo cáo Dư nợ khoanh', icon: Snowflake },
  // Tạm ẩn — sẽ bật lại sau khi hoàn thiện. Route /snapshot/doanh-so vẫn hoạt động.
  // { to: '/snapshot/doanh-so', label: 'Báo cáo doanh số', icon: TrendingUp },
  { to: '/snapshot/so-sanh', label: 'Báo cáo so sánh', icon: GitCompare },
  { to: '/snapshot/can-bo-bao-cao', label: 'Hiệu quả cán bộ', icon: UserCheck },
  { to: '/snapshot/dgd-bao-cao', label: 'Hiệu quả ĐGD', icon: TrendingUpDown },
  { to: '/snapshot/du-lieu', label: 'Tra cứu chi tiết', icon: Table },
  { to: '/snapshot/can-bo', label: 'Danh mục cán bộ', icon: Users },
  { to: '/snapshot/diem-giao-dich', label: 'Điểm giao dịch', icon: MapPin },
];

export function AppShell() {
  const { rows, ngaySoLieu, reset } = useDataStore();
  const navigate = useNavigate();
  const isOwner = useIsOwner();
  const snapshotAt = usePublishedMetaStore((s) => s.snapshotAt);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const [changeFileOpen, setChangeFileOpen] = useState(false);
  return (
    <div className="flex h-dvh w-full flex-col bg-white dark:bg-slate-900 md:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
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

        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
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
          {!isOwner && snapshotAt && (
            <div className="mt-2">
              <PublishedAtBadge publishedAt={snapshotAt} />
            </div>
          )}
          {isOwner && (
            <>
              <button
                onClick={() => setChangeFileOpen(true)}
                className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
              >
                <RefreshCw className="h-3 w-3" /> Tải tệp khác
              </button>
              <div className="mt-3">
                <DataAutoSync kind="snapshot" />
              </div>
            </>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title="Quay lại trang chính"
          aria-label="Quay lại trang chính"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-700 text-white dark:bg-brand-500 dark:text-slate-950">
          <Landmark className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">Phân tích một kỳ</div>
          <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
            {rows.length.toLocaleString('vi-VN')} khế ước · {fmtDate(ngaySoLieu)}
          </div>
        </div>
        {!isOwner && snapshotAt && (
          <div className="shrink-0">
            <PublishedAtBadge publishedAt={snapshotAt} compact />
          </div>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={() => setChangeFileOpen(true)}
            title="Chọn tệp dữ liệu khác"
            aria-label="Chọn tệp dữ liệu khác"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-300"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
          aria-label={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            !isOwner && 'ml-auto'
          )}
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </header>

      <nav className="scrollbar-thin flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900 md:hidden">
        {navItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
              )
            }
          >
            <it.icon className="h-3.5 w-3.5" />
            {it.label}
          </NavLink>
        ))}
      </nav>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <Outlet />
      </main>

      <ConfirmDialog
        open={changeFileOpen}
        onOpenChange={setChangeFileOpen}
        title="Chọn tệp dữ liệu khác?"
        description="Báo cáo đang mở và toàn bộ bộ lọc hiện tại sẽ được đóng. Tệp gần đây vẫn còn để bạn mở lại."
        confirmLabel="Chọn tệp khác"
        onConfirm={reset}
      />
    </div>
  );
}
