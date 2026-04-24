import { useMemo, useState } from 'react';
import { UserPlus, UserMinus, RotateCcw, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FilterBar } from '@/components/filters/FilterBar';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { usePeriodFilterStore } from '@/store/usePeriodFilterStore';
import { usePeriodCompare } from './usePeriodCompare';
import { fmtCompact, fmtCurrency, fmtDate, fmtNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { JoinedCustomer } from '@/lib/period-compare';

/**
 * Trang 7 — Outreach & khách hàng. Tập trung vào danh sách khách hàng
 * để tổ tín dụng có thể chủ động gọi điện hoặc xuống địa bàn:
 *  - KH mới phát sinh (cần tiếp xúc xác minh)
 *  - KH đã rời danh mục (đối chiếu lý do)
 *  - KH kích hoạt lại sau ≥ 6 tháng
 *  - KH có biến động dư nợ lớn nhất (tăng/giảm) — lưu ý theo dõi
 */

type TabId = 'new' | 'churned' | 'reactivated' | 'movers';

const TABS: { id: TabId; label: string; icon: typeof UserPlus }[] = [
  { id: 'new', label: 'KH mới phát sinh', icon: UserPlus },
  { id: 'churned', label: 'KH đã rời danh mục', icon: UserMinus },
  { id: 'reactivated', label: 'KH kích hoạt lại', icon: RotateCcw },
  { id: 'movers', label: 'KH biến động lớn', icon: Phone },
];

export function PeriodOutreachPage() {
  const { hasData, customerJoin, prevDate, currDate, currRows, kpiDelta } = usePeriodCompare();
  const [tab, setTab] = useState<TabId>('new');

  const lists = useMemo(() => {
    const newOnes: JoinedCustomer[] = [];
    const churned: JoinedCustomer[] = [];
    const reactivated: JoinedCustomer[] = [];
    const retained: JoinedCustomer[] = [];
    for (const j of customerJoin.joined) {
      if (j.bucket === 'new') newOnes.push(j);
      else if (j.bucket === 'churned') churned.push(j);
      else {
        retained.push(j);
        if (j.reactivated) reactivated.push(j);
      }
    }
    // Sắp xếp theo dư nợ giảm dần để KH lớn ở trên đầu
    newOnes.sort((a, b) => (b.curr?.tongDuNo ?? 0) - (a.curr?.tongDuNo ?? 0));
    churned.sort((a, b) => (b.prev?.tongDuNo ?? 0) - (a.prev?.tongDuNo ?? 0));
    reactivated.sort((a, b) => (b.curr?.tongDuNo ?? 0) - (a.curr?.tongDuNo ?? 0));

    // Movers: top 50 KH theo |Δ dư nợ| trong số đã duy trì
    const movers = retained
      .map((j) => ({
        j,
        delta: (j.curr?.tongDuNo ?? 0) - (j.prev?.tongDuNo ?? 0),
      }))
      .filter((x) => Math.abs(x.delta) > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 100);

    return { newOnes, churned, reactivated, movers };
  }, [customerJoin]);

  if (!hasData) return <div className="p-6 text-sm text-slate-500">Chưa có dữ liệu so sánh.</div>;

  // Tổng giá trị mỗi nhóm
  const sumNew = lists.newOnes.reduce((s, j) => s + (j.curr?.tongDuNo ?? 0), 0);
  const sumChurned = lists.churned.reduce((s, j) => s + (j.prev?.tongDuNo ?? 0), 0);
  const sumReact = lists.reactivated.reduce((s, j) => s + (j.curr?.tongDuNo ?? 0), 0);

  return (
    <div className="space-y-5 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Outreach & khách hàng</h1>
            <InfoPopover metricKey="pagePeriodOutreach" />
          </div>
          <ExportMenu
            pageTitle="Outreach & khách hàng — So sánh hai kỳ"
            subtitle={`${fmtDate(prevDate)} → ${fmtDate(currDate)} · ${fmtNumber(currRows.length)} khế ước kỳ sau`}
            rows={currRows}
            kpi={kpiDelta.curr}
            size="sm"
          />
        </div>
        <p className="text-sm text-slate-600">
          Danh sách khách hàng đáng chú ý giữa <strong>{fmtDate(prevDate)}</strong> và{' '}
          <strong>{fmtDate(currDate)}</strong> để phục vụ công tác tiếp cận, đối chiếu và theo
          dõi.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar useStore={usePeriodFilterStore} accent="period" />
        </CardContent>
      </Card>

      {/* Tóm lược KPI */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard
          icon={UserPlus}
          label="KH mới phát sinh"
          count={customerJoin.newCount}
          subtotal={sumNew}
          tone="emerald"
        />
        <SummaryCard
          icon={UserMinus}
          label="KH đã rời danh mục"
          count={customerJoin.churnedCount}
          subtotal={sumChurned}
          tone="slate"
        />
        <SummaryCard
          icon={RotateCcw}
          label="KH kích hoạt lại"
          count={customerJoin.reactivatedCount}
          subtotal={sumReact}
          tone="amber"
        />
      </div>

      {/* Tabs */}
      <div className="inline-flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium transition-colors',
                active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'new' && (
        <CustomerListCard
          title={`${fmtNumber(lists.newOnes.length)} khách hàng mới phát sinh`}
          subtitle={`Tổng dư nợ tiếp nhận: ${fmtCurrency(sumNew)}`}
          rows={lists.newOnes}
          column="curr"
          infoKey="periodOutreachNew"
        />
      )}
      {tab === 'churned' && (
        <CustomerListCard
          title={`${fmtNumber(lists.churned.length)} khách hàng đã rời danh mục`}
          subtitle={`Dư nợ kỳ trước trước khi rời: ${fmtCurrency(sumChurned)}`}
          rows={lists.churned}
          column="prev"
          infoKey="periodOutreachChurned"
        />
      )}
      {tab === 'reactivated' && (
        <CustomerListCard
          title={`${fmtNumber(lists.reactivated.length)} khách hàng kích hoạt lại`}
          subtitle={`Tiêu chí: đã ngừng giao dịch ≥ 6 tháng tính tới ${fmtDate(prevDate)}`}
          rows={lists.reactivated}
          column="curr"
          infoKey="periodOutreachReact"
        />
      )}
      {tab === 'movers' && (
        <MoversListCard
          title={`Top 100 khách hàng có Δ dư nợ lớn nhất`}
          subtitle="Trong số khách hàng duy trì giữa hai kỳ — đáng theo dõi và tiếp cận"
          rows={lists.movers}
          infoKey="periodOutreachMovers"
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  count,
  subtotal,
  tone,
}: {
  icon: typeof UserPlus;
  label: string;
  count: number;
  subtotal: number;
  tone: 'emerald' | 'slate' | 'amber';
}) {
  const palette = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: 'bg-emerald-100 text-emerald-700' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', icon: 'bg-slate-200 text-slate-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: 'bg-amber-100 text-amber-700' },
  }[tone];
  return (
    <Card className={cn(palette.border, palette.bg)}>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={cn('rounded-md p-2', palette.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className={cn('text-[11px] font-semibold uppercase tracking-wide', palette.text)}>
            {label}
          </div>
          <div className={cn('text-2xl font-bold', palette.text)}>{fmtNumber(count)}</div>
          <div className="text-[11px] text-slate-600">{fmtCurrency(subtotal)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerListCard({
  title,
  subtitle,
  rows,
  column,
  infoKey,
}: {
  title: string;
  subtitle: string;
  rows: JoinedCustomer[];
  column: 'prev' | 'curr';
  infoKey?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            <div className="text-[11px] text-slate-500">{subtitle}</div>
          </div>
          {infoKey && <InfoPopover metricKey={infoKey} />}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="scrollbar-thin max-h-[640px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Khách hàng</th>
                <th className="px-3 py-2">PGD · ĐVUT</th>
                <th className="px-3 py-2">Tổ TK&VV</th>
                <th className="px-3 py-2 text-right">Số khế ước</th>
                <th className="px-3 py-2 text-right">Tổng dư nợ</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((j, i) => {
                const slice = j[column];
                if (!slice) return null;
                return (
                  <tr key={j.maKH} className="border-t border-slate-100 hover:bg-period-50">
                    <td className="px-3 py-2 text-[10px] text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{slice.tenKH}</div>
                      <div className="text-[10px] text-slate-500">{slice.maKH}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div>{slice.tenPGD}</div>
                      <div className="text-[10px] text-slate-500">{slice.tenDVUT}</div>
                    </td>
                    <td
                      className="max-w-[160px] truncate px-3 py-2 text-slate-600"
                      title={slice.tenTo}
                    >
                      {slice.tenTo || '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {fmtNumber(slice.soKheUoc)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {fmtCurrency(slice.tongDuNo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 500 && (
            <div className="border-t border-slate-100 px-3 py-2 text-center text-[10px] text-slate-500">
              Hiển thị 500 / {fmtNumber(rows.length)} khách hàng. Dùng bộ lọc để thu hẹp.
            </div>
          )}
          {rows.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              Không có khách hàng nào trong nhóm này.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MoversListCard({
  title,
  subtitle,
  rows,
  infoKey,
}: {
  title: string;
  subtitle: string;
  rows: { j: JoinedCustomer; delta: number }[];
  infoKey?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            <div className="text-[11px] text-slate-500">{subtitle}</div>
          </div>
          {infoKey && <InfoPopover metricKey={infoKey} />}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="scrollbar-thin max-h-[640px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-slate-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Khách hàng</th>
                <th className="px-3 py-2">PGD · ĐVUT</th>
                <th className="px-3 py-2">Tổ TK&VV</th>
                <th className="px-3 py-2 text-right">Dư nợ kỳ trước</th>
                <th className="px-3 py-2 text-right">Dư nợ kỳ sau</th>
                <th className="px-3 py-2 text-right">Δ dư nợ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ j, delta }, i) => {
                const ref = j.curr ?? j.prev!;
                return (
                  <tr key={j.maKH} className="border-t border-slate-100 hover:bg-period-50">
                    <td className="px-3 py-2 text-[10px] text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{ref.tenKH}</div>
                      <div className="text-[10px] text-slate-500">{ref.maKH}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div>{ref.tenPGD}</div>
                      <div className="text-[10px] text-slate-500">{ref.tenDVUT}</div>
                    </td>
                    <td
                      className="max-w-[160px] truncate px-3 py-2 text-slate-600"
                      title={ref.tenTo}
                    >
                      {ref.tenTo || '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {j.prev ? fmtCurrency(j.prev.tongDuNo) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {j.curr ? fmtCurrency(j.curr.tongDuNo) : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-semibold',
                        delta > 0 ? 'text-emerald-700' : 'text-rose-600'
                      )}
                    >
                      {delta > 0 ? '+' : ''}
                      {fmtCompact(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              Không có khách hàng nào có biến động.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
