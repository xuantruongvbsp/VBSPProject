import { Routes, Route, Navigate } from 'react-router-dom';
import { useDataStore } from '@/store/useDataStore';
import { useIsOwner } from '@/store/useAuthStore';
import { ImportDropzone } from '@/components/import/ImportDropzone';
import { ViewerBootstrap } from '@/components/auth/ViewerBootstrap';
import { ViewerEmptyState } from '@/components/auth/ViewerEmptyState';
import { AppShell } from '@/components/layout/AppShell';
import { OverviewPage } from '@/pages/Overview';
import { ComparePage } from '@/pages/Compare';
import { ExplorerPage } from '@/pages/Explorer';
import { Lobby } from '@/pages/Lobby';
import { PeriodShell } from '@/components/layout/PeriodShell';
import { PeriodOverviewPage } from '@/pages/period/PeriodOverview';
import { PeriodMigrationPage } from '@/pages/period/PeriodMigration';
import { PeriodAssetQualityPage } from '@/pages/period/PeriodAssetQuality';
import { PeriodMoversPage } from '@/pages/period/PeriodMovers';
import { PeriodOrgGroupsPage } from '@/pages/period/PeriodOrgGroups';
import { PeriodExplorerPage } from '@/pages/period/PeriodExplorer';
import { PeriodOutreachPage } from '@/pages/period/PeriodOutreach';
import { CreditPlanShell } from '@/components/layout/CreditPlanShell';
import { PlanManager } from '@/pages/credit-plan/PlanManager';
import { ActualImport } from '@/pages/credit-plan/ActualImport';
import { PlanReports } from '@/pages/credit-plan/PlanReports';

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
        <Route path="so-sanh" element={<ComparePage />} />
        <Route path="du-lieu" element={<ExplorerPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <>
      <ViewerBootstrap />
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
        <Route index element={<PlanManager />} />
        <Route path="actual" element={<ActualImport />} />
        <Route path="reports" element={<PlanReports />} />
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
      </Route>

      {/* Mọi đường dẫn lạ → quay về lobby */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
