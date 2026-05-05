import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BanIcon, FileText, FileDown, BarChart3, Inbox, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { ColumnFilter } from '@/components/ui/ColumnFilter';
import { useGridFilter } from '@/lib/grid-filter';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { nguonVonLabel, nguonVonListLabel } from '@/lib/credit-plan-types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function fmtMoney(n: number) {
  return n.toLocaleString('vi-VN');
}

function PctBadge({ pct }: { pct: number }) {
  const color =
    pct >= 100
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800'
      : pct >= 80
        ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800'
        : 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-800';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ${color}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

export function PlanReports() {
  const plans = useCreditPlanStore((s) => s.plans);
  const decisions = useCreditPlanStore((s) => s.decisions);
  const actuals = useCreditPlanStore((s) => s.actuals);
  const loanDetailsByBucket = useCreditPlanStore((s) => s.loanDetailsByBucket);
  const getPlanVsActual = useCreditPlanStore((s) => s.getPlanVsActual);
  const nq11Summaries = useCreditPlanStore((s) => s.nq11Summaries);
  const nq11MatchByXa = useCreditPlanStore((s) => s.nq11MatchByXa);
  const nq11Date = useCreditPlanStore((s) => s.nq11Date);
  const nq11NoxhSummaries = useCreditPlanStore((s) => s.nq11NoxhSummaries);
  const nq11NoxhDate = useCreditPlanStore((s) => s.nq11NoxhDate);
  const actualDate = useCreditPlanStore((s) => s.actualDate);
  const [groupBy, setGroupBy] = useState<'xa' | 'chuongtrinh' | 'nguonvon'>('xa');

  // Báo cáo thu hồi NQ11: ghép nq11Summaries (gốc từ SK_GQVL) với nq11MatchByXa (từ Báo cáo 31)
  const nq11Recovery = useMemo(() => {
    if (nq11Summaries.length === 0) return [];
    const matchMap = new Map(nq11MatchByXa.map((m) => [m.maXa, m]));
    const rows = nq11Summaries.map((s) => {
      const matched = matchMap.get(s.maXa);
      const tongDuNo = s.tongDuNo;
      const hasMatch = !!matched;
      // Còn lại = số dư hiện tại trong Báo cáo 31 (của các món NQ11)
      const conLai = hasMatch ? matched!.matchedTongDuNo : null;
      // Đã thu hồi = SK_GQVL ban đầu − số dư còn lại
      const daThuHoi = hasMatch ? tongDuNo - matched!.matchedTongDuNo : null;
      return {
        maXa: s.maXa,
        tenXa: s.tenXa,
        tongDuNo,
        daThuHoi,
        conLai,
        soMonNQ11: s.soMonVay,
        soMonMatched: matched?.matchedSoMon ?? 0,
        hasMatch,
      };
    });
    return rows;
  }, [nq11Summaries, nq11MatchByXa]);

  const nq11RecoveryTotals = useMemo(() => {
    return nq11Recovery.reduce(
      (acc, r) => ({
        tongDuNo: acc.tongDuNo + r.tongDuNo,
        daThuHoi: acc.daThuHoi + (r.daThuHoi ?? 0),
        conLai: acc.conLai + (r.conLai ?? 0),
        soMonNQ11: acc.soMonNQ11 + r.soMonNQ11,
        soMonMatched: acc.soMonMatched + r.soMonMatched,
      }),
      { tongDuNo: 0, daThuHoi: 0, conLai: 0, soMonNQ11: 0, soMonMatched: 0 }
    );
  }, [nq11Recovery]);

  // Báo cáo thu hồi NQ11 — Cho vay NOXH (CT=12N).
  // Tổng dư nợ ban đầu: từ file NOXH-NQ11 (snapshot tại nq11NoxhDate, theo xã + NV).
  // Còn lại: dư nợ hiện tại của bucket 12N trong actuals (sau khi parse Báo cáo 31
  // có truyền nq11NoxhIds → CT=12 được tách thẳng sang 12N tại lúc parse).
  // Đã thu hồi = Tổng - Còn lại.
  const nq11NoxhRecovery = useMemo(() => {
    if (nq11NoxhSummaries.length === 0) return [];
    // Map bucket 12N theo (xã, NV) trong actuals hiện tại.
    const noxhActualMap = new Map<string, { tongDuNo: number; soMonVay: number }>();
    for (const a of actuals) {
      if (a.maChuongTrinh !== '12N') continue;
      noxhActualMap.set(`${a.maXa}|${a.maNguonVon}`, {
        tongDuNo: a.tongDuNo,
        soMonVay: a.soMonVay,
      });
    }
    return nq11NoxhSummaries.map((s) => {
      const k = `${s.maXa}|${s.maNguonVon}`;
      const matched = noxhActualMap.get(k);
      const hasMatch = !!matched;
      const tongDuNo = s.tongDuNo;
      const conLai = hasMatch ? matched!.tongDuNo : null;
      const daThuHoi = hasMatch ? tongDuNo - matched!.tongDuNo : null;
      return {
        maXa: s.maXa,
        tenXa: s.tenXa,
        maNguonVon: s.maNguonVon,
        tongDuNo,
        daThuHoi,
        conLai,
        soMonNQ11: s.soMonVay,
        soMonMatched: matched?.soMonVay ?? 0,
        hasMatch,
      };
    });
  }, [nq11NoxhSummaries, actuals]);

  const nq11NoxhRecoveryTotals = useMemo(() => {
    return nq11NoxhRecovery.reduce(
      (acc, r) => ({
        tongDuNo: acc.tongDuNo + r.tongDuNo,
        daThuHoi: acc.daThuHoi + (r.daThuHoi ?? 0),
        conLai: acc.conLai + (r.conLai ?? 0),
        soMonNQ11: acc.soMonNQ11 + r.soMonNQ11,
        soMonMatched: acc.soMonMatched + r.soMonMatched,
      }),
      { tongDuNo: 0, daThuHoi: 0, conLai: 0, soMonNQ11: 0, soMonMatched: 0 }
    );
  }, [nq11NoxhRecovery]);

  const comparison = useMemo(() => getPlanVsActual(), [getPlanVsActual, plans, actuals]);

  // Excel-style column filters cho bảng "Chi tiết so sánh"
  const compareGrid = useGridFilter(comparison, {
    xa: (c) => c.tenXa,
    nguonVon: (c) => nguonVonLabel(c.maNguonVon),
    chuongTrinh: (c) => `${c.maChuongTrinh} — ${c.tenChuongTrinh}`,
  });

  /** Xuất danh sách Mã món vay đóng góp vào 1 bucket ra file Excel. */
  const exportBucketLoans = (maXa: string, tenXa: string, maNguonVon: string, maChuongTrinh: string) => {
    const key = `${maXa}|${maNguonVon}|${maChuongTrinh}`;
    const details = loanDetailsByBucket[key] ?? [];
    if (details.length === 0) {
      alert('Không có chi tiết món vay cho nhóm này. Vui lòng nhập lại Sao kê 31 (danh sách chi tiết không được lưu qua phiên).');
      return;
    }
    const rows = details.map((d, i) => ({
      STT: i + 1,
      'Mã món vay': d.maMonVay,
      'Số khế ước': d.soKheUoc,
      'Mã KH': d.maKH,
      'Tên KH': d.tenKH,
      'Dư nợ trong hạn (đ)': d.duNoTrongHan,
      'Dư nợ quá hạn (đ)': d.duNoQuaHan,
      'Dư nợ khoanh (đ)': d.duNoKhoanh,
      'Tổng dư nợ (đ)': d.tongDuNo,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const totalTongDuNo = details.reduce((s, d) => s + d.tongDuNo, 0);
    XLSX.utils.sheet_add_aoa(
      ws,
      [['', '', '', '', 'TỔNG', '', '', '', totalTongDuNo]],
      { origin: -1 },
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chi tiết món vay');
    const safeName = `${tenXa}_${nguonVonLabel(maNguonVon)}_${maChuongTrinh || 'NA'}`.replace(/[^\p{L}\p{N}_-]+/gu, '_');
    XLSX.writeFile(wb, `ChiTiet_${safeName}.xlsx`);
  };

  const hasData = plans.length > 0 || actuals.length > 0;

  // Aggregate comparison by groupBy
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; plan: number; actual: number }>();
    for (const c of comparison) {
      let key: string;
      let label: string;
      if (groupBy === 'xa') {
        key = c.maXa;
        label = c.tenXa;
      } else if (groupBy === 'chuongtrinh') {
        key = c.maChuongTrinh;
        label = c.tenChuongTrinh;
      } else {
        key = c.maNguonVon;
        label = nguonVonLabel(c.maNguonVon);
      }
      const existing = map.get(key);
      if (existing) {
        existing.plan += c.planAmount;
        existing.actual += c.actualAmount;
      } else {
        map.set(key, { label, plan: c.planAmount, actual: c.actualAmount });
      }
    }
    return Array.from(map.values()).map((d) => ({
      ...d,
      plan: Math.round(d.plan),
      actual: Math.round(d.actual),
      pct: d.plan > 0 ? Math.round((d.actual / d.plan) * 10000) / 100 : 0,
    }));
  }, [comparison, groupBy]);

  // Overall totals
  const totalPlan = comparison.reduce((s, c) => s + c.planAmount, 0);
  const totalActual = comparison.reduce((s, c) => s + c.actualAmount, 0);
  const overallPct = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;

  // Per-Decision aggregation: plan total, actual total (joined via xã + line.NV + CT), completion %
  const byDecision = useMemo(() => {
    if (decisions.length === 0) return [];
    const decIds = new Set(decisions.map((d) => d.id));
    const actualKey = (maXa: string, nv: string, ct: string) => `${maXa}|${nv}|${ct}`;
    const actualMap = new Map<string, number>();
    for (const a of actuals) {
      actualMap.set(actualKey(a.maXa, a.maNguonVon, a.maChuongTrinh), a.tongDuNo / 1_000_000);
    }
    const rows = new Map<string, { plan: number; actual: number; count: number }>();
    for (const p of plans) {
      if (!decIds.has(p.decisionId)) continue;
      const r = rows.get(p.decisionId) ?? { plan: 0, actual: 0, count: 0 };
      r.plan += p.soTien;
      r.count++;
      rows.set(p.decisionId, r);
    }
    // Mỗi (decision, xã, NV, CT) tính actual 1 lần (tránh cộng trùng khi nhiều plan line cùng bucket).
    const claimed = new Set<string>();
    for (const p of plans) {
      if (!decIds.has(p.decisionId)) continue;
      const bucketKey = `${p.decisionId}|${p.maXa}|${p.maNguonVon}|${p.maChuongTrinh}`;
      if (claimed.has(bucketKey)) continue;
      claimed.add(bucketKey);
      const a = actualMap.get(actualKey(p.maXa, p.maNguonVon, p.maChuongTrinh)) ?? 0;
      const r = rows.get(p.decisionId);
      if (r) r.actual += a;
    }
    return decisions.map((d) => {
      const r = rows.get(d.id) ?? { plan: 0, actual: 0, count: 0 };
      const pct = r.plan > 0 ? (r.actual / r.plan) * 100 : 0;
      return {
        decision: d,
        plan: r.plan,
        actual: r.actual,
        diff: r.actual - r.plan,
        pct,
        lineCount: r.count,
      };
    });
  }, [plans, decisions, actuals]);

  // Pie data for plan distribution by xa
  const piePlan = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of plans) {
      map.set(p.tenXa || p.maXa, (map.get(p.tenXa || p.maXa) || 0) + p.soTien);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [plans]);

  if (!hasData) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
              <Inbox className="h-8 w-8 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Chưa có dữ liệu</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Vui lòng nhập kế hoạch và/hoặc dữ liệu thực tế trước.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to="/credit-plan/plans"
                className="inline-flex items-center gap-1.5 rounded-md bg-plan-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-plan-800"
              >
                <FileText className="h-3.5 w-3.5" /> Nhập kế hoạch
              </Link>
              <Link
                to="/credit-plan/actual"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <FileDown className="h-3.5 w-3.5" /> Nhập Báo cáo 31
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex items-start gap-3">
        <div className="hidden rounded-lg bg-plan-50 p-2 text-plan-700 ring-1 ring-plan-200 dark:bg-plan-900/40 dark:text-plan-300 dark:ring-plan-800 sm:block">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Báo cáo Kế hoạch vs Thực tế</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            So sánh kế hoạch dư nợ với dư nợ thực tế theo từng nhóm
          </p>
        </div>
      </header>

      {/* Báo cáo thu hồi NQ11 */}
      {nq11Summaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BanIcon className="h-4 w-4 text-rose-600" />
              Báo cáo thu hồi NQ11 — Cho vay GQVL
            </CardTitle>
            <CardDescription>
              Tổng dư nợ: từ SK_GQVL ({nq11Date ?? '—'}).
              {' '}Còn lại: dư nợ hiện tại của các món NQ11 trong Báo cáo 31
              {actualDate ? ` (${actualDate})` : ''} — khớp theo Mã món vay.
              {' '}Đã thu hồi = Tổng dư nợ − Còn lại.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {nq11MatchByXa.length === 0 && (
              <div className="mx-4 mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                Chưa có dữ liệu match — Báo cáo 31 đang được tải sẽ match theo "Mã món vay".
                Nếu bạn upload NQ11 sau Báo cáo 31, hãy tải lại Báo cáo 31 để làm mới bảng này.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <th className="px-4 py-3">Xã</th>
                    <th className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">Tổng dư nợ</th>
                    <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">Dư nợ đã thu hồi</th>
                    <th className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">Dư nợ còn lại</th>
                    <th className="px-4 py-3 text-right">Món NQ11 / Match</th>
                  </tr>
                </thead>
                <tbody>
                  {nq11Recovery.map((r, idx) => (
                    <tr
                      key={r.maXa}
                      className={`border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/50 ${
                        idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''
                      }`}
                    >
                      <td className="px-4 py-2 text-slate-900 dark:text-white">
                        {r.tenXa} <span className="text-xs text-slate-400">({r.maXa})</span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        {fmtMoney(r.tongDuNo)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {r.hasMatch ? fmtMoney(r.daThuHoi!) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                        {r.hasMatch ? fmtMoney(r.conLai!) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                        {r.soMonNQ11.toLocaleString('vi-VN')} / {r.soMonMatched.toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {nq11Recovery.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800">
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">Tổng cộng</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        {fmtMoney(nq11RecoveryTotals.tongDuNo)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {fmtMoney(nq11RecoveryTotals.daThuHoi)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                        {fmtMoney(nq11RecoveryTotals.conLai)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                        {nq11RecoveryTotals.soMonNQ11.toLocaleString('vi-VN')} /{' '}
                        {nq11RecoveryTotals.soMonMatched.toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Báo cáo thu hồi NQ11 — Cho vay NOXH */}
      {nq11NoxhSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-4 w-4 text-rose-600" />
              Báo cáo thu hồi NQ11 — Cho vay NOXH
            </CardTitle>
            <CardDescription>
              Tổng dư nợ: từ file NOXH-NQ11 ({nq11NoxhDate ?? '—'}).
              {' '}Còn lại: dư nợ hiện tại của bucket{' '}
              <span className="font-mono">12N</span> trong Báo cáo 31
              {actualDate ? ` (${actualDate})` : ''} — khớp theo (xã × Nguồn vốn).
              {' '}Đã thu hồi = Tổng dư nợ − Còn lại.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {nq11NoxhRecovery.every((r) => !r.hasMatch) && nq11NoxhRecovery.length > 0 && (
              <div className="mx-4 mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                Bucket 12N chưa xuất hiện trong Báo cáo 31 hiện tại. Hãy tải lại Báo cáo 31
                sau khi đã upload file NOXH-NQ11 để parser tách CT=12 sang 12N.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <th className="px-4 py-3">Xã</th>
                    <th className="px-4 py-3">NV</th>
                    <th className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">Tổng dư nợ</th>
                    <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">Dư nợ đã thu hồi</th>
                    <th className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">Dư nợ còn lại</th>
                    <th className="px-4 py-3 text-right">Món NQ11 / Còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {nq11NoxhRecovery.map((r, idx) => (
                    <tr
                      key={`${r.maXa}-${r.maNguonVon}`}
                      className={`border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/50 ${
                        idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''
                      }`}
                    >
                      <td className="px-4 py-2 text-slate-900 dark:text-white">
                        {r.tenXa} <span className="text-xs text-slate-400">({r.maXa})</span>
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                        {nguonVonLabel(r.maNguonVon)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        {fmtMoney(r.tongDuNo)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {r.hasMatch ? fmtMoney(r.daThuHoi!) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                        {r.hasMatch ? fmtMoney(r.conLai!) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                        {r.soMonNQ11.toLocaleString('vi-VN')} / {r.soMonMatched.toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {nq11NoxhRecovery.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800">
                      <td colSpan={2} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">Tổng cộng</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        {fmtMoney(nq11NoxhRecoveryTotals.tongDuNo)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {fmtMoney(nq11NoxhRecoveryTotals.daThuHoi)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                        {fmtMoney(nq11NoxhRecoveryTotals.conLai)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                        {nq11NoxhRecoveryTotals.soMonNQ11.toLocaleString('vi-VN')} /{' '}
                        {nq11NoxhRecoveryTotals.soMonMatched.toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Báo cáo theo Quyết định — tạm ẩn theo yêu cầu */}
      {false && byDecision.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-plan-700" />
              Báo cáo theo Quyết định
            </CardTitle>
            <CardDescription>
              Mỗi QĐ: tổng kế hoạch, dư nợ thực tế, chênh lệch, tỷ lệ hoàn thành.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <th className="px-4 py-3">Số QĐ</th>
                    <th className="px-4 py-3">Ngày</th>
                    <th className="px-4 py-3">Tên / trích yếu</th>
                    <th className="px-4 py-3">Nguồn vốn</th>
                    <th className="px-4 py-3 text-right">Dòng</th>
                    <th className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">KH (tr.đ)</th>
                    <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">TT (tr.đ)</th>
                    <th className="px-4 py-3 text-right">Chênh lệch</th>
                    <th className="px-4 py-3 text-right">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {byDecision.map((r, idx) => (
                    <tr
                      key={r.decision.id}
                      className={`border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/50 ${
                        idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''
                      }`}
                    >
                      <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{r.decision.soQD}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600 dark:text-slate-300">{r.decision.ngayQD}</td>
                      <td className="max-w-[240px] truncate px-4 py-2 text-slate-600 dark:text-slate-300" title={r.decision.tenQD}>
                        {r.decision.tenQD || <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{nguonVonListLabel(r.decision.maNguonVonList)}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">{r.lineCount}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">{fmtMoney(Math.round(r.plan))}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(Math.round(r.actual))}</td>
                      <td className={`px-4 py-2 text-right font-mono tabular-nums ${r.diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {r.diff >= 0 ? '+' : ''}{fmtMoney(Math.round(r.diff))}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {r.plan > 0 ? <PctBadge pct={r.pct} /> : <span className="text-xs text-slate-400 dark:text-slate-500">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tổng kế hoạch</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{fmtMoney(Math.round(totalPlan))}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">triệu đồng</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tổng thực tế</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(Math.round(totalActual))}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">triệu đồng</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Còn lại phải thực hiện</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${totalPlan - totalActual > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {fmtMoney(Math.round(totalPlan - totalActual))}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">= Tổng kế hoạch − Tổng thực tế</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tỷ lệ hoàn thành</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${overallPct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : overallPct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {overallPct.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">thực tế / kế hoạch</div>
          </CardContent>
        </Card>
      </div>

      {/* Group by selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Nhóm theo:</span>
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {([
            ['xa', 'Xã'],
            ['chuongtrinh', 'Chương trình'],
            ['nguonvon', 'Nguồn vốn'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setGroupBy(val)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                groupBy === val
                  ? 'bg-plan-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart: Plan vs Actual */}
      {grouped.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kế hoạch vs Thực tế</CardTitle>
            <CardDescription>Đơn vị: triệu đồng</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={grouped} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => fmtMoney(v)} />
                <YAxis dataKey="label" type="category" width={180} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => fmtMoney(value) + ' tr.đ'}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                <Bar dataKey="plan" name="Kế hoạch" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="actual" name="Thực tế" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie chart: Plan distribution */}
        {piePlan.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Cơ cấu kế hoạch theo xã</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={piePlan}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {piePlan.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmtMoney(value) + ' tr.đ'} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Completion rate by group */}
        {grouped.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tỷ lệ hoàn thành</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {grouped.map((g) => (
                  <div key={g.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-200">{g.label}</span>
                      <PctBadge pct={g.pct} />
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full transition-all ${
                          g.pct >= 100 ? 'bg-emerald-500' : g.pct >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(g.pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>Chi tiết so sánh</CardTitle>
          <CardDescription>So sánh từng dòng KH vs TT theo Xã × Nguồn vốn × Chương trình. Bấm nút tải để xuất danh sách món vay đóng góp.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <th className="px-4 py-3"><span className="inline-flex items-center">Xã<ColumnFilter label="Lọc theo Xã" values={compareGrid.distinctValues.xa} selected={compareGrid.filters.xa} onApply={(s) => compareGrid.setFilter('xa', s)} /></span></th>
                  <th className="px-4 py-3"><span className="inline-flex items-center">Nguồn vốn<ColumnFilter label="Lọc theo Nguồn vốn" values={compareGrid.distinctValues.nguonVon} selected={compareGrid.filters.nguonVon} onApply={(s) => compareGrid.setFilter('nguonVon', s)} /></span></th>
                  <th className="px-4 py-3"><span className="inline-flex items-center">Chương trình<ColumnFilter label="Lọc theo Chương trình" values={compareGrid.distinctValues.chuongTrinh} selected={compareGrid.filters.chuongTrinh} onApply={(s) => compareGrid.setFilter('chuongTrinh', s)} /></span></th>
                  <th className="px-4 py-3 text-right text-blue-600 dark:text-blue-400">KH (tr.đ)</th>
                  <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">TT (tr.đ)</th>
                  <th className="px-4 py-3 text-right">Còn phải thực hiện</th>
                  <th className="px-4 py-3 text-right">Tỷ lệ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {compareGrid.filtered.map((c, idx) => {
                  const bucketKey = `${c.maXa}|${c.maNguonVon}|${c.maChuongTrinh}`;
                  const hasDetails = (loanDetailsByBucket[bucketKey]?.length ?? 0) > 0;
                  const remaining = c.planAmount - c.actualAmount;
                  return (
                    <tr
                      key={`${c.maXa}-${c.maNguonVon}-${c.maChuongTrinh}`}
                      className={`border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/50 ${
                        idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''
                      }`}
                    >
                      <td className="px-4 py-2 text-slate-900 dark:text-white">{c.tenXa}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{nguonVonLabel(c.maNguonVon)}</td>
                      <td className="max-w-[260px] truncate px-4 py-2 text-slate-600 dark:text-slate-300" title={c.tenChuongTrinh}>
                        <span className="mr-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                          {c.maChuongTrinh || '—'}
                        </span>
                        {c.tenChuongTrinh}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">{fmtMoney(Math.round(c.planAmount))}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(Math.round(c.actualAmount))}</td>
                      <td className={`px-4 py-2 text-right font-mono tabular-nums ${remaining > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {fmtMoney(Math.round(remaining))}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {c.planAmount > 0 ? <PctBadge pct={c.pct} /> : <span className="text-xs text-slate-400 dark:text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => exportBucketLoans(c.maXa, c.tenXa, c.maNguonVon, c.maChuongTrinh)}
                          disabled={!hasDetails}
                          title={hasDetails ? 'Xuất danh sách Mã món vay đóng góp vào TT' : 'Không có chi tiết — vui lòng nhập lại Sao kê 31'}
                          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-plan-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-700"
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {compareGrid.filtered.length > 0 && (() => {
                const fPlan = compareGrid.filtered.reduce((s, c) => s + c.planAmount, 0);
                const fActual = compareGrid.filtered.reduce((s, c) => s + c.actualAmount, 0);
                const fPct = fPlan > 0 ? (fActual / fPlan) * 100 : 0;
                const isFiltered = compareGrid.isAnyFiltered;
                return (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800">
                      <td colSpan={3} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                        {isFiltered ? `Tổng (lọc · ${compareGrid.filtered.length}/${comparison.length})` : 'Tổng cộng'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">{fmtMoney(Math.round(fPlan))}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(Math.round(fActual))}</td>
                      <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${fPlan - fActual > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {fmtMoney(Math.round(fPlan - fActual))}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <PctBadge pct={fPct} />
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
