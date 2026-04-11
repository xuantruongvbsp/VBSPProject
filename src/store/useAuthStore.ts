// Trạng thái phân quyền của ứng dụng. Mặc định mọi người truy cập là 'viewer'
// (chỉ xem dữ liệu đã xuất bản, không thấy tệp gốc / không nhập được tệp).
// Chủ sở hữu mở khóa chế độ 'owner' bằng mật khẩu (xem `src/config/auth.ts`).
//
// Vai trò được lưu trong localStorage để bền vững giữa các lần mở trình duyệt
// trên CÙNG một máy. Người xem ở máy khác sẽ luôn ở trạng thái 'viewer'.

import { create } from 'zustand';

export type Role = 'owner' | 'viewer';

const STORAGE_KEY = 'vsppro.role';

function readInitialRole(): Role {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, role);
    } catch {
      /* noop */
    }
    set({ role });
  },
  logout: () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'viewer');
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
