import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useDataStore } from '@/store/useDataStore';
import { useIsOwner } from '@/store/useAuthStore';
import { ImportDropzone } from '@/components/import/ImportDropzone';
import { ViewerBootstrap } from '@/components/auth/ViewerBootstrap';
import { ViewerEmptyState } from '@/components/auth/ViewerEmptyState';
import { AppShell } from '@/components/layout/AppShell';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import { Lobby } from '@/pages/Lobby';
import { PeriodShell } from '@/components/layout/PeriodShell';
import { CreditPlanShell } from '@/components/layout/CreditPlanShell';

const OverviewPage = lazy(() => import('@/pages/Overview').then((m) => ({ default: m.OverviewPage })));
const ComparePage = lazy(() => import('@/pages/Compare').then((m) => ({ default: m.ComparePage })));
const ExplorerPage = lazy(() => import('@/pages/Explorer').then((m) => ({ default: m.ExplorerPage })));
const NplPage = lazy(() => import('@/pages/Npl').then((m) => ({ default: m.NplPage })));
const KhoanhPage = lazy(() => import('@/pages/Khoanh').then((m) => ({ default: m.KhoanhPage })));
const DoanhSoPage = lazy(() => import('@/pages/DoanhSo').then((m) => ({ default: m.DoanhSoPage })));
const StaffPage = lazy(() => import('@/pages/Staff').then((m) => ({ default: m.StaffPage })));
const StaffPerformancePage = lazy(() => import('@/pages/StaffPerformance').then((m) => ({ default: m.StaffPerformancePage })));
const TxnPointPage = lazy(() => import('@/pages/TxnPoint').then((m) => ({ default: m.TxnPointPage })));
const TxnPointPerformancePage = lazy(() => import('@/pages/TxnPointPerformance').then((m) => ({ default: m.TxnPointPerformancePage })));
const PeriodOverviewPage = lazy(() => import('@/pages/period/PeriodOverview').then((m) => ({ default: m.PeriodOverviewPage })));
const PeriodMigrationPage = lazy(() => import('@/pages/period/PeriodMigration').then((m) => ({ default: m.PeriodMigrationPage })));
const PeriodAssetQualityPage = lazy(() => import('@/pages/period/PeriodAssetQuality').then((m) => ({ default: m.PeriodAssetQualityPage })));
const PeriodMoversPage = lazy(() => import('@/pages/period/PeriodMovers').then((m) => ({ default: m.PeriodMoversPage })));
const PeriodOrgGroupsPage = lazy(() => import('@/pages/period/PeriodOrgGroups').then((m) => ({ default: m.PeriodOrgGroupsPage })));
const PeriodExplorerPage = lazy(() => import('@/pages/period/PeriodExplorer').then((m) => ({ default: m.PeriodExplorerPage })));
const PeriodOutreachPage = lazy(() => import('@/pages/period/PeriodOutreach').then((m) => ({ default: m.PeriodOutreachPage })));
const PeriodStaffComparisonPage = lazy(() => import('@/pages/period/PeriodStaffComparison').then((m) => ({ default: m.PeriodStaffComparisonPage })));
const PeriodPointComparisonPage = lazy(() => import('@/pages/period/PeriodPointComparison').then((m) => ({ default: m.PeriodPointComparisonPage })));
const PlanManager = lazy(() => import('@/pages/credit-plan/PlanManager').then((m) => ({ default: m.PlanManager })));
const ActualImport = lazy(() => import('@/pages/credit-plan/ActualImport').then((m) => ({ default: m.ActualImport })));
const PlanReports = lazy(() => import('@/pages/credit-plan/PlanReports').then((m) => ({ default: m.PlanReports })));
const PerformanceReport = lazy(() => import('@/pages/credit-plan/PerformanceReport').then((m) => ({ default: m.PerformanceReport })));
const DecisionManager = lazy(() => import('@/pages/credit-plan/DecisionManager').then((m) => ({ default: m.DecisionManager })));
const XaCatalogManager = lazy(() => import('@/pages/credit-plan/XaCatalogManager').then((m) => ({ default: m.XaCatalogManager })));

/**
 * Lớp bao trang ngoài cùng cho ứng dụng "Phân tích một kỳ" (snapshot).
 * Khi chưa nhập tệp, hiển thị `ImportDropzone`. Sau khi có dữ liệu thì
 * vào `AppShell` và mở các trang con bên trong `/snapshot/*`.
 */
function SnapshotApp() {
  const rows = useDataStore((s) => s.rows);
  const isOwner = useIsOwner();
  const navigate = useNavigate();

  if (!rows.length) {
    // Người xem: không bao giờ thấy ô nhập tệp; hiển thị trạng thái trống
    if (!isOwner) {
      return <ViewerEmptyState app="snapshot" />;
    }
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-3xl">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Quay lại trang chính
          </button>
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase text-brand-700 dark:text-brand-300">Phân tích một kỳ</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              Chọn Báo cáo 31 cần phân tích
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Bạn có thể mở lại tệp gần đây hoặc chọn một tệp Excel mới trên máy.
            </p>
          </div>
          <ImportDropzone />
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="no-xau" element={<NplPage />} />
        <Route path="no-khoanh" element={<KhoanhPage />} />
        <Route path="doanh-so" element={<DoanhSoPage />} />
        <Route path="so-sanh" element={<ComparePage />} />
        <Route path="du-lieu" element={<ExplorerPage />} />
        <Route path="can-bo" element={<StaffPage />} />
        <Route path="can-bo-bao-cao" element={<StaffPerformancePage />} />
        <Route path="diem-giao-dich" element={<TxnPointPage />} />
        <Route path="dgd-bao-cao" element={<TxnPointPerformancePage />} />
      </Route>
    </Routes>
  );
}

/**
 * Theo dõi điều hướng toàn ứng dụng. Khi người dùng rời khỏi trang Tra
 * cứu chi tiết (`/snapshot/du-lieu`) đi đến BẤT KỲ URL nào — kể cả khi
 * thoát ra khỏi `/snapshot/*` — mọi bộ lọc drill-down sẽ được xóa tự
 * động. Đặt ở App root (không phải trong AppShell) để sống sót qua các
 * transition khiến AppShell bị tháo gỡ (ví dụ: bấm "Quay lại trang
 * chính" từ Explorer về Lobby rồi quay lại Phân tích một kỳ).
 */
function DrillDownClearer() {
  const location = useLocation();
  const prev = useRef(location.pathname);
  const clearDrillDown = useDataStore((s) => s.clearDrillDown);
  useEffect(() => {
    const wasOnExplorer = prev.current.endsWith('/snapshot/du-lieu');
    const isOnExplorer = location.pathname.endsWith('/snapshot/du-lieu');
    if (wasOnExplorer && !isOnExplorer) {
      clearDrillDown();
    }
    prev.current = location.pathname;
  }, [location.pathname, clearDrillDown]);
  return null;
}

export default function App() {
  return (
    <>
      <ViewerBootstrap />
      <DrillDownClearer />
      <AppErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
        {/* Lobby — luôn hiển thị tại / */}
        <Route path="/" element={<Lobby />} />

      {/* Redirect các bookmark cũ về vùng /snapshot */}
      <Route path="/so-sanh" element={<Navigate to="/snapshot/so-sanh" replace />} />
      <Route path="/du-lieu" element={<Navigate to="/snapshot/du-lieu" replace />} />

      {/* Ứng dụng Phân tích một kỳ */}
      <Route path="/snapshot/*" element={<SnapshotApp />} />

      {/* Ứng dụng Kế hoạch tín dụng */}
      <Route path="/credit-plan" element={<CreditPlanShell />}>
        <Route index element={<Navigate to="decisions" replace />} />
        <Route path="decisions" element={<DecisionManager />} />
        <Route path="plans" element={<PlanManager />} />
        <Route path="actual" element={<ActualImport />} />
        <Route path="reports" element={<PlanReports />} />
        <Route path="performance" element={<PerformanceReport />} />
        <Route path="xa-catalog" element={<XaCatalogManager />} />
      </Route>

      {/* Ứng dụng So sánh giữa hai kỳ */}
      <Route path="/period" element={<PeriodShell />}>
        <Route index element={<PeriodOverviewPage />} />
        <Route path="dien-bien" element={<PeriodOverviewPage />} />
        <Route path="ma-tran" element={<PeriodMigrationPage />} />
        <Route path="chat-luong" element={<PeriodAssetQualityPage />} />
        <Route path="top-bien-dong" element={<PeriodMoversPage />} />
        <Route path="hoi-doan-the" element={<PeriodOrgGroupsPage />} />
        <Route path="khe-uoc" element={<PeriodExplorerPage />} />
        <Route path="khach-hang" element={<PeriodOutreachPage />} />
        <Route path="can-bo" element={<PeriodStaffComparisonPage />} />
        <Route path="diem-giao-dich" element={<PeriodPointComparisonPage />} />
      </Route>

      {/* Mọi đường dẫn lạ → quay về lobby */}
      <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </>
  );
}

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang mở báo cáo...
      </div>
    </div>
  );
}
