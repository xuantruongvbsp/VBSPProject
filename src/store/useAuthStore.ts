// Trạng thái phân quyền của ứng dụng. Mặc định mọi người truy cập là 'viewer'
// (chỉ xem dữ liệu đã xuất bản, không thấy tệp gốc / không nhập được tệp).
// Chủ sở hữu mở khóa chế độ 'owner' bằng mật khẩu (xem `src/config/auth.ts`).
//
// Vai trò được lưu trong localStorage để bền vững giữa các lần mở trình duyệt
// trên CÙNG một máy. Người xem ở máy khác sẽ luôn ở trạng thái 'viewer'.

import { create } from 'zustand';

export type Role = 'owner' | 'viewer';

/** Khóa localStorage lưu vai trò. Export để lớp lưu trữ "chỉ-ghi-khi-owner"
 *  của các store khác (vd: useCreditPlanStore) đọc cùng một nguồn sự thật. */
export const ROLE_STORAGE_KEY = 'vsppro.role';

function readInitialRole(): Role {
  try {
    const v = localStorage.getItem(ROLE_STORAGE_KEY);
    return v === 'owner' ? 'owner' : 'viewer';
  } catch {
    return 'viewer';
  }
}

interface AuthState {
  role: Role;
  setRole: (r: Role) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: readInitialRole(),
  setRole: (role) => {
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch {
      /* noop */
    }
    set({ role });
    if (role === 'owner') {
      // Vừa mở khóa quản trị: nạp lại các store do chủ sở hữu quản lý từ
      // localStorage, loại bỏ mọi dữ liệu đã xuất bản mà ViewerBootstrap có thể
      // đã bơm vào khi còn ở vai trò 'viewer'. Nếu không, thao tác sửa đầu tiên
      // của admin sẽ ghi đè dữ liệu (đã xuất bản, có thể cũ) lên dữ liệu gốc tốt
      // hơn đang nằm trong localStorage. Dynamic import để tránh phụ thuộc vòng.
      //
      // Chỉ rehydrate khi store ĐÃ có dữ liệu lưu cục bộ. Máy admin mới (chưa có
      // localStorage) thì giữ nguyên dữ liệu đã xuất bản đang ở bộ nhớ để khởi
      // tạo — rehydrate lúc này sẽ xóa trắng store một cách vô ích.
      const hasPersisted = (key: string): boolean => {
        try {
          return localStorage.getItem(key) != null;
        } catch {
          return false;
        }
      };
      if (hasPersisted('vsppro-credit-plan'))
        void import('./useCreditPlanStore').then((m) =>
          m.useCreditPlanStore.persist.rehydrate()
        );
      if (hasPersisted('vsppro-staff'))
        void import('./useStaffStore').then((m) =>
          m.useStaffStore.persist.rehydrate()
        );
      if (hasPersisted('vsppro-txn-points'))
        void import('./useTxnPointStore').then((m) =>
          m.useTxnPointStore.persist.rehydrate()
        );
    }
  },
  logout: () => {
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, 'viewer');
    } catch {
      /* noop */
    }
    set({ role: 'viewer' });
  },
}));

/** Tiện ích hook ngắn gọn cho component chỉ cần biết có phải chủ sở hữu không. */
export function useIsOwner(): boolean {
  return useAuthStore((s) => s.role === 'owner');
}
