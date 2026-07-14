// Khi vai trò là 'viewer', tự động tải dữ liệu đã xuất bản và đổ vào hai
// store (snapshot + period). Người xem KHÔNG bao giờ thấy ô nhập tệp; nếu
// chưa có dữ liệu xuất bản thì các trang con tự hiển thị thông báo trống.
//
// Việc tải chỉ chạy một lần mỗi phiên trình duyệt — sau khi store đã có dữ
// liệu thì không gọi lại fetch nữa.

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useDataStore } from '@/store/useDataStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { useStaffStore } from '@/store/useStaffStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import {
  fetchPublishedSnapshot,
  fetchPublishedPeriod,
  fetchPublishedCatalog,
  fetchPublishedCreditPlan,
} from '@/lib/publish';

export function ViewerBootstrap() {
  const role = useAuthStore((s) => s.role);
  const snapshotRows = useDataStore((s) => s.rows);
  const setSnapshot = useDataStore((s) => s.setData);
  const periodLoaded = usePeriodStore(
    (s) => !!(s.lastYear || s.lastMonth || s.now)
  );
  const setPeriodSlots = usePeriodStore((s) => s.setSlots);
  const setPeriodComparePair = usePeriodStore((s) => s.setComparePair);
  const ranOnce = useRef(false);

  useEffect(() => {
    if (role !== 'viewer') return;
    if (ranOnce.current) return;
    ranOnce.current = true;

    if (snapshotRows.length === 0) {
      fetchPublishedSnapshot()
        .then((d) => {
          if (d) setSnapshot(d.rows, d.ngaySoLieu);
        })
        .catch((e) => console.warn('[viewer] không tải được snapshot', e));
    }
    if (!periodLoaded) {
      fetchPublishedPeriod()
        .then((d) => {
          if (!d) return;
          // Đổ cả 3 slot rồi đặt lại comparePair theo đúng cặp chủ sở hữu
          // đang xem trước khi xuất bản — thứ tự này quan trọng vì
          // `setSlots` sẽ "reconcile" pair về một cặp hợp lệ nếu pair cũ
          // trỏ vào slot trống.
          setPeriodSlots(d.slots);
          setPeriodComparePair(d.comparePair);
        })
        .catch((e) => console.warn('[viewer] không tải được period', e));
    }

    // Đồng bộ danh mục Cán bộ + Điểm giao dịch từ owner. Luôn replace để
    // tránh dữ liệu cũ tồn dư trong localStorage của viewer xung đột với
    // bản owner. Bộ chọn cán bộ/ĐGD trên FilterBar phụ thuộc trực tiếp
    // vào hai store này.
    fetchPublishedCatalog()
      .then((d) => {
        if (!d) return;
        useStaffStore.getState().importStaff(d.staff, 'replace');
        useTxnPointStore.getState().importPoints(d.txnPoints, 'replace');
      })
      .catch((e) => console.warn('[viewer] không tải được catalog', e));

    // Đổ Kế hoạch tín dụng (decisions, plans, actuals, NQ11) — luôn replace
    // để tránh trộn với phần dữ liệu cũ trong localStorage của viewer.
    fetchPublishedCreditPlan()
      .then((d) => {
        if (!d) return;
        useCreditPlanStore.setState({
          xaCatalog: d.xaCatalog ?? [],
          decisions: d.decisions,
          plans: d.plans,
          actuals: d.actuals,
          actualDate: d.actualDate,
          actualTotalRows: d.actualTotalRows,
          actualDiag: d.actualDiag,
          nq11Summaries: d.nq11Summaries,
          nq11MonVayIds: d.nq11MonVayIds,
          nq11Date: d.nq11Date,
          nq11TotalRows: d.nq11TotalRows,
          nq11MatchByXa: d.nq11MatchByXa,
          nq11NoxhSummaries: d.nq11NoxhSummaries,
          nq11NoxhMonVayIds: d.nq11NoxhMonVayIds,
          nq11NoxhDate: d.nq11NoxhDate,
          nq11NoxhTotalRows: d.nq11NoxhTotalRows,
          // loanDetailsByBucket không persist → owner side đã không publish
          // (viewer không cần drill-down chi tiết món vay).
          loanDetailsByBucket: {},
        });
      })
      .catch((e) => console.warn('[viewer] không tải được credit-plan', e));
  }, [
    role,
    snapshotRows.length,
    periodLoaded,
    setSnapshot,
    setPeriodSlots,
    setPeriodComparePair,
  ]);

  return null;
}
