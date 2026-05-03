// Tiện ích đối chiếu Mã thôn ↔ Cán bộ / Điểm giao dịch — dùng chung cho
// các trang báo cáo theo cán bộ / ĐGD ở cả snapshot và period.

import type { StaffRecord, TxnPointRecord } from '@/lib/types';

export interface ThonCoverageMaps {
  /** maThon → danh sách staff.id phụ trách (length > 1 = chồng chéo) */
  thonToStaffIds: Map<string, string[]>;
  /** maThon → danh sách point.id phụ trách */
  thonToPointIds: Map<string, string[]>;
}

/** Xây 2 lookup table cho việc phân loại 1 khế ước theo Cán bộ / ĐGD. */
export function buildThonCoverage(
  staff: StaffRecord[],
  points: TxnPointRecord[]
): ThonCoverageMaps {
  // maDGD → danh sách staff sở hữu
  const dgdToStaff = new Map<string, string[]>();
  for (const s of staff) {
    for (const maDGD of s.maDGDs) {
      const list = dgdToStaff.get(maDGD);
      if (list) list.push(s.id);
      else dgdToStaff.set(maDGD, [s.id]);
    }
  }
  const thonToStaffIds = new Map<string, string[]>();
  for (const p of points) {
    const owners = dgdToStaff.get(p.maDGD) ?? [];
    if (owners.length === 0) continue;
    for (const t of p.maThons) {
      const list = thonToStaffIds.get(t);
      if (list) {
        for (const o of owners) if (!list.includes(o)) list.push(o);
      } else {
        thonToStaffIds.set(t, [...owners]);
      }
    }
  }

  const thonToPointIds = new Map<string, string[]>();
  for (const p of points) {
    for (const t of p.maThons) {
      const list = thonToPointIds.get(t);
      if (list) list.push(p.id);
      else thonToPointIds.set(t, [p.id]);
    }
  }

  return { thonToStaffIds, thonToPointIds };
}

/** Sentinel labels cho nhóm tổng hợp. */
export const STAFF_UNASSIGNED = '(Chưa gán cán bộ)';
export const STAFF_AMBIGUOUS = '(Nhiều cán bộ phụ trách)';
export const DGD_UNASSIGNED = '(Chưa gán ĐGD)';
export const DGD_AMBIGUOUS = '(Nhiều ĐGD)';

/**
 * Bộ trích key cho dimension "Cán bộ" (dạng "NV001 — Tên" hoặc sentinel).
 * Dùng cho `groupBy(rows, extractor)`.
 */
export function makeStaffKeyExtractor(
  staff: StaffRecord[],
  points: TxnPointRecord[]
): (r: { maThon: string }) => string {
  const { thonToStaffIds } = buildThonCoverage(staff, points);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  return (r) => {
    const list = thonToStaffIds.get(r.maThon ?? '');
    if (!list || list.length === 0) return STAFF_UNASSIGNED;
    if (list.length > 1) return STAFF_AMBIGUOUS;
    const s = staffById.get(list[0]);
    return s ? `${s.maNV} — ${s.tenNV}` : STAFF_UNASSIGNED;
  };
}

/** Bộ trích key cho dimension "Điểm giao dịch". */
export function makePointKeyExtractor(
  points: TxnPointRecord[]
): (r: { maThon: string }) => string {
  const thonToPointIds = new Map<string, string[]>();
  for (const p of points) {
    for (const t of p.maThons) {
      const list = thonToPointIds.get(t);
      if (list) list.push(p.id);
      else thonToPointIds.set(t, [p.id]);
    }
  }
  const pointById = new Map(points.map((p) => [p.id, p]));
  return (r) => {
    const list = thonToPointIds.get(r.maThon ?? '');
    if (!list || list.length === 0) return DGD_UNASSIGNED;
    if (list.length > 1) return DGD_AMBIGUOUS;
    const p = pointById.get(list[0]);
    return p ? `${p.maDGD} — ${p.tenDGD}` : DGD_UNASSIGNED;
  };
}
