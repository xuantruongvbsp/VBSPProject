import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDataStore } from '@/store/useDataStore';
import { useIsOwner } from '@/store/useAuthStore';
import { ImportDropzone } from '@/components/import/ImportDropzone';
import { ViewerBootstrap } from '@/components/auth/ViewerBootstrap';
import { ViewerEmptyState } from '@/components/auth/ViewerEmptyState';
import { AppShell } from '@/components/layout/AppShell';
import { OverviewPage } from '@/pages/Overview';
import { ComparePage } from '@/pages/Compare';
import { ExplorerPage } from '@/pages/Explorer';
import { NplPage } from '@/pages/Npl';
import { KhoanhPage } from '@/pages/Khoanh';
import { DoanhSoPage } from '@/pages/DoanhSo';
import { StaffPage } from '@/pages/Staff';
import { StaffPerformancePage } from '@/pages/StaffPerformance';
import { TxnPointPage } from '@/pages/TxnPoint';
import { TxnPointPerformancePage } from '@/pages/TxnPointPerformance';
import { Lobby } from '@/pages/Lobby';
import { PeriodShell } from '@/components/layout/PeriodShell';
import { PeriodOverviewPage } from '@/pages/period/PeriodOverview';
import { PeriodMigrationPage } from '@/pages/period/PeriodMigration';
import { PeriodAssetQualityPage } from '@/pages/period/PeriodAssetQuality';
import { PeriodMoversPage } from '@/pages/period/PeriodMovers';
import { PeriodOrgGroupsPage } from '@/pages/period/PeriodOrgGroups';
import { PeriodExplorerPage } from '@/pages/period/PeriodExplorer';
import { PeriodOutreachPage } from '@/pages/period/PeriodOutreach';
import { PeriodStaffComparisonPage } from '@/pages/period/PeriodStaffComparison';
import { PeriodPointComparisonPage } from '@/pages/period/PeriodPointComparison';
import { CreditPlanShell } from '@/components/layout/CreditPlanShell';
import { PlanManager } from '@/pages/credit-plan/PlanManager';
import { ActualImport } from '@/pages/credit-plan/ActualImport';
import { PlanReports } from '@/pages/credit-plan/PlanReports';
import { PerformanceReport } from '@/pages/credit-plan/PerformanceReport';
import { DecisionManager } from '@/pages/credit-plan/DecisionManager';
import { XaCatalogManager } from '@/pages/credit-plan/XaCatalogManager';

/**
 * Lớp bao trang ngoài cùng cho ứng dụng "Phân tích một kỳ" (snapshot).
 * Khi chưa nhập tệp, hiển thị `ImportDropzone`. Sau khi có dữ liệu thì
 * vào `AppShell` và mở các trang con bên trong `/snapshot/*`.
 */
function SnapshotApp() {
  const rows = useDataStore((s) => s.rows);
  const isOwner = useIsOwner();

  if (!rows.length) {
    // Người xem: không bao giờ thấy ô nhập tệp; hiển thị trạng thái trống
    if (!isOwner) {
      return <ViewerEmptyState app="snapshot" />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">
              Hệ thống phân tích danh mục tín dụng
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Phân tích một kỳ — Báo cáo 31 NHCSXH
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
    </>
  );
}
