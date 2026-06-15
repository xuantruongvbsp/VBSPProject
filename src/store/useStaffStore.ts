import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ownerOnlyJSONStorage } from '@/lib/owner-only-storage';
import type { StaffRecord } from '@/lib/types';

interface StaffState {
  staff: StaffRecord[];
  selectedStaffId: string | null;

  addStaff: (s: Omit<StaffRecord, 'id'>) => StaffRecord;
  updateStaff: (id: string, patch: Partial<Omit<StaffRecord, 'id'>>) => void;
  removeStaff: (id: string) => void;
  selectStaff: (id: string | null) => void;
  importStaff: (records: StaffRecord[], mode: 'replace' | 'merge') => void;
  clearAll: () => void;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useStaffStore = create<StaffState>()(
  persist(
    (set) => ({
      staff: [],
      selectedStaffId: null,

      addStaff: (s) => {
        const rec: StaffRecord = {
          id: newId(),
          maNV: s.maNV.trim(),
          tenNV: s.tenNV.trim(),
          maDGDs: dedup(s.maDGDs),
        };
        set((state) => ({ staff: [...state.staff, rec] }));
        return rec;
      },

      updateStaff: (id, patch) =>
        set((state) => ({
          staff: state.staff.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...(patch.maNV !== undefined ? { maNV: patch.maNV.trim() } : {}),
                  ...(patch.tenNV !== undefined ? { tenNV: patch.tenNV.trim() } : {}),
                  ...(patch.maDGDs !== undefined ? { maDGDs: dedup(patch.maDGDs) } : {}),
                }
              : r
          ),
        })),

      removeStaff: (id) =>
        set((state) => ({
          staff: state.staff.filter((r) => r.id !== id),
          selectedStaffId: state.selectedStaffId === id ? null : state.selectedStaffId,
        })),

      selectStaff: (id) => set({ selectedStaffId: id }),

      importStaff: (records, mode) =>
        set((state) => {
          const sanitized = records
            .filter((r) => r && typeof r.maNV === 'string' && typeof r.tenNV === 'string')
            .map<StaffRecord>((r) => ({
              id: typeof r.id === 'string' && r.id ? r.id : newId(),
              maNV: String(r.maNV).trim(),
              tenNV: String(r.tenNV).trim(),
              maDGDs: Array.isArray(r.maDGDs) ? dedup(r.maDGDs.map(String)) : [],
            }));
          if (mode === 'replace') {
            return { staff: sanitized, selectedStaffId: null };
          }
          // merge: ghi đè theo maNV trùng, còn lại nối thêm
          const byMaNV = new Map<string, StaffRecord>();
          for (const r of state.staff) byMaNV.set(r.maNV, r);
          for (const r of sanitized) byMaNV.set(r.maNV, { ...r, id: byMaNV.get(r.maNV)?.id ?? r.id });
          return { staff: Array.from(byMaNV.values()) };
        }),

      clearAll: () => set({ staff: [], selectedStaffId: null }),
    }),
    {
      name: 'vsppro-staff',
      version: 2,
      // Chỉ admin được ghi; người xem chỉ nhận danh mục đã xuất bản trong bộ nhớ.
      storage: ownerOnlyJSONStorage,
      // v1 → v2: schema thay đổi từ "Cán bộ → maThons[]" sang
      // "Cán bộ → maDGDs[]" (cán bộ phụ trách nhiều Điểm giao dịch).
      // Dữ liệu maThons cũ không thể tự động chuyển đổi (không có
      // mapping cố định) — drop và yêu cầu người dùng gán lại theo ĐGD.
      migrate: (persisted: unknown, version: number) => {
        const s = (persisted ?? {}) as Partial<StaffState> & {
          staff?: Array<StaffRecord & { maThons?: string[] }>;
        };
        if (version < 2 && Array.isArray(s.staff)) {
          s.staff = s.staff.map((r) => ({
            id: r.id,
            maNV: r.maNV,
            tenNV: r.tenNV,
            maDGDs: [],
          }));
          s.selectedStaffId = null;
        }
        return s as StaffState;
      },
    }
  )
);

function dedup(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const v = String(x).trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/** Xuất danh sách cán bộ thành chuỗi JSON đẹp (để tải xuống). */
export function exportStaffJson(staff: StaffRecord[]): string {
  return JSON.stringify(
    {
      kind: 'vsppro-staff',
      version: 2,
      exportedAt: new Date().toISOString(),
      staff,
    },
    null,
    2
  );
}

/**
 * Đọc & xác thực JSON cán bộ. Chấp nhận:
 *  - { kind: 'vsppro-staff', staff: [...] }
 *  - mảng StaffRecord trực tiếp
 */
export function parseStaffJson(text: string): StaffRecord[] {
  const obj = JSON.parse(text);
  const arr: unknown = Array.isArray(obj) ? obj : obj?.staff;
  if (!Array.isArray(arr)) {
    throw new Error('Tệp JSON không hợp lệ: thiếu mảng "staff".');
  }
  return arr as StaffRecord[];
}
