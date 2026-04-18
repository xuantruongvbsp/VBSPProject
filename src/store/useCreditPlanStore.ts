import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Decision,
  PlanEntry,
  ActualSummary,
  PlanVsActual,
  Nq11XaSummary,
  Nq11MatchXa,
} from '../lib/credit-plan-types';
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
  setActuals: (
    summaries: ActualSummary[],
    date: string | null,
    totalRows: number,
    nq11MatchByXa?: Nq11MatchXa[]
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

/** Migration: legacy plan rows với soQD/ngayQD/tenQD/maNguonVon được tách thành decisions + plan (decisionId). */
function migrateLegacyPlans(
  legacyPlans: Array<PlanEntry & Partial<{ soQD: string; ngayQD: string; tenQD: string; maNguonVon: string }>>,
): { decisions: Decision[]; plans: PlanEntry[] } {
  const decisions: Decision[] = [];
  const plans: PlanEntry[] = [];
  const keyToId = new Map<string, string>();

  for (const row of legacyPlans) {
    // Đã migrate rồi — giữ nguyên
    if ((row as PlanEntry).decisionId) {
      plans.push(row as PlanEntry);
      continue;
    }
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
        maNguonVon,
        trangThai: 'active',
      });
    }

    plans.push({
      id: row.id,
      decisionId,
      maXa: row.maXa,
      tenXa: row.tenXa,
      maChuongTrinh: row.maChuongTrinh,
      tenChuongTrinh: row.tenChuongTrinh,
      soTien: row.soTien,
    });
  }

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
      setActuals: (summaries, date, totalRows, nq11MatchByXa) =>
        set({
          actuals: summaries,
          actualDate: date,
          actualTotalRows: totalRows,
          nq11MatchByXa: nq11MatchByXa ?? [],
        }),
      clearActuals: () =>
        set({ actuals: [], actualDate: null, actualTotalRows: 0, nq11MatchByXa: [] }),

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
        const decById = new Map(decisions.map((d) => [d.id, d]));
        const key = (maXa: string, nguonVon: string, ct: string) =>
          `${maXa}|${nguonVon}|${ct}`;

        // Aggregate plans by (xã, NV-from-decision, chương trình)
        const planMap = new Map<string, { total: number; entry: PlanEntry; nv: string }>();
        for (const p of plans) {
          const dec = decById.get(p.decisionId);
          if (!dec) continue; // orphan — skip
          const k = key(p.maXa, dec.maNguonVon, p.maChuongTrinh);
          const existing = planMap.get(k);
          if (existing) {
            existing.total += p.soTien;
          } else {
            planMap.set(k, { total: p.soTien, entry: p, nv: dec.maNguonVon });
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
          });
        }

        return result.sort((a, b) => a.maXa.localeCompare(b.maXa) || a.maChuongTrinh.localeCompare(b.maChuongTrinh));
      },
    }),
    {
      name: 'vsppro-credit-plan',
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const s = (persisted ?? {}) as Partial<CreditPlanState> & {
          plans?: Array<PlanEntry & Partial<{ soQD: string; ngayQD: string; tenQD: string; maNguonVon: string }>>;
        };
        if (version < 1) {
          const { decisions, plans } = migrateLegacyPlans(s.plans ?? []);
          return { ...s, decisions, plans } as CreditPlanState;
        }
        return s as CreditPlanState;
      },
      partialize: (s) => ({
        decisions: s.decisions,
        plans: s.plans,
        actuals: s.actuals,
        actualDate: s.actualDate,
        actualTotalRows: s.actualTotalRows,
        nq11Summaries: s.nq11Summaries,
        nq11MonVayIds: s.nq11MonVayIds,
        nq11Date: s.nq11Date,
        nq11TotalRows: s.nq11TotalRows,
        nq11MatchByXa: s.nq11MatchByXa,
      }),
    }
  )
);
