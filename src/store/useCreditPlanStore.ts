import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Decision,
  PlanEntry,
  ActualSummary,
  PlanVsActual,
  BucketLoanDetail,
  Nq11XaSummary,
  Nq11MatchXa,
} from '../lib/credit-plan-types';
import { CHUONG_TRINH_LIST } from '../lib/credit-plan-types';
import { mergeNq11IntoActuals } from '../data/credit-plan-parser';
import { deleteAttachmentBlob } from '../lib/decision-attachments';

interface CreditPlanState {
  // Decisions (gom các dòng kế hoạch cùng QĐ)
  decisions: Decision[];
  addDecision: (d: Decision) => void;
  updateDecision: (id: string, updates: Partial<Decision>) => void;
  deleteDecision: (id: string) => void;

  // Plan entries (reference decisionId)
  plans: PlanEntry[];
  addPlan: (entry: PlanEntry) => void;
  updatePlan: (id: string, updates: Partial<PlanEntry>) => void;
  deletePlan: (id: string) => void;
  importPlans: (entries: PlanEntry[]) => void;

  // Actual summaries (parsed from Excel)
  actuals: ActualSummary[];
  actualDate: string | null;
  actualTotalRows: number;
  /** Kết quả match NQ11 với Báo cáo 31 — tính lúc import Báo cáo 31 */
  nq11MatchByXa: Nq11MatchXa[];
  /** Diagnostic lần import gần nhất: số dòng quét + số dòng bỏ qua (cộng/tổng). */
  actualDiag: {
    scannedRows?: number;
    skippedRows?: number;
    detectedIdCols?: string[];
    duplicateLoanIds?: number;
    hasInvestorCol?: boolean;
    gqvlXaReclassified?: number;
  } | null;
  /** Chi tiết món vay theo bucket — không persist (kích thước lớn; mất khi reload, cần import lại). */
  loanDetailsByBucket: Record<string, BucketLoanDetail[]>;
  setActuals: (
    summaries: ActualSummary[],
    date: string | null,
    totalRows: number,
    nq11MatchByXa?: Nq11MatchXa[],
    diag?: { scannedRows?: number; skippedRows?: number; detectedIdCols?: string[]; duplicateLoanIds?: number; hasInvestorCol?: boolean; gqvlXaReclassified?: number },
    loanDetailsByBucket?: Record<string, BucketLoanDetail[]>
  ) => void;
  clearActuals: () => void;

  // NQ11 (món vay GQVL không được cho vay quay vòng)
  nq11Summaries: Nq11XaSummary[];
  nq11MonVayIds: string[];
  nq11Date: string | null;
  nq11TotalRows: number;
  setNq11: (
    summaries: Nq11XaSummary[],
    monVayIds: string[],
    date: string | null,
    totalRows: number
  ) => void;
  clearNq11: () => void;

  // Computed: actuals after merging NQ11 split
  getMergedActuals: () => ActualSummary[];

  // Computed: plan vs actual
  getPlanVsActual: () => PlanVsActual[];
}

type LegacyDecisionV1 = Omit<Decision, 'maNguonVonList'> & { maNguonVon?: string };
type LegacyPlanV0 = PlanEntry & Partial<{ soQD: string; ngayQD: string; tenQD: string }>;

/** v0 → v2: tách các trường QĐ khỏi plan rows thành decisions + giữ maNguonVon trên plan. */
function migrateFromV0(
  legacyPlans: LegacyPlanV0[],
): { decisions: Decision[]; plans: PlanEntry[] } {
  const decisions: Decision[] = [];
  const plans: PlanEntry[] = [];
  const keyToId = new Map<string, string>();

  for (const row of legacyPlans) {
    const soQD = row.soQD ?? '';
    const ngayQD = row.ngayQD ?? '';
    const tenQD = row.tenQD ?? '';
    const maNguonVon = row.maNguonVon ?? '';
    const key = `${soQD}|${ngayQD}|${maNguonVon}`;

    let decisionId = keyToId.get(key);
    if (!decisionId) {
      decisionId = crypto.randomUUID();
      keyToId.set(key, decisionId);
      decisions.push({
        id: decisionId,
        soQD,
        ngayQD,
        tenQD,
        maNguonVonList: maNguonVon ? [maNguonVon] : [],
        trangThai: 'active',
      });
    }

    plans.push({
      id: row.id,
      decisionId,
      maXa: row.maXa,
      tenXa: row.tenXa,
      maNguonVon,
      maChuongTrinh: row.maChuongTrinh,
      tenChuongTrinh: row.tenChuongTrinh,
      soTien: row.soTien,
    });
  }

  return { decisions, plans };
}

/** Áp dụng remap mã chương trình theo `codeMap` cho mỗi plan entry. Mỗi entry độc lập,
 *  nên các swap kiểu A↔B an toàn (đọc mã cũ, ghi mã mới, không ghi đè trong vòng lặp).
 */
function remapPlanCodes(plans: PlanEntry[], codeMap: Record<string, string>): PlanEntry[] {
  return plans.map((p) => {
    const newCode = codeMap[p.maChuongTrinh];
    if (!newCode) return p;
    const newName = CHUONG_TRINH_LIST.find((c) => c.ma === newCode)?.ten ?? p.tenChuongTrinh;
    return { ...p, maChuongTrinh: newCode, tenChuongTrinh: newName };
  });
}

/** v2 → v3: cập nhật mã chương trình của plan entries cho khớp Báo cáo 31.
 * Bug cũ: CHUONG_TRINH_LIST dùng mã sai (02 = cận nghèo, 04 = thoát nghèo, 09 = HSSV).
 * Báo cáo 31 thực tế: 02 = HSSV, 09 = thoát nghèo QĐ 28, 19 = cận nghèo QĐ 15.
 * NĐ100 ở đây tạm để 'ND100' (sẽ được xử lý đúng ở v3 → v4).
 */
function migrateFromV2(plans: PlanEntry[]): PlanEntry[] {
  return remapPlanCodes(plans, {
    '02': '19',     // cận nghèo QĐ 15
    '04': '09',     // hộ mới thoát nghèo QĐ 28
    '09': '02',     // HSSV
    '19': 'ND100',  // NĐ100 placeholder
  });
}

/** v3 → v4: NĐ100 nhà ở xã hội xác nhận = mã 12 (Báo cáo 31).
 * Trước v4 mã '12' đang gắn nhãn "Cho vay hộ nghèo về nhà ở" → đẩy entry này về placeholder
 * 'HN_NHAO' để user xác nhận mã thực sau (có thể là QĐ 33/2015).
 * Map độc lập theo entry: ND100→12 và 12→HN_NHAO không xung đột vì mỗi entry chỉ map 1 lần.
 */
function migrateFromV3(plans: PlanEntry[]): PlanEntry[] {
  return remapPlanCodes(plans, {
    'ND100': '12',
    '12': 'HN_NHAO',
  });
}

/** v4 → v5: hộ nghèo về nhà ở xác nhận = mã 07 (Báo cáo 31).
 * Trước v5 mã '07' đang gắn nhãn "Cho vay ĐTCS đi LĐ nước ngoài" → đẩy entry về placeholder
 * 'LDNN' để user xác nhận mã thực sau.
 */
function migrateFromV4(plans: PlanEntry[]): PlanEntry[] {
  return remapPlanCodes(plans, {
    'HN_NHAO': '07',
    '07': 'LDNN',
  });
}

/** v5 → v6: Cho vay ĐTCS đi LĐ nước ngoài xác nhận = mã 04 (Báo cáo 31).
 * Mã 04 đã trống sau v2→v3 (placeholder cũ '04' đã được remap sang '09').
 */
function migrateFromV5(plans: PlanEntry[]): PlanEntry[] {
  return remapPlanCodes(plans, { 'LDNN': '04' });
}

/** v1 → v2: đổi Decision.maNguonVon → maNguonVonList; phát maNguonVon xuống mỗi plan line. */
function migrateFromV1(
  legacyDecisions: LegacyDecisionV1[],
  legacyPlans: PlanEntry[],
): { decisions: Decision[]; plans: PlanEntry[] } {
  const decById = new Map<string, { nv: string }>();
  const decisions: Decision[] = legacyDecisions.map((d) => {
    const nv = d.maNguonVon ?? '';
    decById.set(d.id, { nv });
    const { maNguonVon: _drop, ...rest } = d;
    return { ...rest, maNguonVonList: nv ? [nv] : [] } as Decision;
  });
  const plans: PlanEntry[] = legacyPlans.map((p) => {
    if ((p as PlanEntry).maNguonVon) return p;
    const nv = decById.get(p.decisionId)?.nv ?? '';
    return { ...p, maNguonVon: nv };
  });
  return { decisions, plans };
}

export const useCreditPlanStore = create<CreditPlanState>()(
  persist(
    (set, get) => ({
      decisions: [],
      addDecision: (d) => set((s) => ({ decisions: [...s.decisions, d] })),
      updateDecision: (id, updates) =>
        set((s) => ({
          decisions: s.decisions.map((d) => (d.id === id ? { ...d, ...updates } : d)),
        })),
      deleteDecision: (id) => {
        // Cascade: dọn file PDF đính kèm trong IndexedDB (best-effort)
        void deleteAttachmentBlob(id).catch(() => undefined);
        set((s) => ({
          decisions: s.decisions.filter((d) => d.id !== id),
          // Cascade: xóa luôn các dòng kế hoạch tham chiếu decision này
          plans: s.plans.filter((p) => p.decisionId !== id),
        }));
      },

      plans: [],
      addPlan: (entry) => set((s) => ({ plans: [...s.plans, entry] })),
      updatePlan: (id, updates) =>
        set((s) => ({
          plans: s.plans.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      deletePlan: (id) => set((s) => ({ plans: s.plans.filter((p) => p.id !== id) })),
      importPlans: (entries) => set((s) => ({ plans: [...s.plans, ...entries] })),

      actuals: [],
      actualDate: null,
      actualTotalRows: 0,
      nq11MatchByXa: [],
      actualDiag: null,
      loanDetailsByBucket: {},
      setActuals: (summaries, date, totalRows, nq11MatchByXa, diag, loanDetailsByBucket) =>
        set({
          actuals: summaries,
          actualDate: date,
          actualTotalRows: totalRows,
          nq11MatchByXa: nq11MatchByXa ?? [],
          actualDiag: diag ?? null,
          loanDetailsByBucket: loanDetailsByBucket ?? {},
        }),
      clearActuals: () =>
        set({ actuals: [], actualDate: null, actualTotalRows: 0, nq11MatchByXa: [], actualDiag: null, loanDetailsByBucket: {} }),

      nq11Summaries: [],
      nq11MonVayIds: [],
      nq11Date: null,
      nq11TotalRows: 0,
      setNq11: (summaries, monVayIds, date, totalRows) =>
        set({
          nq11Summaries: summaries,
          nq11MonVayIds: monVayIds,
          nq11Date: date,
          nq11TotalRows: totalRows,
        }),
      clearNq11: () =>
        set({ nq11Summaries: [], nq11MonVayIds: [], nq11Date: null, nq11TotalRows: 0 }),

      getMergedActuals: () => {
        const { actuals, nq11Summaries } = get();
        return mergeNq11IntoActuals(actuals, nq11Summaries);
      },

      getPlanVsActual: () => {
        const { plans, decisions } = get();
        const actuals = get().getMergedActuals();
        const decIds = new Set(decisions.map((d) => d.id));
        const key = (maXa: string, nguonVon: string, ct: string) =>
          `${maXa}|${nguonVon}|${ct}`;

        // Aggregate plans by (xã, NV-from-line, chương trình)
        const planMap = new Map<string, { total: number; entry: PlanEntry }>();
        for (const p of plans) {
          if (!decIds.has(p.decisionId)) continue; // orphan — skip
          const k = key(p.maXa, p.maNguonVon, p.maChuongTrinh);
          const existing = planMap.get(k);
          if (existing) {
            existing.total += p.soTien;
          } else {
            planMap.set(k, { total: p.soTien, entry: p });
          }
        }

        // Build actual map
        const actualMap = new Map<string, ActualSummary>();
        for (const a of actuals) {
          const k = key(a.maXa, a.maNguonVon, a.maChuongTrinh);
          actualMap.set(k, a);
        }

        // Merge all keys
        const allKeys = new Set([...planMap.keys(), ...actualMap.keys()]);
        const result: PlanVsActual[] = [];

        for (const k of allKeys) {
          const plan = planMap.get(k);
          const actual = actualMap.get(k);
          const [maXa, maNguonVon, maChuongTrinh] = k.split('|');

          const planAmount = plan?.total ?? 0;
          // Convert actual from đồng to triệu đồng
          const actualAmount = actual ? actual.tongDuNo / 1_000_000 : 0;

          result.push({
            maXa,
            tenXa: plan?.entry.tenXa ?? actual?.tenXa ?? maXa,
            maNguonVon,
            maChuongTrinh,
            tenChuongTrinh: plan?.entry.tenChuongTrinh ?? actual?.tenChuongTrinh ?? maChuongTrinh,
            planAmount,
            actualAmount: Math.round(actualAmount * 100) / 100,
            diff: Math.round((actualAmount - planAmount) * 100) / 100,
            pct: planAmount > 0 ? Math.round((actualAmount / planAmount) * 10000) / 100 : 0,
            soMonVay: actual?.soMonVay ?? 0,
          });
        }

        return result.sort((a, b) => a.maXa.localeCompare(b.maXa) || a.maChuongTrinh.localeCompare(b.maChuongTrinh));
      },
    }),
    {
      name: 'vsppro-credit-plan',
      version: 6,
      migrate: (persisted: unknown, version: number) => {
        let s = (persisted ?? {}) as Partial<CreditPlanState> & {
          decisions?: LegacyDecisionV1[];
          plans?: LegacyPlanV0[];
        };
        // v0 → v1 (không có `decisions`, plan rows có QĐ fields)
        if (version < 1) {
          const { decisions, plans } = migrateFromV0((s.plans ?? []) as LegacyPlanV0[]);
          s = { ...s, decisions, plans } as typeof s;
        }
        // v1 → v2 (Decision.maNguonVon → maNguonVonList; plan lines thiếu NV)
        if (version < 2) {
          const { decisions, plans } = migrateFromV1(
            (s.decisions ?? []) as LegacyDecisionV1[],
            (s.plans ?? []) as PlanEntry[],
          );
          s = { ...s, decisions, plans } as typeof s;
        }
        // v2 → v3 (remap maChuongTrinh cho khớp Báo cáo 31: 02/09/19)
        if (version < 3) {
          const plans = migrateFromV2((s.plans ?? []) as PlanEntry[]);
          s = { ...s, plans } as typeof s;
        }
        // v3 → v4 (NĐ100 = 12; tách hộ nghèo về nhà ở khỏi mã 12)
        if (version < 4) {
          const plans = migrateFromV3((s.plans ?? []) as PlanEntry[]);
          s = { ...s, plans } as typeof s;
        }
        // v4 → v5 (hộ nghèo về nhà ở = 07; tách LĐ nước ngoài khỏi mã 07)
        if (version < 5) {
          const plans = migrateFromV4((s.plans ?? []) as PlanEntry[]);
          s = { ...s, plans } as typeof s;
        }
        // v5 → v6 (LĐ nước ngoài = 04)
        if (version < 6) {
          const plans = migrateFromV5((s.plans ?? []) as PlanEntry[]);
          s = { ...s, plans } as typeof s;
        }
        return s as CreditPlanState;
      },
      partialize: (s) => ({
        decisions: s.decisions,
        plans: s.plans,
        actuals: s.actuals,
        actualDate: s.actualDate,
        actualTotalRows: s.actualTotalRows,
        actualDiag: s.actualDiag,
        nq11Summaries: s.nq11Summaries,
        nq11MonVayIds: s.nq11MonVayIds,
        nq11Date: s.nq11Date,
        nq11TotalRows: s.nq11TotalRows,
        nq11MatchByXa: s.nq11MatchByXa,
      }),
    }
  )
);
