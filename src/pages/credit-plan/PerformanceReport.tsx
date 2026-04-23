import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { XA_LIST, XA_GQVL_REPORTS } from '@/lib/credit-plan-types';

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

/** Báo cáo GQVL xã — 1 card/1 Mã nhà đầu tư, suy từ cấu hình trong credit-plan-types. */
const XA_GROUPS: ProgramGroup[] = XA_GQVL_REPORTS.map((r) => ({
  title: r.title,
  codes: ['03'],
  maNguonVon: '3',
  limitToXa: r.maXa,
  maNhaDauTu: r.maNhaDauTu,
}));

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
  return 'text-slate-400';
}

export function PerformanceReport() {
  const getPlanVsActual = useCreditPlanStore((s) => s.getPlanVsActual);
  const actualDate = useCreditPlanStore((s) => s.actualDate);
  const nq11Summaries = useCreditPlanStore((s) => s.nq11Summaries);
  const nq11MatchByXa = useCreditPlanStore((s) => s.nq11MatchByXa);
  const comparison = useMemo(() => getPlanVsActual(), [getPlanVsActual]);

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
    return (
      <Card key={group.title} className="overflow-hidden">
        <div className="border-b border-slate-200 bg-rose-50 px-2 py-2 text-center text-sm font-bold text-rose-700 dark:border-slate-700 dark:bg-rose-900/30 dark:text-rose-300">
          {group.title}
          {group.maNhaDauTu && (
            <div className="mt-0.5 font-mono text-[10px] font-normal text-rose-500/80 dark:text-rose-400/80">
              {group.maNhaDauTu}
            </div>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <th className="w-10 px-2 py-1.5 text-center font-medium">STT</th>
              <th className="px-2 py-1.5 text-left font-medium">Xã</th>
              <th className="px-2 py-1.5 text-right font-medium">Còn phải thực hiện</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.maXa} className="border-b border-slate-100 dark:border-slate-700">
                <td className="px-2 py-1 text-center text-slate-500">{r.stt}</td>
                <td className="bg-yellow-50 px-2 py-1 text-slate-800 dark:bg-yellow-900/20 dark:text-slate-100">
                  {r.tenXa}
                </td>
                <td className={`px-2 py-1 text-right font-mono ${cellColor(r.remaining)}`}>
                  {fmtCell(r.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-cyan-50 font-semibold dark:border-slate-600 dark:bg-cyan-900/20">
              <td colSpan={2} className="px-2 py-1.5 text-center text-slate-700 dark:text-slate-200">
                TỔNG CỘNG
              </td>
              <td className={`px-2 py-1.5 text-right font-mono ${cellColor(total)}`}>
                {fmtCell(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>
    );
  };

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Báo cáo thực hiện</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Còn phải thực hiện = KH − TT theo nhóm chương trình. Đơn vị: triệu đồng.
        </p>
      </div>

      <section>
        <div className="mb-3 text-center">
          <h2 className="text-base font-bold uppercase text-rose-700 dark:text-rose-300">
            CHỈ TIÊU TRUNG ƯƠNG CÒN LẠI
          </h2>
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            THỜI ĐIỂM {actualDate ?? '—'}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {TW_GROUPS.map(renderCard)}
        </div>
      </section>

      <section>
        <div className="mb-3 text-center">
          <h2 className="text-base font-bold uppercase text-rose-700 dark:text-rose-300">
            CHỈ TIÊU ĐỊA PHƯƠNG CÒN LẠI
          </h2>
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            THỜI ĐIỂM {actualDate ?? '—'}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {DP_GROUPS.map(renderCard)}
        </div>
      </section>

      {XA_GROUPS.length > 0 && (
        <section>
          <div className="mb-3 text-center">
            <h2 className="text-base font-bold uppercase text-rose-700 dark:text-rose-300">
              CHỈ TIÊU ĐỊA PHƯƠNG XÃ CÒN LẠI
            </h2>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              THỜI ĐIỂM {actualDate ?? '—'}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {XA_GROUPS.map(renderCard)}
          </div>
        </section>
      )}
    </div>
  );
}
