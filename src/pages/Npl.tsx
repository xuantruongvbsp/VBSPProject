import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Snowflake,
  Coins,
  Users,
  FileWarning,
  Percent,
  AlignLeft,
  LayoutGrid,
  PieChart,
  Download,
} from 'lucide-react';
import { applyFilters, useDataStore, type FilterField } from '@/store/useDataStore';
import { computeKpi, groupBy, type GroupAgg } from '@/lib/metrics';
import { fmtCompact, fmtCurrency, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { exportBadDebtToXlsx } from '@/lib/export-xlsx';
import { cn } from '@/lib/utils';
import { FilterBar } from '@/components/filters/FilterBar';
import { BarByGroup, type BarGroupChartType } from '@/components/charts/BarByGroup';
import { ChartSwitcher, type ChartTypeOption } from '@/components/ui/ChartSwitcher';
import { LoanDetailDrawer } from '@/components/detail/LoanDetailDrawer';
import type { LoanRecord } from '@/lib/types';

const BAR_GROUP_OPTS: ChartTypeOption<BarGroupChartType>[] = [
  { id: 'bar', icon: AlignLeft, tooltip: 'Biểu đồ thanh' },
  { id: 'treemap', icon: LayoutGrid, tooltip: 'Bản đồ cây' },
  { id: 'pie', icon: PieChart, tooltip: 'Biểu đồ tròn' },
];

/**
 * Trang "Báo cáo NPL" — chuyên phân tích dư nợ quá hạn và nợ khoanh.
 * Cùng cấp với Tổng quan trong menu trái. Tất cả thống kê đều dùng
 * bộ lọc hiện hành trên FilterBar.
 */
export function NplPage() {
  const { rows, filters, ranges, search, ngaySoLieu, drillDown } = useDataStore();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<LoanRecord | null>(null);
  const [chartDvutType, setChartDvutType] = useState<BarGroupChartType>('pie');
  const [chartXaType, setChartXaType] = useState<BarGroupChartType>('bar');
  const [chartProgramType, setChartProgramType] = useState<BarGroupChartType>('bar');
  const [exporting, setExporting] = useState(false);

  const drillTo = useCallback(
    (field: FilterField, value: string) => {
      drillDown(field, value);
      navigate('/snapshot/du-lieu');
    },
    [drillDown, navigate]
  );

  const filtered = useMemo(
    () => applyFilters(rows, filters, ranges, search),
    [rows, filters, ranges, search]
  );

  const kpi = useMemo(() => computeKpi(filtered), [filtered]);

  // Chỉ giữ các khế ước có dư nợ quá hạn hoặc khoanh để bảng & biểu đồ
  // chỉ nói về NPL, không pha loãng bởi khế ước trong hạn.
  const nplLoans = useMemo(
    () => filtered.filter((r) => r.duNoQuaHan > 0 || r.duNoKhoanh > 0),
    [filtered]
  );

  // Tổng nợ xấu = QH + Khoanh
  const tongNoXau = kpi.duNoQuaHan + kpi.duNoKhoanh;
  const tyLeNoXau = kpi.tongDuNo > 0 ? (tongNoXau / kpi.tongDuNo) * 100 : 0;

  // Số khế ước / khách hàng có dư nợ quá hạn (không tính khoanh)
  const qhLoansCount = nplLoans.length;
  const qhKhCount = useMemo(() => {
    const s = new Set<string>();
    for (const r of nplLoans) if (r.maKH) s.add(r.maKH);
    return s.size;
  }, [nplLoans]);

  // Tổng lãi tồn quá hạn (sum từ trường laiTonQH của các khế ước NPL)
  const tongLaiTonQH = useMemo(
    () => nplLoans.reduce((s, r) => s + (r.laiTonQH || 0), 0),
    [nplLoans]
  );

  // Khách hàng có nhiều khế ước NPL (≥ 2) — dấu hiệu rủi ro tập trung
  const khMultipleNpl = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of nplLoans) {
      if (!r.maKH) continue;
      counts.set(r.maKH, (counts.get(r.maKH) || 0) + 1);
    }
    let n = 0;
    for (const c of counts.values()) if (c >= 2) n++;
    return n;
  }, [nplLoans]);

  // Gom nhóm theo các chiều phân tích — dùng dữ liệu đã lọc (không chỉ NPL)
  // để tỷ lệ QH hiển thị đúng trên tổng dư nợ của từng nhóm.
  const byXa = useMemo(() => groupBy(filtered, 'tenXa'), [filtered]);
  const byDVUT = useMemo(() => groupBy(filtered, 'tenDVUT'), [filtered]);
  const byProgram = useMemo(() => groupBy(filtered, 'tenChuongTrinh'), [filtered]);

  // Sắp xếp lại theo dư nợ quá hạn giảm dần cho các chart NPL
  const sortByQH = (arr: GroupAgg[]) =>
    [...arr].filter((g) => g.duNoQuaHan > 0).sort((a, b) => b.duNoQuaHan - a.duNoQuaHan);
  const byXa_QH = useMemo(() => sortByQH(byXa), [byXa]);
  const byDVUT_QH = useMemo(() => sortByQH(byDVUT), [byDVUT]);
  const byProgram_QH = useMemo(() => sortByQH(byProgram), [byProgram]);

  // Top 20 khế ước có dư nợ quá hạn lớn nhất
  const topOverdue = useMemo(
    () => [...nplLoans].sort((a, b) => b.duNoQuaHan - a.duNoQuaHan).slice(0, 20),
    [nplLoans]
  );

  // Danh sách đầy đủ các khế ước có dư nợ quá hạn > 0 (để xuất Excel).
  // Khoanh có báo cáo riêng nên ở đây chỉ lấy QH thuần.
  const qhLoansOnly = useMemo(
    () => filtered.filter((r) => r.duNoQuaHan > 0),
    [filtered]
  );

  const handleExportQh = useCallback(async () => {
    if (exporting || qhLoansOnly.length === 0) return;
    setExporting(true);
    try {
      await exportBadDebtToXlsx({
        kind: 'qh',
        loans: qhLoansOnly,
        referenceDate: ngaySoLieu,
        totalFilteredRows: filtered.length,
      });
    } catch (e) {
      console.error('Xuất danh sách NPL thất bại:', e);
    } finally {
      setExporting(false);
    }
  }, [exporting, qhLoansOnly, ngaySoLieu, filtered.length]);

  // Bảng "hotspot" — tỷ lệ QH theo xã, sắp xếp giảm dần (tối thiểu 3 khế ước
  // để tránh tạp nhiễu từ các xã quá nhỏ).
  const hotspots = useMemo(
    () =>
      byXa
        .filter((g) => g.soKheUoc >= 3 && g.tyLeNoQH > 0)
        .sort((a, b) => b.tyLeNoQH - a.tyLeNoQH)
        .slice(0, 15),
    [byXa]
  );

  return (
    <div className="space-y-5 p-6">
      <header className="space-y-3">
        <div>
          <ExportMenu
            pageTitle="Báo cáo NPL — Dư nợ quá hạn & Khoanh"
            subtitle={`${qhLoansCount.toLocaleString('vi-VN')} khế ước NPL / ${filtered.length.toLocaleString('vi-VN')} khế ước`}
            rows={nplLoans}
            kpi={kpi}
            chartSelectors={[
              '#chart-npl-dvut',
              '#chart-npl-xa',
              '#chart-npl-program',
              '#chart-npl-hotspot',
              '#chart-npl-top',
            ]}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Báo cáo NPL — Dư nợ quá hạn & Khoanh
          </h1>
          <InfoPopover metricKey="pageNpl" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Thống kê dư nợ quá hạn và nợ khoanh trên {filtered.length.toLocaleString('vi-VN')} khế
          ước đang áp dụng bộ lọc. Toàn bộ khế ước tất toán đã được loại khỏi nguồn số liệu.
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar />
        </CardContent>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard
          label="Dư nợ quá hạn"
          value={kpi.duNoQuaHan}
          tone="danger"
          icon={<AlertTriangle className="h-4 w-4" />}
          formatter={fmtCompact}
          caption={`Tỷ lệ ${fmtPercent(kpi.tyLeNoQuaHan)}`}
          infoKey="duNoQuaHan"
        />
        <KpiCard
          label="Dư nợ khoanh"
          value={kpi.duNoKhoanh}
          tone="warning"
          icon={<Snowflake className="h-4 w-4" />}
          formatter={fmtCompact}
          caption={
            kpi.tongDuNo > 0
              ? `Tỷ lệ ${fmtPercent((kpi.duNoKhoanh / kpi.tongDuNo) * 100)}`
              : undefined
          }
          infoKey="duNoKhoanh"
        />
        <KpiCard
          label="Tổng nợ xấu (QH + Khoanh)"
          value={tongNoXau}
          tone="danger"
          icon={<FileWarning className="h-4 w-4" />}
          formatter={fmtCompact}
          caption={`Tỷ lệ ${fmtPercent(tyLeNoXau)}`}
          infoKey="tongNoXau"
        />
        <KpiCard
          label="Số khế ước NPL"
          value={qhLoansCount}
          tone="warning"
          icon={<FileWarning className="h-4 w-4" />}
          caption={`${fmtPercent(filtered.length > 0 ? (qhLoansCount / filtered.length) * 100 : 0)} số khế ước`}
        />
        <KpiCard
          label="Khách hàng có nợ xấu"
          value={qhKhCount}
          tone="warning"
          icon={<Users className="h-4 w-4" />}
          caption={
            khMultipleNpl > 0
              ? `${fmtNumber(khMultipleNpl)} KH có ≥ 2 khế ước NPL`
              : 'Duy nhất theo mã KH'
          }
        />
        <KpiCard
          label="Lãi tồn quá hạn"
          value={tongLaiTonQH}
          tone="default"
          icon={<Coins className="h-4 w-4" />}
          formatter={fmtCompact}
          caption="Cộng dồn từ khế ước NPL"
        />
        <KpiCard
          label="Mức NPL bình quân/khế ước"
          value={qhLoansCount > 0 ? (kpi.duNoQuaHan + kpi.duNoKhoanh) / qhLoansCount : 0}
          tone="default"
          icon={<Coins className="h-4 w-4" />}
          formatter={fmtCompact}
          caption="(QH + Khoanh) / số KƯ NPL"
        />
      </div>

      {/* Row 1: Dư nợ quá hạn theo ĐVUT + Xã */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dư nợ quá hạn theo Đơn vị ủy thác</CardTitle>
              <div className="flex items-center gap-1">
                <ChartSwitcher
                  options={BAR_GROUP_OPTS}
                  value={chartDvutType}
                  onChange={setChartDvutType}
                />
                <InfoPopover metricKey="chartNplDvut" />
              </div>
            </div>
          </CardHeader>
          <CardContent id="chart-npl-dvut">
            {byDVUT_QH.length === 0 ? (
              <EmptyNplNote />
            ) : (
              <BarByGroup
                data={byDVUT_QH}
                metric="duNoQuaHan"
                tooltipLabel="Dư nợ quá hạn"
                limit={10}
                chartType={chartDvutType}
                onClick={(v) => drillTo('tenDVUT', v)}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dư nợ quá hạn theo Xã</CardTitle>
              <div className="flex items-center gap-1">
                <ChartSwitcher
                  options={BAR_GROUP_OPTS}
                  value={chartXaType}
                  onChange={setChartXaType}
                />
                <InfoPopover metricKey="chartNplXa" />
              </div>
            </div>
          </CardHeader>
          <CardContent id="chart-npl-xa">
            {byXa_QH.length === 0 ? (
              <EmptyNplNote />
            ) : (
              <BarByGroup
                data={byXa_QH}
                metric="duNoQuaHan"
                tooltipLabel="Dư nợ quá hạn"
                limit={10}
                chartType={chartXaType}
                onClick={(v) => drillTo('tenXa', v)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Dư nợ quá hạn theo Chương trình tín dụng (toàn bộ chiều ngang) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dư nợ quá hạn theo Chương trình tín dụng</CardTitle>
            <div className="flex items-center gap-1">
              <ChartSwitcher
                options={BAR_GROUP_OPTS}
                value={chartProgramType}
                onChange={setChartProgramType}
              />
              <InfoPopover metricKey="chartNplProgram" />
            </div>
          </div>
        </CardHeader>
        <CardContent id="chart-npl-program">
          {byProgram_QH.length === 0 ? (
            <EmptyNplNote />
          ) : (
            <BarByGroup
              data={byProgram_QH}
              metric="duNoQuaHan"
              tooltipLabel="Dư nợ quá hạn"
              limit={10}
              chartType={chartProgramType}
              onClick={(v) => drillTo('tenChuongTrinh', v)}
            />
          )}
        </CardContent>
      </Card>

      {/* Row 3: Hotspot — Tỷ lệ NPL cao nhất theo Xã */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-rose-600" />
              <CardTitle>Điểm nóng NPL — Tỷ lệ nợ quá hạn theo Xã (Top 15)</CardTitle>
            </div>
            <InfoPopover metricKey="chartNplHotspot" />
          </div>
        </CardHeader>
        <CardContent id="chart-npl-hotspot" className="p-0">
          {hotspots.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Không có xã nào có tỷ lệ quá hạn trong phạm vi lọc hiện tại.
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[420px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Xã/Phường</th>
                    <th className="px-3 py-2 text-right">Số khế ước</th>
                    <th className="px-3 py-2 text-right">Dư nợ</th>
                    <th className="px-3 py-2 text-right">Dư nợ QH</th>
                    <th className="px-3 py-2 text-right">Dư nợ khoanh</th>
                    <th className="px-3 py-2 text-right">Tỷ lệ QH</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((g, i) => (
                    <tr
                      key={g.key}
                      onClick={() => drillTo('tenXa', g.key)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-900/20"
                    >
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
                        {g.label || '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {fmtNumber(g.soKheUoc)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {fmtCurrency(g.tongDuNo)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-rose-700 dark:text-rose-300">
                        {fmtCurrency(g.duNoQuaHan)}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-700 dark:text-amber-300">
                        {fmtCurrency(g.duNoKhoanh)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                          {fmtPercent(g.tyLeNoQH)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 4: Top khế ước quá hạn lớn nhất */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle>Top 20 khế ước quá hạn lớn nhất</CardTitle>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                (Excel xuất đầy đủ {fmtNumber(qhLoansOnly.length)} khế ước)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportQh}
                disabled={exporting || qhLoansOnly.length === 0}
                title={
                  qhLoansOnly.length === 0
                    ? 'Không có khế ước quá hạn để xuất'
                    : `Xuất ${qhLoansOnly.length} khế ước quá hạn ra Excel`
                }
                aria-label="Xuất danh sách NPL ra Excel"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  exporting || qhLoansOnly.length === 0
                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    : 'bg-rose-600 text-white hover:bg-rose-700'
                )}
              >
                <Download className={cn('h-3.5 w-3.5', exporting && 'animate-pulse')} />
                {exporting ? 'Đang xuất…' : 'Xuất Excel'}
              </button>
              <InfoPopover metricKey="chartNplTop" />
            </div>
          </div>
        </CardHeader>
        <CardContent id="chart-npl-top" className="p-0">
          {topOverdue.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Không có khế ước quá hạn trong phạm vi lọc.
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[520px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Khách hàng</th>
                    <th className="px-3 py-2">Xã · ĐVUT</th>
                    <th className="px-3 py-2">Tổ TK&VV</th>
                    <th className="px-3 py-2">Chương trình</th>
                    <th className="px-3 py-2 text-right">Ngày chuyển NQH</th>
                    <th className="px-3 py-2 text-right">Mức vay</th>
                    <th className="px-3 py-2 text-right">Dư nợ QH</th>
                    <th className="px-3 py-2 text-right">Dư nợ khoanh</th>
                    <th className="px-3 py-2 text-right">Lãi tồn QH</th>
                  </tr>
                </thead>
                <tbody>
                  {topOverdue.map((r, i) => (
                    <tr
                      key={r.soKheUoc || `${r.maKH}-${i}`}
                      onClick={() => setDetail(r)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-900/20"
                    >
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          {r.tenKH}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {r.soKheUoc}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        <div>{r.tenXa || '—'}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {r.tenDVUT || '—'}
                        </div>
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-slate-600 dark:text-slate-300" title={r.tenTo}>
                        {r.tenTo || '—'}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-slate-600 dark:text-slate-300">
                        {r.tenChuongTrinh}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                        {fmtDate(r.ngayDHGDXA)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {fmtCurrency(r.mucVay)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-rose-700 dark:text-rose-300">
                        {fmtCurrency(r.duNoQuaHan)}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-700 dark:text-amber-300">
                        {fmtCurrency(r.duNoKhoanh)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {fmtCurrency(r.laiTonQH)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <LoanDetailDrawer record={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function EmptyNplNote() {
  return (
    <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
      Không có dư nợ quá hạn trong phạm vi lọc hiện tại.
    </div>
  );
}
