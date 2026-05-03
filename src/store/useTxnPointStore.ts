import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TxnPointRecord } from '@/lib/types';

interface TxnPointState {
  points: TxnPointRecord[];
  selectedPointId: string | null;

  addPoint: (p: Omit<TxnPointRecord, 'id'>) => TxnPointRecord;
  updatePoint: (id: string, patch: Partial<Omit<TxnPointRecord, 'id'>>) => void;
  removePoint: (id: string) => void;
  selectPoint: (id: string | null) => void;
  importPoints: (records: TxnPointRecord[], mode: 'replace' | 'merge') => void;
  clearAll: () => void;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useTxnPointStore = create<TxnPointState>()(
  persist(
    (set) => ({
      points: [],
      selectedPointId: null,

      addPoint: (p) => {
        const rec: TxnPointRecord = {
          id: newId(),
          maDGD: p.maDGD.trim(),
          tenDGD: p.tenDGD.trim(),
          maThons: dedup(p.maThons),
        };
        set((state) => ({ points: [...state.points, rec] }));
        return rec;
      },

      updatePoint: (id, patch) =>
        set((state) => ({
          points: state.points.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...(patch.maDGD !== undefined ? { maDGD: patch.maDGD.trim() } : {}),
                  ...(patch.tenDGD !== undefined ? { tenDGD: patch.tenDGD.trim() } : {}),
                  ...(patch.maThons !== undefined ? { maThons: dedup(patch.maThons) } : {}),
                }
              : r
          ),
        })),

      removePoint: (id) =>
        set((state) => ({
          points: state.points.filter((r) => r.id !== id),
          selectedPointId: state.selectedPointId === id ? null : state.selectedPointId,
        })),

      selectPoint: (id) => set({ selectedPointId: id }),

      importPoints: (records, mode) =>
        set((state) => {
          const sanitized = records
            .filter((r) => r && typeof r.maDGD === 'string' && typeof r.tenDGD === 'string')
            .map<TxnPointRecord>((r) => ({
              id: typeof r.id === 'string' && r.id ? r.id : newId(),
              maDGD: String(r.maDGD).trim(),
              tenDGD: String(r.tenDGD).trim(),
              maThons: Array.isArray(r.maThons) ? dedup(r.maThons.map(String)) : [],
            }));
          if (mode === 'replace') {
            return { points: sanitized, selectedPointId: null };
          }
          const byMa = new Map<string, TxnPointRecord>();
          for (const r of state.points) byMa.set(r.maDGD, r);
          for (const r of sanitized) byMa.set(r.maDGD, { ...r, id: byMa.get(r.maDGD)?.id ?? r.id });
          return { points: Array.from(byMa.values()) };
        }),

      clearAll: () => set({ points: [], selectedPointId: null }),
    }),
    {
      name: 'vsppro-txn-points',
      version: 1,
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

export function exportTxnPointJson(points: TxnPointRecord[]): string {
  return JSON.stringify(
    {
      kind: 'vsppro-txn-points',
      version: 1,
      exportedAt: new Date().toISOString(),
      points,
    },
    null,
    2
  );
}

export function parseTxnPointJson(text: string): TxnPointRecord[] {
  const obj = JSON.parse(text);
  const arr: unknown = Array.isArray(obj) ? obj : obj?.points;
  if (!Array.isArray(arr)) {
    throw new Error('Tệp JSON không hợp lệ: thiếu mảng "points".');
  }
  return arr as TxnPointRecord[];
}
