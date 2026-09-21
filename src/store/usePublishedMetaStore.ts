// Lưu thời điểm dữ liệu được chủ sở hữu xuất bản (per ứng dụng) để hiển
// thị cho người xem biết bộ dữ liệu họ đang xem "tươi" tới đâu. Chỉ Viewer
// Bootstrap ghi; các shell đọc để hiển thị badge trạng thái.

import { create } from 'zustand';

interface PublishedMetaState {
  snapshotAt: string | null;
  periodAt: string | null;
  creditPlanAt: string | null;
  setSnapshotAt: (v: string | null) => void;
  setPeriodAt: (v: string | null) => void;
  setCreditPlanAt: (v: string | null) => void;
}

export const usePublishedMetaStore = create<PublishedMetaState>((set) => ({
  snapshotAt: null,
  periodAt: null,
  creditPlanAt: null,
  setSnapshotAt: (snapshotAt) => set({ snapshotAt }),
  setPeriodAt: (periodAt) => set({ periodAt }),
  setCreditPlanAt: (creditPlanAt) => set({ creditPlanAt }),
}));
