import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark,
  ArrowRight,
  FileSpreadsheet,
  GitCompareArrows,
  ClipboardList,
  CheckCircle2,
} from 'lucide-react';
import { useDataStore } from '@/store/useDataStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { useAuthStore, useIsOwner } from '@/store/useAuthStore';
import { listRecentFiles } from '@/lib/recent-files';
import { listRecentPeriodPairs } from '@/lib/recent-period-pairs';
import { fmtDate, fmtNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { OwnerLoginModal } from '@/components/auth/OwnerLoginModal';

/**
 * Trang chủ — luôn hiện hai thẻ chế độ phân tích cạnh nhau.
 * Người dùng chọn rõ ràng "Phân tích một kỳ" hay "So sánh giữa hai kỳ"
 * trước khi vào sâu — không bao giờ tự deep-link.
 */
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

  const [snapshotRecentCount, setSnapshotRecentCount] = useState<number | null>(null);
  const [periodRecentCount, setPeriodRecentCount] = useState<number | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (!isOwner) {
      // Người xem không cần — và không nên — biết về danh sách tệp đã lưu
      setSnapshotRecentCount(0);
      setPeriodRecentCount(0);
      return;
    }
    listRecentFiles()
      .then((l) => setSnapshotRecentCount(l.length))
      .catch(() => setSnapshotRecentCount(0));
    listRecentPeriodPairs()
      .then((l) => setPeriodRecentCount(l.length))
      .catch(() => setPeriodRecentCount(0));
  }, [isOwner]);

  const snapshotLoaded = snapshotRows.length > 0;
  const periodLoaded = !!(periodPrev && periodCurr);
  const creditPlanHasData = creditPlans.length > 0 || creditActuals.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-1.5 shadow-sm">
            <Landmark className="h-4 w-4 text-brand-700" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Ngân hàng Chính sách Xã hội
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Hệ thống phân tích danh mục tín dụng
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Toàn bộ dữ liệu được xử lý cục bộ trên trình duyệt — không gửi lên máy chủ.
          </p>
        </header>

        <h2 className="mb-5 text-center text-xl font-semibold text-slate-800">
          Chọn chế độ phân tích
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Card 1: Snapshot */}
          <button
            type="button"
            onClick={() => navigate('/snapshot')}
            className={cn(
              'group relative flex flex-col gap-4 rounded-2xl border-2 bg-white p-7 text-left shadow-sm transition-all',
              'hover:-translate-y-0.5 hover:shadow-lg',
              snapshotLoaded
                ? 'border-brand-300 ring-2 ring-brand-100'
                : 'border-slate-200 hover:border-brand-300'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-brand-100 p-3 text-brand-700 transition-colors group-hover:bg-brand-200">
                <FileSpreadsheet className="h-7 w-7" />
              </div>
              {snapshotLoaded && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> Đã có dữ liệu
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">Phân tích một kỳ</h3>
              <p className="mt-2 text-sm text-slate-600">
                Nhập một tệp Báo cáo 31 (sao kê chi tiết theo ngày) để xem KPI tổng quan,
                so sánh chéo giữa các đối tượng và tra cứu chi tiết từng khế ước.
              </p>
            </div>

            <ul className="space-y-1 text-xs text-slate-500">
              <li>• Tổng quan: 8 KPI · biểu đồ ĐVUT · chương trình · cơ cấu khách hàng</li>
              <li>• Báo cáo so sánh giữa / trong từng đối tượng</li>
              <li>• Tra cứu chi tiết 174 trường mỗi khế ước</li>
            </ul>

            <div className="mt-auto flex items-center justify-between pt-3">
              <span className="text-[11px] text-slate-500">
                {snapshotLoaded ? (
                  <>
                    {fmtNumber(snapshotRows.length)} khế ước · {fmtDate(snapshotDate)}
                  </>
                ) : isOwner && snapshotRecentCount !== null && snapshotRecentCount > 0 ? (
                  <>{snapshotRecentCount} tệp đã lưu — sẵn sàng mở lại</>
                ) : isOwner ? (
                  'Chưa có dữ liệu — nhập tệp ở bước tiếp theo'
                ) : (
                  'Đang chờ dữ liệu được xuất bản'
                )}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 group-hover:gap-2 group-hover:transition-all">
                Vào ứng dụng <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </button>

          {/* Card 2: Period */}
          <button
            type="button"
            onClick={() => navigate('/period')}
            className={cn(
              'group relative flex flex-col gap-4 rounded-2xl border-2 bg-white p-7 text-left shadow-sm transition-all',
              'hover:-translate-y-0.5 hover:shadow-lg',
              periodLoaded
                ? 'border-period-300 ring-2 ring-period-100'
                : 'border-slate-200 hover:border-period-300'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-period-100 p-3 text-period-700 transition-colors group-hover:bg-period-200">
                <GitCompareArrows className="h-7 w-7" />
              </div>
              {periodLoaded && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> Đã có dữ liệu
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">So sánh giữa hai kỳ</h3>
              <p className="mt-2 text-sm text-slate-600">
                Nhập hai tệp Báo cáo 31 ở hai thời điểm khác nhau (ví dụ cuối quý trước
                và cuối quý này) để xem diễn biến danh mục: chuyển nhóm, vào/ra,
                roll rate, cure rate, thay đổi chất lượng tài sản.
              </p>
            </div>

            <ul className="space-y-1 text-xs text-slate-500">
              <li>• Diễn biến KPI · Roll rate · Cure rate · Vào/ra khách hàng</li>
              <li>• Ma trận chuyển nhóm · Top tăng/giảm theo PGD/Xã/ĐVUT</li>
              <li>• Bảng khế ước biến động · Chất lượng tài sản · PAR30/90/180</li>
            </ul>

            <div className="mt-auto flex items-center justify-between pt-3">
              <span className="text-[11px] text-slate-500">
                {periodLoaded ? (
                  <>
                    {fmtDate(periodPrev?.ngaySoLieu ?? null)} → {fmtDate(periodCurr?.ngaySoLieu ?? null)}
                  </>
                ) : isOwner && periodRecentCount !== null && periodRecentCount > 0 ? (
                  <>{periodRecentCount} cặp tệp đã lưu — sẵn sàng mở lại</>
                ) : isOwner ? (
                  'Chưa có dữ liệu — nhập hai tệp ở bước tiếp theo'
                ) : (
                  'Đang chờ dữ liệu được xuất bản'
                )}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-period-700 group-hover:gap-2 group-hover:transition-all">
                Vào ứng dụng <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </button>

          {/* Card 3: Credit Plan */}
          <button
            type="button"
            onClick={() => navigate('/credit-plan')}
            className={cn(
              'group relative flex flex-col gap-4 rounded-2xl border-2 bg-white p-7 text-left shadow-sm transition-all',
              'hover:-translate-y-0.5 hover:shadow-lg',
              creditPlanHasData
                ? 'border-plan-300 ring-2 ring-plan-100'
                : 'border-slate-200 hover:border-plan-300'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-plan-100 p-3 text-plan-700 transition-colors group-hover:bg-plan-200">
                <ClipboardList className="h-7 w-7" />
              </div>
              {creditPlanHasData && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> Đã có dữ liệu
                </span>
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">Kế hoạch tín dụng</h3>
              <p className="mt-2 text-sm text-slate-600">
                Quản lý kế hoạch dư nợ theo quyết định, nhập dữ liệu thực tế từ Báo cáo 31,
                so sánh kế hoạch vs thực tế theo xã, chương trình, nguồn vốn.
              </p>
            </div>

            <ul className="space-y-1 text-xs text-slate-500">
              <li>• Nhập kế hoạch: Số QĐ · Ngày QĐ · Xã · Chương trình · Số tiền</li>
              <li>• Nhập thực tế từ file Excel Báo cáo 31</li>
              <li>• Báo cáo so sánh KH vs TT · Tỷ lệ hoàn thành · Biểu đồ</li>
            </ul>

            <div className="mt-auto flex items-center justify-between pt-3">
              <span className="text-[11px] text-slate-500">
                {creditPlanHasData
                  ? `${creditPlans.length} mục KH · ${creditActuals.length} nhóm TT`
                  : 'Chưa có dữ liệu — nhập kế hoạch ở bước tiếp theo'}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-plan-700 group-hover:gap-2 group-hover:transition-all">
                Vào ứng dụng <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </button>
        </div>

        <p className="mt-10 text-center text-[11px] text-slate-400">
          Ba ứng dụng độc lập — bộ lọc và dữ liệu được giữ riêng biệt.
        </p>

        <div className="mt-2 text-center">
          {isOwner ? (
            <button
              type="button"
              onClick={logout}
              className="text-[11px] text-slate-400 hover:text-slate-600"
            >
              Đang ở chế độ quản trị · Thoát
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="text-[11px] text-slate-400 hover:text-slate-600"
            >
              Chế độ quản trị
            </button>
          )}
        </div>
      </div>

      <OwnerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
