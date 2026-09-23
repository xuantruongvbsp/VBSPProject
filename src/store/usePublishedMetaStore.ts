// Lưu thời điểm dữ liệu được chủ sở hữu xuất bản (per ứng dụng) để hiển
// thị cho người xem biết bộ dữ liệu họ đang xem "tươi" tới đâu. Chỉ Viewer
// Bootstrap ghi; các shell đọc để hiển thị badge trạng thái.
//
// Lưu vào localStorage (khác các store dữ liệu dùng owner-only-storage) vì
// thông tin này cần cho cả viewer: khi viewer quay lại lần sau, ViewerBootstrap
// bỏ qua fetch (store đã có dữ liệu) → nếu không persist, badge sẽ biến mất.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PublishedMetaState {
  snapshotAt: string | null;
  periodAt: string | null;
  creditPlanAt: string | null;
  setSnapshotAt: (v: string | null) => void;
  setPeriodAt: (v: string | null) => void;
  setCreditPlanAt: (v: string | null) => void;
}

export const usePublishedMetaStore = create<PublishedMetaState>()(
  persist(
    (set) => ({
      snapshotAt: null,
      periodAt: null,
      creditPlanAt: null,
      setSnapshotAt: (snapshotAt) => set({ snapshotAt }),
      setPeriodAt: (periodAt) => set({ periodAt }),
      setCreditPlanAt: (creditPlanAt) => set({ creditPlanAt }),
    }),
    {
      name: 'vsppro-published-meta',
      partialize: (s) => ({
        snapshotAt: s.snapshotAt,
        periodAt: s.periodAt,
        creditPlanAt: s.creditPlanAt,
      }),
    }
  )
);
