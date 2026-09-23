import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  GitCompareArrows,
  Landmark,
  LogIn,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { useDataStore } from '@/store/useDataStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { useAuthStore, useIsOwner } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { listRecentFiles } from '@/lib/recent-files';
import { listRecentPeriodPairs } from '@/lib/recent-period-pairs';
import { fmtDate, fmtNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { OwnerLoginModal } from '@/components/auth/OwnerLoginModal';
import { AppBackupMenu } from '@/components/backup/AppBackupMenu';

export function Lobby() {
  const navigate = useNavigate();
  const snapshotRows = useDataStore((s) => s.rows);
  const snapshotDate = useDataStore((s) => s.ngaySoLieu);
  const periodPrev = usePeriodStore((s) => s.prev);
  const periodCurr = usePeriodStore((s) => s.curr);
  const creditPlans = useCreditPlanStore((s) => s.plans);
  const creditActuals = useCreditPlanStore((s) => s.actuals);
  const isOwner = useIsOwner();
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggle: toggleTheme } = useThemeStore();

  const [snapshotRecentCount, setSnapshotRecentCount] = useState<number | null>(null);
  const [periodRecentCount, setPeriodRecentCount] = useState<number | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (!isOwner) {
      setSnapshotRecentCount(0);
      setPeriodRecentCount(0);
      return;
    }
    listRecentFiles()
      .then((items) => setSnapshotRecentCount(items.length))
      .catch(() => setSnapshotRecentCount(0));
    listRecentPeriodPairs()
      .then((items) => setPeriodRecentCount(items.length))
      .catch(() => setPeriodRecentCount(0));
  }, [isOwner]);

  const snapshotLoaded = snapshotRows.length > 0;
  const periodLoaded = !!(periodPrev && periodCurr);
  const creditPlanHasData = creditPlans.length > 0 || creditActuals.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white dark:bg-brand-500 dark:text-slate-950">
            <Landmark className="h-5 w-5" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold">VSPPRO</div>
            <div className="hidden truncate text-[11px] text-slate-500 dark:text-slate-400 sm:block">
              Phân tích danh mục tín dụng
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span
              className={cn(
                'hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex',
                isOwner
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              )}
            >
              {isOwner ? 'Quản trị viên' : 'Người xem'}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
              aria-label={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            {isOwner && <AppBackupMenu />}
            <button
              type="button"
              onClick={isOwner ? logout : () => setLoginOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isOwner ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isOwner ? 'Thoát quản trị' : 'Mở chế độ quản trị'}</span>
              <span className="sm:hidden">{isOwner ? 'Thoát' : 'Quản trị'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="mb-7 max-w-3xl">
          <p className="text-xs font-semibold uppercase text-brand-700 dark:text-brand-300">
            Ngân hàng Chính sách Xã hội
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Chọn công việc cần thực hiện</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Dữ liệu được xử lý ngay trên máy này. Mỗi khu vực lưu bộ dữ liệu và bộ lọc riêng.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate('/snapshot')}
            className={cn(
              'group flex min-h-[330px] flex-col rounded-lg border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 sm:p-6',
              snapshotLoaded
                ? 'border-brand-300 ring-1 ring-brand-100 dark:border-brand-600 dark:ring-brand-500/20'
                : 'border-slate-200 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-600'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                <FileSpreadsheet className="h-6 w-6" />
              </span>
              {snapshotLoaded && <ReadyBadge />}
            </div>
            <h2 className="mt-5 text-lg font-bold">Phân tích một kỳ</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Xem tổng quan, nợ quá hạn, dư nợ khoanh, hiệu quả cán bộ và tra cứu từng khế ước từ một Báo cáo 31.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li>8 chỉ số tổng quan và biểu đồ cơ cấu</li>
              <li>Báo cáo so sánh theo nhiều đối tượng</li>
              <li>Tra cứu chi tiết 174 trường dữ liệu</li>
            </ul>
            <div className="mt-auto border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="min-h-5 text-xs text-slate-500 dark:text-slate-400">
                {snapshotLoaded
                  ? `${fmtNumber(snapshotRows.length)} khế ước · ${fmtDate(snapshotDate)}`
                  : isOwner && snapshotRecentCount
                    ? `${snapshotRecentCount} tệp gần đây có thể mở lại`
                    : isOwner
                      ? 'Sẵn sàng nhập tệp Báo cáo 31'
                      : 'Chưa có dữ liệu được xuất bản'}
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-300">
                {snapshotLoaded ? 'Mở báo cáo' : isOwner ? 'Nhập dữ liệu' : 'Xem trạng thái'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/period')}
            className={cn(
              'group flex min-h-[330px] flex-col rounded-lg border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 sm:p-6',
              periodLoaded
                ? 'border-period-300 ring-1 ring-period-100 dark:border-period-600 dark:ring-period-500/20'
                : 'border-slate-200 hover:border-period-300 dark:border-slate-800 dark:hover:border-period-600'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-period-100 text-period-700 dark:bg-period-500/15 dark:text-period-300">
                <GitCompareArrows className="h-6 w-6" />
              </span>
              {periodLoaded && <ReadyBadge />}
            </div>
            <h2 className="mt-5 text-lg font-bold">So sánh giữa hai kỳ</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Theo dõi thay đổi danh mục giữa hai kỳ, chuyển nhóm nợ, khách hàng vào/ra và các khoản biến động lớn.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li>Diễn biến KPI, roll rate và cure rate</li>
              <li>Ma trận chuyển nhóm và chất lượng tài sản</li>
              <li>So sánh cán bộ, điểm giao dịch và khách hàng</li>
            </ul>
            <div className="mt-auto border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="min-h-5 text-xs text-slate-500 dark:text-slate-400">
                {periodLoaded
                  ? `${fmtDate(periodPrev?.ngaySoLieu ?? null)} → ${fmtDate(periodCurr?.ngaySoLieu ?? null)}`
                  : isOwner && periodRecentCount
                    ? `${periodRecentCount} bộ tệp gần đây có thể mở lại`
                    : isOwner
                      ? 'Sẵn sàng nhập từ 2 đến 3 kỳ dữ liệu'
                      : 'Chưa có dữ liệu được xuất bản'}
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-period-700 dark:text-period-300">
                {periodLoaded ? 'Mở báo cáo' : isOwner ? 'Nhập dữ liệu' : 'Xem trạng thái'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/credit-plan')}
            className={cn(
              'group flex min-h-[330px] flex-col rounded-lg border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 sm:p-6',
              creditPlanHasData
                ? 'border-plan-300 ring-1 ring-plan-100 dark:border-plan-600 dark:ring-plan-500/20'
                : 'border-slate-200 hover:border-plan-300 dark:border-slate-800 dark:hover:border-plan-600'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-plan-100 text-plan-700 dark:bg-plan-500/15 dark:text-plan-300">
                <ClipboardList className="h-6 w-6" />
              </span>
              {creditPlanHasData && <ReadyBadge />}
            </div>
            <h2 className="mt-5 text-lg font-bold">Kế hoạch tín dụng</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Quản lý quyết định, giao kế hoạch và đối chiếu kế hoạch với dư nợ thực tế theo xã, chương trình và nguồn vốn.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li>Quản lý quyết định và chỉ tiêu kế hoạch</li>
              <li>Nhập thực tế trực tiếp từ Báo cáo 31</li>
              <li>Theo dõi tỷ lệ hoàn thành và hiệu suất</li>
            </ul>
            <div className="mt-auto border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="min-h-5 text-xs text-slate-500 dark:text-slate-400">
                {creditPlanHasData
                  ? `${creditPlans.length} mục kế hoạch · ${creditActuals.length} nhóm thực tế`
                  : isOwner
                    ? 'Bắt đầu từ quyết định hoặc danh mục xã'
                    : 'Chưa có dữ liệu được xuất bản'}
              </div>
              <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-plan-700 dark:text-plan-300">
                {creditPlanHasData ? 'Mở kế hoạch' : isOwner ? 'Thiết lập dữ liệu' : 'Xem trạng thái'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </button>
        </div>

        <p className="mt-8 text-center text-[11px] leading-5 text-slate-400 dark:text-slate-500">
          PHÒNG KẾ HOẠCH - TÍN DỤNG
          <br />
          Chi nhánh Ngân hàng Chính sách xã hội thành phố Đồng Nai
        </p>
      </main>

      <OwnerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

function ReadyBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
      <CheckCircle2 className="h-3 w-3" /> Sẵn sàng
    </span>
  );
}
