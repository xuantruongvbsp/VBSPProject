import { useMemo, useState } from 'react';
import { ArrowRight, GitCompare, Radar as RadarIcon, BarChart3, AlignLeft, Minus } from 'lucide-react';
import { applyFilters, useDataStore, FIELD_LABEL, type FilterField } from '@/store/useDataStore';
import { computeKpi, distinctValues } from '@/lib/metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { ExportMenu } from '@/components/export/ExportMenu';
import { FilterBar } from '@/components/filters/FilterBar';
import { fmtCompact, fmtCurrency, fmtNumber, fmtPercent } from '@/lib/format';
import type { LoanRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChartSwitcher, type ChartTypeOption } from '@/components/ui/ChartSwitcher';
import { RadarCompare, type RadarChartType } from '@/components/charts/RadarCompare';
import { RankingBars, type RankingChartType } from '@/components/charts/RankingBars';

const RADAR_OPTS: ChartTypeOption<RadarChartType>[] = [
  { id: 'radar', icon: RadarIcon, tooltip: 'Biểu đồ radar' },
  { id: 'groupedBar', icon: BarChart3, tooltip: 'Biểu đồ cột nhóm' },
];
const RANKING_OPTS: ChartTypeOption<RankingChartType>[] = [
  { id: 'bar', icon: AlignLeft, tooltip: 'Thanh ngang' },
  { id: 'lollipop', icon: Minus, tooltip: 'Biểu đồ kẹo mút' },
];

const DIM_FIELDS: FilterField[] = [
  'tenPGD',
  'tenXa',
  'tenDVUT',
  'tenChuongTrinh',
  'tenTo',
  'phanLoai',
  'tinhTrangMonVay',
  'gioiTinh',
  'nguonVon',
];

const palette = ['#1d4ed8', '#0891b2', '#16a34a', '#ea580c', '#a21caf', '#dc2626'];

interface KpiRow {
  key: string;
  label: string;
  fmt: (v: number) => string;
  pick: (kpi: ReturnType<typeof computeKpi>) => number;
  invert?: boolean; // higher = worse (e.g. NQH)
}

const KPI_ROWS: KpiRow[] = [
  { key: 'tongDuNo', label: 'Tổng dư nợ', fmt: fmtCurrency, pick: (k) => k.tongDuNo },
  { key: 'soKheUoc', label: 'Số khế ước', fmt: fmtNumber, pick: (k) => k.soKheUoc },
  { key: 'soKhachHang', label: 'Số khách hàng', fmt: fmtNumber, pick: (k) => k.soKhachHang },
  { key: 'mucVayBQ', label: 'Mức vay bình quân', fmt: fmtCurrency, pick: (k) => k.mucVayBQ },
  {
    key: 'tyLeNoQuaHan',
    label: 'Tỷ lệ nợ quá hạn',
    fmt: (v) => fmtPercent(v),
    pick: (k) => k.tyLeNoQuaHan,
    invert: true,
  },
  { key: 'duNoQuaHan', label: 'Dư nợ quá hạn', fmt: fmtCurrency, pick: (k) => k.duNoQuaHan, invert: true },
  { key: 'laiTonTH', label: 'Lãi tồn (TH)', fmt: fmtCurrency, pick: (k) => k.laiTonTH, invert: true },
  { key: 'thuLaiTHThang', label: 'Thu lãi tháng', fmt: fmtCurrency, pick: (k) => k.thuLaiTHThang },
  { key: 'laiSuatBQ', label: 'Lãi suất bình quân', fmt: (v) => fmtPercent(v, 3), pick: (k) => k.laiSuatBQ },
];

export function ComparePage() {
  const { rows, filters, ranges, search } = useDataStore();
  const [mode, setMode] = useState<'between' | 'within'>('between');
  const [dimension, setDimension] = useState<FilterField>('tenPGD');
  const [parent, setParent] = useState<{ field: FilterField; value: string } | null>(null);
  const [subDimension, setSubDimension] = useState<FilterField>('tenDVUT');
  const [picked, setPicked] = useState<string[]>([]);
  const [radarType, setRadarType] = useState<RadarChartType>('radar');
  const [rankingType, setRankingType] = useState<RankingChartType>('bar');

  const baseFiltered = useMemo(
    () => applyFilters(rows, filters, ranges, search),
    [rows, filters, ranges, search]
  );

  const baseKpi = useMemo(() => computeKpi(baseFiltered), [baseFiltered]);

  // For "within" mode, narrow base to a parent value first.
  const scoped = useMemo(() => {
    if (mode === 'within' && parent) {
      return baseFiltered.filter((r) => String(r[parent.field] ?? '') === parent.value);
    }
    return baseFiltered;
  }, [mode, parent, baseFiltered]);

  const dimToUse: FilterField = mode === 'within' ? subDimension : dimension;

  const options = useMemo(() => distinctValues(scoped, dimToUse), [scoped, dimToUse]);

  const groups = useMemo(() => {
    return picked.map((value) => {
      const subset = scoped.filter((r) => String(r[dimToUse] ?? '') === value);
      return {
        label: value,
        rows: subset,
        kpi: computeKpi(subset),
      };
    });
  }, [picked, scoped, dimToUse]);

  // Radar data: normalize each KPI 0..1 across selected groups
  const radarData = useMemo(() => {
    if (groups.length < 2) return [];
    return KPI_ROWS.filter((k) => !['mucVayBQ', 'laiSuatBQ'].includes(k.key)).map((k) => {
      const values = groups.map((g) => k.pick(g.kpi));
      const max = Math.max(...values, 1);
      const item: Record<string, number | string> = { metric: k.label };
      groups.forEach((g) => {
        item[g.label] = max ? (k.pick(g.kpi) / max) * 100 : 0;
      });
      return item;
    });
  }, [groups]);

  // Helper for delta vs first selected (baseline)
  function deltaVsFirst(rowIdx: number, kpi: KpiRow) {
    if (!groups[0] || rowIdx === 0) return null;
    const a = kpi.pick(groups[0].kpi);
    const b = kpi.pick(groups[rowIdx].kpi);
    if (!a) return null;
    return ((b - a) / a) * 100;
  }

  return (
    <div className="space-y-5 p-6">
      <header className="space-y-3">
        <div>
          <ExportMenu
            pageTitle="Báo cáo so sánh"
            subtitle={`${baseFiltered.length.toLocaleString('vi-VN')} khế ước`}
            rows={baseFiltered}
            kpi={baseKpi}
            chartSelectors={[
              '#compare-delta-table',
              '#compare-radar',
              '#compare-program-structure',
              '#compare-ranking',
            ]}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Báo cáo so sánh</h1>
          <InfoPopover metricKey="pageCompare" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          So sánh giữa các đối tượng (PGD, Đơn vị ủy thác, Chương trình…) hoặc bên trong một đối
          tượng đã chọn
        </p>
      </header>

      <Card>
        <CardContent className="py-3">
          <FilterBar />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs">
              <button
                onClick={() => {
                  setMode('between');
                  setPicked([]);
                }}
                className={cn(
                  'rounded px-3 py-1.5 font-medium',
                  mode === 'between' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-300'
                )}
              >
                Giữa các đối tượng
              </button>
              <button
                onClick={() => {
                  setMode('within');
                  setPicked([]);
                }}
                className={cn(
                  'rounded px-3 py-1.5 font-medium',
                  mode === 'within' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-300'
                )}
              >
                Trong cùng đối tượng
              </button>
            </div>

            {mode === 'between' ? (
              <>
                <span className="text-xs text-slate-500 dark:text-slate-400">Tiêu chí so sánh:</span>
                <select
                  value={dimension}
                  onChange={(e) => {
                    setDimension(e.target.value as FilterField);
                    setPicked([]);
                  }}
                  className="h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-700 dark:text-slate-200"
                >
                  {DIM_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABEL[f]}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-500 dark:text-slate-400">Đối tượng cha:</span>
                <select
                  value={parent?.field ?? 'tenPGD'}
                  onChange={(e) => setParent({ field: e.target.value as FilterField, value: '' })}
                  className="h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs dark:text-slate-200"
                >
                  {DIM_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABEL[f]}
                    </option>
                  ))}
                </select>
                <select
                  value={parent?.value ?? ''}
                  onChange={(e) =>
                    setParent({
                      field: parent?.field ?? 'tenPGD',
                      value: e.target.value,
                    })
                  }
                  className="h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs dark:text-slate-200"
                >
                  <option value="">— Chọn —</option>
                  {distinctValues(baseFiltered, parent?.field ?? 'tenPGD').map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <ArrowRight className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                <span className="text-xs text-slate-500 dark:text-slate-400">So sánh theo:</span>
                <select
                  value={subDimension}
                  onChange={(e) => {
                    setSubDimension(e.target.value as FilterField);
                    setPicked([]);
                  }}
                  className="h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs dark:text-slate-200"
                >
                  {DIM_FIELDS.filter((f) => f !== parent?.field).map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABEL[f]}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Chọn đối tượng để so sánh (tối đa 6)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => {
                const active = picked.includes(o);
                return (
                  <button
                    key={o}
                    onClick={() => {
                      if (active) setPicked(picked.filter((p) => p !== o));
                      else if (picked.length < 6) setPicked([...picked, o]);
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-brand-700 bg-brand-700 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    )}
                  >
                    {o}
                  </button>
                );
              })}
              {options.length === 0 && (
                <span className="text-xs text-slate-400 dark:text-slate-500">Không có giá trị</span>
              )}
            </div>
            {picked.length > 0 && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPicked([])}>
                Bỏ chọn tất cả
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-slate-500 dark:text-slate-400">
            <div className="rounded-full bg-brand-100 p-4 text-brand-700">
              <GitCompare className="h-8 w-8" />
            </div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Vui lòng chọn ít nhất 2 đối tượng để bắt đầu so sánh
            </div>
            <div className="text-xs">
              Hệ thống sẽ tổng hợp các chỉ tiêu, trình bày bảng đối chiếu và biểu đồ radar.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI deltas grid */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Bảng đối chiếu chỉ tiêu</CardTitle>
                <InfoPopover metricKey="compareDeltaTable" />
              </div>
            </CardHeader>
            <CardContent id="compare-delta-table" className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300">Chỉ tiêu</th>
                      {groups.map((g, i) => (
                        <th key={g.label} className="px-4 py-2 text-right font-semibold">
                          <div className="flex items-center justify-end gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: palette[i % palette.length] }}
                            />
                            <span className="truncate text-slate-800 dark:text-slate-100">{g.label}</span>
                            {i === 0 && (
                              <span className="rounded bg-slate-200 dark:bg-slate-700 px-1 text-[9px] uppercase text-slate-600 dark:text-slate-300">
                                gốc
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {KPI_ROWS.map((kpi) => (
                      <tr key={kpi.key} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200">{kpi.label}</td>
                        {groups.map((g, i) => {
                          const v = kpi.pick(g.kpi);
                          const d = deltaVsFirst(i, kpi);
                          const positive = d !== null && d > 0;
                          // For inverted KPIs (NQH, lãi tồn), positive = worse
                          const good = d !== null && (kpi.invert ? d < 0 : d > 0);
                          return (
                            <td key={i} className="px-4 py-2 text-right">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{kpi.fmt(v)}</div>
                              {d !== null && (
                                <div
                                  className={cn(
                                    'text-[10px] font-medium',
                                    good ? 'text-emerald-600' : 'text-rose-600'
                                  )}
                                >
                                  {positive ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Radar */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Biểu đồ radar (chỉ số chuẩn hóa)</CardTitle>
                  <div className="flex items-center gap-1">
                    <ChartSwitcher options={RADAR_OPTS} value={radarType} onChange={setRadarType} />
                    <InfoPopover metricKey="compareRadar" />
                  </div>
                </div>
              </CardHeader>
              <CardContent id="compare-radar">
                <RadarCompare data={radarData} groups={groups} chartType={radarType} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Cơ cấu Chương trình tín dụng</CardTitle>
                  <InfoPopover metricKey="compareProgramStructure" />
                </div>
              </CardHeader>
              <CardContent id="compare-program-structure" className="p-0">
                <div className="scrollbar-thin max-h-[360px] overflow-y-auto">
                  <ProgramBreakdown groups={groups} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mini ranking bars */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Xếp hạng theo từng chỉ tiêu</CardTitle>
                <div className="flex items-center gap-1">
                  <ChartSwitcher options={RANKING_OPTS} value={rankingType} onChange={setRankingType} />
                  <InfoPopover metricKey="compareRanking" />
                </div>
              </div>
            </CardHeader>
            <CardContent id="compare-ranking">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {KPI_ROWS.slice(0, 6).map((kpi) => {
                  const sorted = [...groups]
                    .map((g, i) => ({
                      label: g.label,
                      v: kpi.pick(g.kpi),
                      idx: i,
                    }))
                    .sort((a, b) => (kpi.invert ? a.v - b.v : b.v - a.v));
                  return (
                    <RankingBars
                      key={kpi.key}
                      kpiLabel={kpi.label}
                      items={sorted}
                      fmt={kpi.fmt}
                      chartType={rankingType}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ProgramBreakdown({
  groups,
}: {
  groups: { label: string; rows: LoanRecord[]; kpi: ReturnType<typeof computeKpi> }[];
}) {
  // collect all programs across groups
  const allPrograms = new Set<string>();
  groups.forEach((g) => g.rows.forEach((r) => r.tenChuongTrinh && allPrograms.add(r.tenChuongTrinh)));
  const programs = Array.from(allPrograms).sort();

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
        <tr className="text-left text-slate-500 dark:text-slate-400">
          <th className="px-3 py-2">Chương trình</th>
          {groups.map((g, i) => (
            <th key={g.label} className="px-3 py-2 text-right">
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                style={{ background: palette[i % palette.length] }}
              />
              {g.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {programs.map((p) => (
          <tr key={p} className="border-t border-slate-100 dark:border-slate-700">
            <td className="max-w-[220px] truncate px-3 py-1.5 text-slate-700 dark:text-slate-200">{p}</td>
            {groups.map((g, i) => {
              const sum = g.rows
                .filter((r) => r.tenChuongTrinh === p)
                .reduce((s, r) => s + r.tongDuNo, 0);
              return (
                <td key={i} className="px-3 py-1.5 text-right text-slate-800 dark:text-slate-100">
                  {sum > 0 ? fmtCompact(sum) : '—'}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
