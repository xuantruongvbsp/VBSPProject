import { useMemo } from 'react';
import { Activity, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { XA_LIST } from '@/lib/credit-plan-types';

type ProgramGroup = {
  title: string;
  codes: string[];
  maNguonVon: string;
  /** Trừ thêm "Dư nợ đã thu hồi NQ11" khỏi "Còn phải thực hiện" theo xã. */
  subtractNq11Recovered?: boolean;
  /** Giới hạn card chỉ hiển thị 1 xã (dùng cho các báo cáo GQVL xã theo Mã NĐT). */
  limitToXa?: string;
  /** Hiển thị Mã nhà đầu tư ngay dưới tiêu đề card (tham chiếu nhanh). */
  maNhaDauTu?: string;
};

const TW_GROUPS: ProgramGroup[] = [
  { title: 'HN, HCN, HTN TW', codes: ['01', '19', '09'], maNguonVon: '1' },
  { title: 'NSVSMT', codes: ['06'], maNguonVon: '1' },
  { title: 'GQVL TW', codes: ['03A', '03B'], maNguonVon: '1', subtractNq11Recovered: true },
  { title: 'HSSV - Ko có STEM', codes: ['02'], maNguonVon: '1' },
  { title: 'STEM', codes: ['STEM'], maNguonVon: '1' },
  { title: 'NOXH TW', codes: ['12'], maNguonVon: '1' },
];

const DP_GROUPS: ProgramGroup[] = [
  { title: 'GQVL ĐP TỈNH', codes: ['03'], maNguonVon: '2' },
  { title: 'HN, HCN, HTN TỈNH', codes: ['01', '19', '09'], maNguonVon: '2' },
  { title: 'Án Phạt Tù ĐP', codes: ['26'], maNguonVon: '2' },
  { title: 'NOXH ĐP', codes: ['12'], maNguonVon: '2' },
  { title: 'MỨC SỐNG TB', codes: ['99'], maNguonVon: '2' },
  { title: 'Án Phạt Tù TW', codes: ['26'], maNguonVon: '1' },
];

// Thứ tự hiển thị xã: Phú Hòa, Phú Vinh, Định Quán, Thanh Sơn, La Ngà
const XA_ORDER = ['460044', '460050', '460092', '460060', '460025'];

/** Excel-style: số âm bọc ngoặc, 0 hiển thị "—". */
function fmtCell(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '—';
  if (r < 0) return `(${Math.abs(r).toLocaleString('vi-VN')})`;
  return r.toLocaleString('vi-VN');
}

function cellColor(n: number): string {
  const r = Math.round(n);
  if (r > 0) return 'text-amber-700 dark:text-amber-400';
  if (r < 0) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-slate-400 dark:text-slate-500';
}

function SectionHeader({ title, date }: { title: string; date: string }) {
  return (
    <div className="mb-4 flex flex-col items-center gap-1 border-b border-rose-200/60 pb-3 dark:border-rose-900/40">
      <h2 className="text-center text-base font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
        {title}
      </h2>
      <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
        <Calendar className="h-3 w-3" />
        Thời điểm {date}
      </div>
    </div>
  );
}

export function PerformanceReport() {
  const getPlanVsActual = useCreditPlanStore((s) => s.getPlanVsActual);
  const actualDate = useCreditPlanStore((s) => s.actualDate);
  const nq11Summaries = useCreditPlanStore((s) => s.nq11Summaries);
  const nq11MatchByXa = useCreditPlanStore((s) => s.nq11MatchByXa);
  const decisions = useCreditPlanStore((s) => s.decisions);
  const comparison = useMemo(() => getPlanVsActual(), [getPlanVsActual]);

  /** Báo cáo GQVL ĐP XÃ — 1 card tổng hợp, hiển thị đầy đủ 5 xã.
   *  Chỉ render khi có ít nhất 1 QĐ NV=3 + Mã NĐT (nếu không thì parser không reclassify). */
  const xaGroups = useMemo<ProgramGroup[]>(() => {
    const hasConfiguredNdt = decisions.some(
      (d) =>
        d.trangThai !== 'archived' &&
        d.maNguonVonList.includes('3') &&
        !!d.maNhaDauTu,
    );
    if (!hasConfiguredNdt) return [];
    return [{ title: 'GQVL ĐP XÃ', codes: ['03'], maNguonVon: '3' }];
  }, [decisions]);

  /** Dư nợ đã thu hồi NQ11 theo xã (triệu đồng) — trùng logic Báo cáo thu hồi NQ11. */
  const recoveredByXa = useMemo(() => {
    const matchMap = new Map(nq11MatchByXa.map((m) => [m.maXa, m]));
    const out = new Map<string, number>();
    for (const s of nq11Summaries) {
      const m = matchMap.get(s.maXa);
      if (!m) continue;
      out.set(s.maXa, (s.tongDuNo - m.matchedTongDuNo) / 1_000_000);
    }
    return out;
  }, [nq11Summaries, nq11MatchByXa]);

  const computeGroup = (group: ProgramGroup) => {
    const codeSet = new Set(group.codes);
    const byXa = new Map<string, { kh: number; tt: number }>();
    for (const c of comparison) {
      if (c.maNguonVon !== group.maNguonVon) continue;
      if (!codeSet.has(c.maChuongTrinh)) continue;
      if (group.limitToXa && c.maXa !== group.limitToXa) continue;
      const x = byXa.get(c.maXa) ?? { kh: 0, tt: 0 };
      x.kh += c.planAmount;
      x.tt += c.actualAmount;
      byXa.set(c.maXa, x);
    }
    const xaList = group.limitToXa ? [group.limitToXa] : XA_ORDER;
    const rows = xaList.map((maXa, idx) => {
      const x = byXa.get(maXa);
      const kh = x?.kh ?? 0;
      const tt = x?.tt ?? 0;
      const recovered = group.subtractNq11Recovered ? (recoveredByXa.get(maXa) ?? 0) : 0;
      const xaInfo = XA_LIST.find((v) => v.maXa === maXa);
      return {
        stt: idx + 1,
        maXa,
        tenXa: xaInfo?.tenXa ?? maXa,
        remaining: kh - tt - recovered,
      };
    });
    const total = rows.reduce((s, r) => s + r.remaining, 0);
    return { rows, total };
  };

  const renderCard = (group: ProgramGroup) => {
    const { rows, total } = computeGroup(group);
    const cardKey = `${group.title}|${group.maNguonVon}|${group.limitToXa ?? ''}|${group.maNhaDauTu ?? ''}`;
    return (
      <Card key={cardKey} className="overflow-hidden transition-shadow hover:shadow-md">
        <div className="border-b border-rose-200 bg-gradient-to-b from-rose-50 to-rose-100/60 px-3 py-2.5 text-center dark:border-rose-900/50 dark:from-rose-900/40 dark:to-rose-900/20">
          <div className="text-sm font-bold tracking-tight text-rose-700 dark:text-rose-200">
            {group.title}
          </div>
          {group.maNhaDauTu && (
            <div className="mt-0.5 font-mono text-[10px] font-normal text-rose-500/80 dark:text-rose-400/80">
              {group.maNhaDauTu}
            </div>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
              <th className="w-8 px-2 py-1.5 text-center">STT</th>
              <th className="px-2 py-1.5 text-left">Xã</th>
              <th className="px-2 py-1.5 text-right">Còn phải TH</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.maXa}
                className="border-b border-slate-100 last:border-b-0 dark:border-slate-700/60"
              >
                <td className="px-2 py-1.5 text-center text-xs text-slate-500 dark:text-slate-400">{r.stt}</td>
                <td className="px-2 py-1.5 text-slate-800 dark:text-slate-100">{r.tenXa}</td>
                <td className={`px-2 py-1.5 text-right font-mono tabular-nums ${cellColor(r.remaining)}`}>
                  {fmtCell(r.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800/60">
              <td colSpan={2} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Tổng cộng
              </td>
              <td className={`px-2 py-2 text-right font-mono text-sm font-bold tabular-nums ${cellColor(total)}`}>
                {fmtCell(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>
    );
  };

  return (
    <div className="space-y-8 p-4 md:p-6">
      <header className="flex items-start gap-3">
        <div className="hidden rounded-lg bg-plan-50 p-2 text-plan-700 ring-1 ring-plan-200 dark:bg-plan-900/40 dark:text-plan-300 dark:ring-plan-800 sm:block">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Báo cáo thực hiện
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Còn phải thực hiện = KH − TT theo nhóm chương trình. Đơn vị: triệu đồng.
          </p>
        </div>
      </header>

      <section>
        <SectionHeader title="Chỉ tiêu trung ương còn lại" date={actualDate ?? '—'} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {TW_GROUPS.map(renderCard)}
        </div>
      </section>

      <section>
        <SectionHeader title="Chỉ tiêu địa phương còn lại" date={actualDate ?? '—'} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {DP_GROUPS.map(renderCard)}
        </div>
      </section>

      {xaGroups.length > 0 && (
        <section>
          <SectionHeader title="Chỉ tiêu địa phương xã còn lại" date={actualDate ?? '—'} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {xaGroups.map(renderCard)}
          </div>
        </section>
      )}
    </div>
  );
}
