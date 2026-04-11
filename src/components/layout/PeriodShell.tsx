import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import {
  Activity,
  GitBranch,
  ShieldCheck,
  TrendingUpDown,
  Users2,
  Table,
  Megaphone,
  GitCompareArrows,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePeriodStore } from '@/store/usePeriodStore';
import { useIsOwner } from '@/store/useAuthStore';
import { fmtDate } from '@/lib/format';
import { PeriodImportDropzone } from '@/components/import/PeriodImportDropzone';
import { ViewerEmptyState } from '@/components/auth/ViewerEmptyState';
import { PublishButton } from '@/components/owner/PublishButton';

const navItems = [
  { to: '/period/dien-bien', label: 'Diễn biến', icon: Activity },
  { to: '/period/ma-tran', label: 'Ma trận chuyển nhóm', icon: GitBranch },
  { to: '/period/chat-luong', label: 'Chất lượng tài sản', icon: ShieldCheck },
  { to: '/period/top-bien-dong', label: 'Top tăng / giảm', icon: TrendingUpDown },
  { to: '/period/hoi-doan-the', label: 'Hội đoàn thể & Tổ', icon: Users2 },
  { to: '/period/khe-uoc', label: 'Bảng khế ước biến động', icon: Table },
  { to: '/period/khach-hang', label: 'Outreach & khách hàng', icon: Megaphone },
];

/**
 * Lớp bao trang ngoài cùng cho ứng dụng "So sánh giữa hai kỳ".
 * Khi chưa có cả hai snapshot, hiển thị `PeriodImportDropzone` thay vì
 * sidebar — buộc người dùng nhập đủ tệp trước khi vào sâu.
 */
export function PeriodShell() {
  const prev = usePeriodStore((s) => s.prev);
  const curr = usePeriodStore((s) => s.curr);
  const reset = usePeriodStore((s) => s.reset);
  const navigate = useNavigate();
  const isOwner = useIsOwner();

  // Khi cả hai slot đã có dữ liệu, đảm bảo URL nằm trong vùng /period.
  useEffect(() => {
    if (prev && curr && window.location.pathname === '/period') {
      navigate('/period/dien-bien', { replace: true });
    }
  }, [prev, curr, navigate]);

  if (!prev || !curr) {
    // Người xem: không bao giờ thấy ô nhập tệp
    if (!isOwner) {
      return <ViewerEmptyState app="period" />;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-period-50/30 px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-period-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Quay lại trang chính
          </button>
          <header className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-period-200 bg-period-50 px-4 py-1.5">
              <GitCompareArrows className="h-4 w-4 text-period-700" />
              <span className="text-xs font-semibold uppercase tracking-wide text-period-700">
                So sánh giữa hai kỳ
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Nhập hai tệp Báo cáo 31 để bắt đầu so sánh
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Đặt tệp ở kỳ trước (thời điểm cũ hơn) vào ô bên trái và tệp ở kỳ sau vào ô bên phải.
              Hệ thống sẽ tự kiểm tra <span className="whitespace-nowrap">"Ngày số liệu"</span>{' '}
              của hai tệp.
            </p>
          </header>
          <PeriodImportDropzone
            onLoaded={() => navigate('/period/dien-bien', { replace: true })}
          />
        </div>
      </div>
    );
  }

  // Sau khi đủ dữ liệu, nếu user đang ở /period (index) thì điều hướng vào trang đầu.
  if (window.location.pathname === '/period') {
    return <Navigate to="/period/dien-bien" replace />;
  }

  return (
    <div className="flex h-screen w-full">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-3 py-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-2 inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-period-700"
          >
            <ArrowLeft className="h-3 w-3" /> Quay lại trang chính
          </button>
          <div className="flex items-center gap-3 px-2">
            <div className="rounded-lg bg-period-700 p-2 text-white">
              <GitCompareArrows className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold uppercase tracking-wide text-period-700">
                So sánh hai kỳ
              </div>
              <div className="text-sm font-bold text-slate-800">Diễn biến danh mục</div>
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
                    ? 'bg-period-50 text-period-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Hai kỳ đang so sánh</div>
          <div className="mt-1 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Kỳ trước:</span>
              <span className="font-semibold text-slate-700">{fmtDate(prev.ngaySoLieu)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Kỳ sau:</span>
              <span className="font-semibold text-period-700">{fmtDate(curr.ngaySoLieu)}</span>
            </div>
            <div className="text-[10px] text-slate-400">
              {prev.rows.length.toLocaleString('vi-VN')} → {curr.rows.length.toLocaleString('vi-VN')}{' '}
              khế ước
            </div>
          </div>
          {isOwner && (
            <>
              <button
                onClick={() => {
                  reset();
                  navigate('/period');
                }}
                className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600"
              >
                <RefreshCw className="h-3 w-3" /> Đổi cặp tệp
              </button>
              <div className="mt-3">
                <PublishButton kind="period" />
              </div>
            </>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
