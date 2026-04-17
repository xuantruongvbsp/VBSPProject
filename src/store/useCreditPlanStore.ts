import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlanEntry, ActualSummary, PlanVsActual } from '../lib/credit-plan-types';

interface CreditPlanState {
  // Plan entries (manual CRUD)
  plans: PlanEntry[];
  addPlan: (entry: PlanEntry) => void;
  updatePlan: (id: string, updates: Partial<PlanEntry>) => void;
  deletePlan: (id: string) => void;
  importPlans: (entries: PlanEntry[]) => void;

  // Actual summaries (parsed from Excel)
  actuals: ActualSummary[];
  actualDate: string | null;
  actualTotalRows: number;
  setActuals: (summaries: ActualSummary[], date: string | null, totalRows: number) => void;
  clearActuals: () => void;

  // Computed: plan vs actual
  getPlanVsActual: () => PlanVsActual[];
}

export const useCreditPlanStore = create<CreditPlanState>()(
  persist(
    (set, get) => ({
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
      setActuals: (summaries, date, totalRows) =>
        set({ actuals: summaries, actualDate: date, actualTotalRows: totalRows }),
      clearActuals: () => set({ actuals: [], actualDate: null, actualTotalRows: 0 }),

      getPlanVsActual: () => {
        const { plans, actuals } = get();
        const key = (maXa: string, nguonVon: string, ct: string) =>
          `${maXa}|${nguonVon}|${ct}`;

        // Aggregate plans by key
        const planMap = new Map<string, { total: number; entry: PlanEntry }>();
        for (const p of plans) {
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
          });
        }

        return result.sort((a, b) => a.maXa.localeCompare(b.maXa) || a.maChuongTrinh.localeCompare(b.maChuongTrinh));
      },
    }),
    {
      name: 'vsppro-credit-plan',
      partialize: (s) => ({
        plans: s.plans,
        actuals: s.actuals,
        actualDate: s.actualDate,
        actualTotalRows: s.actualTotalRows,
      }),
    }
  )
);
