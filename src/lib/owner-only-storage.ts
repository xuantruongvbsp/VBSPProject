// Lớp lưu trữ "chỉ-ghi-khi-owner" dùng chung cho các store dữ liệu do chủ sở
// hữu quản lý (Kế hoạch tín dụng, danh mục Cán bộ, Điểm giao dịch).
//
// Nguyên tắc: CHỈ admin (vai trò 'owner') mới được ghi xuống localStorage.
// Người xem — kể cả admin chưa mở khóa — không bao giờ ghi đè dữ liệu gốc của
// chủ sở hữu. Người xem nhận dữ liệu đã xuất bản (ViewerBootstrap) và giữ trong
// bộ nhớ phiên; vì `setItem` no-op nên không có gì rò xuống localStorage.
// `getItem` đọc bình thường để admin luôn nạp lại đúng dữ liệu của mình.

import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { ROLE_STORAGE_KEY } from '@/store/useAuthStore';

/** Vai trò hiện tại đọc trực tiếp từ localStorage (live — `setRole` ghi khóa
 *  này trước khi đổi state). Đọc trực tiếp thay vì import store auth dạng giá
 *  trị để tránh phụ thuộc vòng ở thời điểm khởi tạo module. */
function isOwnerNow(): boolean {
  try {
    return localStorage.getItem(ROLE_STORAGE_KEY) === 'owner';
  } catch {
    return false;
  }
}

const ownerOnlyStateStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (!isOwnerNow()) return; // người xem không được ghi
    try {
      localStorage.setItem(name, value);
    } catch {
      /* hết quota — bỏ qua, không làm vỡ UI */
    }
  },
  removeItem: (name) => {
    if (!isOwnerNow()) return;
    try {
      localStorage.removeItem(name);
    } catch {
      /* noop */
    }
  },
};

/** Storage cho zustand `persist` — chỉ admin được ghi. */
export const ownerOnlyJSONStorage = createJSONStorage(() => ownerOnlyStateStorage);
