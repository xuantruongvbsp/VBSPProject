import { useState, useCallback, Fragment } from 'react';
import {
  Upload,
  Trash2,
  AlertCircle,
  BanIcon,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  ScanSearch,
  CheckCircle2,
  XCircle,
  Info,
  Columns3,
  Repeat,
  Copy,
  Layers,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { parseActualFile, parseNq11File } from '@/data/credit-plan-parser';
import { nguonVonLabel } from '@/lib/credit-plan-types';

function fmtMoney(n: number) {
  return Math.round(n / 1_000_000).toLocaleString('vi-VN');
}

function fmtMoneyFull(n: number) {
  return n.toLocaleString('vi-VN');
}

/** Stat cell for the diagnostic panel. */
function DiagStat({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof FileSpreadsheet;
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    default: 'text-slate-900 dark:text-white',
    success: 'text-emerald-700 dark:text-emerald-300',
    warning: 'text-amber-700 dark:text-amber-300',
    danger: 'text-rose-600 dark:text-rose-300',
  }[tone];
  const iconTone = {
    default: 'text-slate-400',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-rose-500',
  }[tone];
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</div>
        <div className={`truncate font-mono text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
      </div>
    </div>
  );
}

export function ActualImport() {
  const {
    actuals,
    actualDate,
    actualTotalRows,
    actualDiag,
    setActuals,
    clearActuals,
    nq11Summaries,
    nq11MonVayIds,
    nq11Date,
    nq11TotalRows,
    setNq11,
    clearNq11,
    getMergedActuals,
    decisions,
  } = useCreditPlanStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [nq11Loading, setNq11Loading] = useState(false);
  const [nq11Error, setNq11Error] = useState<string | null>(null);
  const [nq11DragOver, setNq11DragOver] = useState(false);
  const [nq11Expanded, setNq11Expanded] = useState<Record<string, boolean>>({});

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setError('Chỉ hỗ trợ file Excel (.xlsx, .xls)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const idSet = nq11MonVayIds.length > 0 ? new Set(nq11MonVayIds) : undefined;
      // Whitelist Mã NĐT từ các QĐ NV=3 còn hiệu lực (không tính archived).
      const ndtSet = new Set(
        decisions
          .filter((d) => d.trangThai !== 'archived' && d.maNguonVonList.includes('3') && d.maNhaDauTu)
          .map((d) => d.maNhaDauTu as string)
      );
      const result = await parseActualFile(file, idSet, ndtSet.size > 0 ? ndtSet : undefined);
      setActuals(
        result.summaries,
        result.ngaySoLieu,
        result.totalRows,
        result.nq11MatchByXa,
        {
          scannedRows: result.scannedRows,
          skippedRows: result.skippedRows,
          detectedIdCols: result.detectedIdCols,
          duplicateLoanIds: result.duplicateLoanIds,
          hasInvestorCol: result.hasInvestorCol,
          gqvlXaReclassified: result.gqvlXaReclassified,
        },
        result.loanDetailsByBucket,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi đọc file');
    } finally {
      setLoading(false);
    }
  }, [setActuals, nq11MonVayIds, decisions]);

  const handleNq11File = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setNq11Error('Chỉ hỗ trợ file Excel (.xlsx, .xls)');
      return;
    }
    setNq11Loading(true);
    setNq11Error(null);
    try {
      const result = await parseNq11File(file);
      setNq11(result.summariesByXa, result.monVayIds, result.ngaySoLieu, result.totalRows);
    } catch (e) {
      setNq11Error(e instanceof Error ? e.message : 'Lỗi đọc file');
    } finally {
      setNq11Loading(false);
    }
  }, [setNq11]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  const onNq11Drop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setNq11DragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleNq11File(file);
    },
    [handleNq11File]
  );

  const onNq11FileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleNq11File(file);
      e.target.value = '';
    },
    [handleNq11File]
  );

  // Actuals đã merge NQ11 để hiển thị bảng chi tiết
  const mergedActuals = getMergedActuals();

  // Aggregate by xa for summary (dùng merged actuals để tổng khớp với báo cáo)
  const byXa = new Map<string, { tenXa: string; tongDuNo: number; soMon: number }>();
  for (const a of mergedActuals) {
    const existing = byXa.get(a.maXa);
    if (existing) {
      existing.tongDuNo += a.tongDuNo;
      existing.soMon += a.soMonVay;
    } else {
      byXa.set(a.maXa, { tenXa: a.tenXa, tongDuNo: a.tongDuNo, soMon: a.soMonVay });
    }
  }

  const totalDuNo = mergedActuals.reduce((s, a) => s + a.tongDuNo, 0);
  const totalMon = mergedActuals.reduce((s, a) => s + a.soMonVay, 0);
  const nq11TotalDuNo = nq11Summaries.reduce((s, a) => s + a.tongDuNo, 0);
  const nq11TotalMon = nq11Summaries.reduce((s, a) => s + a.soMonVay, 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Dữ liệu thực tế</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Nhập file Báo cáo 31 (sao kê chi tiết) để lấy dữ liệu dư nợ thực tế
          </p>
        </div>
        {actuals.length > 0 && (
          <Button variant="outline" onClick={clearActuals}>
            <Trash2 className="h-4 w-4" /> Xóa dữ liệu
          </Button>
        )}
      </div>

      {/* Dropzone — Báo cáo 31 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-plan-700 dark:text-plan-300" />
            Báo cáo 31 — Sao kê chi tiết
          </CardTitle>
          <CardDescription>
            File Excel Báo cáo 31 dạng sao kê chi tiết theo ngày (VD: 260331.Actual.XLSX).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-all ${
              dragOver
                ? 'border-plan-500 bg-plan-50 dark:border-plan-400 dark:bg-plan-900/30'
                : 'border-slate-300 bg-slate-50/50 hover:border-plan-300 hover:bg-plan-50/40 dark:border-slate-600 dark:bg-slate-800/40 dark:hover:border-plan-700 dark:hover:bg-plan-900/10'
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-plan-600 border-t-transparent" />
                <span className="text-sm font-medium">Đang đọc file...</span>
              </div>
            ) : (
              <>
                <div className={`mb-3 rounded-full p-3 transition-colors ${
                  dragOver ? 'bg-plan-100 text-plan-700 dark:bg-plan-900/60 dark:text-plan-200' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}>
                  <Upload className="h-7 w-7" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Kéo thả file Excel vào đây
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">hoặc</p>
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-plan-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-plan-800">
                  <Upload className="h-3.5 w-3.5" />
                  Chọn file
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileSelect} />
                </label>
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                  Hỗ trợ .xlsx, .xls · xử lý ngay trong trình duyệt, không gửi lên máy chủ
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{error}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NQ11 — Sao kê món vay GQVL không được cho vay quay vòng */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BanIcon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              Cho vay GQVL — NQ11 (không được cho vay quay vòng)
            </CardTitle>
            <CardDescription className="mt-1">
              File SK_GQVL_*.xlsx — danh sách món vay bị đánh dấu NQ11. Match bằng "Mã món vay".
              Số liệu sẽ được tách ra khỏi 03A / 03B trong báo cáo.
            </CardDescription>
          </div>
          {nq11Summaries.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearNq11}>
              <Trash2 className="h-4 w-4" /> Xóa NQ11
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setNq11DragOver(true); }}
            onDragLeave={() => setNq11DragOver(false)}
            onDrop={onNq11Drop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              nq11DragOver
                ? 'border-rose-500 bg-rose-50 dark:border-rose-400 dark:bg-rose-900/30'
                : 'border-slate-300 bg-slate-50/50 hover:border-rose-300 hover:bg-rose-50/40 dark:border-slate-600 dark:bg-slate-800/40 dark:hover:border-rose-800 dark:hover:bg-rose-900/10'
            }`}
          >
            {nq11Loading ? (
              <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
                <span className="text-sm font-medium">Đang đọc file NQ11...</span>
              </div>
            ) : (
              <>
                <div className={`mb-2 rounded-full p-2.5 transition-colors ${
                  nq11DragOver ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}>
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Kéo thả file SK_GQVL vào đây
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">hoặc</p>
                <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700">
                  <Upload className="h-3.5 w-3.5" />
                  Chọn file NQ11
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onNq11FileSelect} />
                </label>
              </>
            )}
          </div>

          {nq11Error && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{nq11Error}</div>
            </div>
          )}

          {nq11Summaries.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-rose-200 bg-rose-50/60 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-900/20">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">Tổng dư nợ NQ11</div>
                <div className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">{fmtMoney(nq11TotalDuNo)}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">triệu đồng</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Số món vay</div>
                <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  {nq11TotalMon.toLocaleString('vi-VN')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{nq11MonVayIds.length.toLocaleString('vi-VN')} Mã món vay</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Số xã</div>
                <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  {nq11Summaries.length}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ngày số liệu</div>
                <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{nq11Date ?? '—'}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{nq11TotalRows.toLocaleString('vi-VN')} dòng</div>
              </div>
            </div>
          )}

          {nq11Summaries.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="px-3 py-2">Xã</th>
                    <th className="px-3 py-2 text-right">Món</th>
                    <th className="px-3 py-2 text-right">Tổng dư nợ</th>
                    <th className="px-3 py-2 text-right">Từ 03A</th>
                    <th className="px-3 py-2 text-right">Từ 03B</th>
                  </tr>
                </thead>
                <tbody>
                  {nq11Summaries.map((s, idx) => {
                    const open = !!nq11Expanded[s.maXa];
                    return (
                      <Fragment key={s.maXa}>
                        <tr className={`border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/50 ${
                          idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''
                        }`}>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setNq11Expanded((prev) => ({ ...prev, [s.maXa]: !prev[s.maXa] }))
                              }
                              className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                              aria-label={open ? 'Ẩn Mã món vay' : 'Xem Mã món vay'}
                            >
                              {open ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-slate-900 dark:text-white">
                            {s.tenXa} <span className="text-xs text-slate-400">({s.maXa})</span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                            {s.soMonVay.toLocaleString('vi-VN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                            {fmtMoneyFull(s.tongDuNo)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {s.from03A_tongDuNo > 0 ? fmtMoneyFull(s.from03A_tongDuNo) : '—'}
                            {s.from03A_soMonVay > 0 && (
                              <span className="ml-1 text-[11px] text-slate-400">
                                ({s.from03A_soMonVay})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {s.from03B_tongDuNo > 0 ? fmtMoneyFull(s.from03B_tongDuNo) : '—'}
                            {s.from03B_soMonVay > 0 && (
                              <span className="ml-1 text-[11px] text-slate-400">
                                ({s.from03B_soMonVay})
                              </span>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b border-slate-100 dark:border-slate-700/60">
                            <td></td>
                            <td colSpan={5} className="bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Danh sách Mã món vay ({(s.monVayIds ?? []).length})
                              </div>
                              {(s.monVayIds ?? []).length === 0 ? (
                                <div className="mt-1 text-[11px] italic text-slate-400 dark:text-slate-500">
                                  Dữ liệu NQ11 đã lưu trước đây không chứa Mã món vay. Vui lòng bấm "Xóa NQ11" và tải lại file SK_GQVL.
                                </div>
                              ) : (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {(s.monVayIds ?? []).map((id) => (
                                    <code
                                      key={id}
                                      className="rounded bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700"
                                    >
                                      {id}
                                    </code>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      {actuals.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="py-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tổng dư nợ</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-plan-700 dark:text-plan-300">
                  {fmtMoney(totalDuNo)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">triệu đồng</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tổng món vay</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {totalMon.toLocaleString('vi-VN')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">khế ước</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Số nhóm</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{actuals.length}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">xã × nguồn vốn × chương trình</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ngày số liệu</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {actualDate ?? '—'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{actualTotalRows.toLocaleString('vi-VN')} dòng gốc</div>
              </CardContent>
            </Card>
          </div>

          {/* Diagnostic panel — stat grid */}
          {actualDiag && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ScanSearch className="h-4 w-4 text-slate-500" />
                  Chẩn đoán import
                </CardTitle>
                <CardDescription>
                  Dùng để xác nhận bộ lọc dòng cộng/tổng đang hoạt động đúng.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <DiagStat
                    icon={FileSpreadsheet}
                    label="Tổng dòng quét"
                    value={(actualDiag.scannedRows ?? 0).toLocaleString('vi-VN')}
                  />
                  <DiagStat
                    icon={CheckCircle2}
                    label="Dòng chi tiết (tính)"
                    value={actualTotalRows.toLocaleString('vi-VN')}
                    tone="success"
                  />
                  <DiagStat
                    icon={XCircle}
                    label="Dòng cộng/tổng (bỏ)"
                    value={(actualDiag.skippedRows ?? 0).toLocaleString('vi-VN')}
                    tone={(actualDiag.skippedRows ?? 0) > 0 ? 'danger' : 'default'}
                  />
                  <DiagStat
                    icon={Copy}
                    label="Dòng trùng (đã loại)"
                    value={(actualDiag.duplicateLoanIds ?? 0).toLocaleString('vi-VN')}
                    tone={(actualDiag.duplicateLoanIds ?? 0) > 0 ? 'warning' : 'default'}
                  />
                  <div className="md:col-span-2">
                    <DiagStat
                      icon={Columns3}
                      label="Cột nhận dạng"
                      value={(actualDiag.detectedIdCols ?? []).join(', ') || '—'}
                    />
                  </div>
                  <DiagStat
                    icon={Layers}
                    label={'Cột "Mã nhà đầu tư"'}
                    value={actualDiag.hasInvestorCol ? 'Phát hiện' : 'Không có'}
                    tone={actualDiag.hasInvestorCol ? 'success' : 'danger'}
                  />
                  <DiagStat
                    icon={Repeat}
                    label="Dòng GQVL xã (đổi NV 2→3)"
                    value={(actualDiag.gqvlXaReclassified ?? 0).toLocaleString('vi-VN')}
                    tone={(actualDiag.gqvlXaReclassified ?? 0) > 0 ? 'success' : 'default'}
                  />
                </div>

                {/* Inline messages */}
                <div className="space-y-2">
                  {(actualDiag.duplicateLoanIds ?? 0) > 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        {(actualDiag.duplicateLoanIds ?? 0).toLocaleString('vi-VN')} dòng trùng Số khế ước/Mã món vay đã được loại bỏ. Mỗi khoản vay được tính 1 lần.
                      </div>
                    </div>
                  )}
                  {(actualDiag.detectedIdCols ?? []).length === 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        Không phát hiện cột nhận dạng dòng chi tiết (Số khế ước / Mã món vay / Mã KH / Tên KH). Mọi dòng có Mã xã đều được tính — có khả năng cộng cả dòng cộng/tổng. Vui lòng gửi tên cột chính xác để điều chỉnh bộ lọc.
                      </div>
                    </div>
                  )}
                  {!actualDiag.hasInvestorCol && (
                    <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        Không tìm thấy cột "Mã nhà đầu tư" — các dòng GQVL không thể tách thành "Cho vay GQVL xã ..." theo Mã NĐT. Vui lòng gửi tên cột chính xác trong tiêu đề để bổ sung alias.
                      </div>
                    </div>
                  )}
                  {actualDiag.hasInvestorCol && (actualDiag.gqvlXaReclassified ?? 0) === 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        Cột "Mã nhà đầu tư" có nhưng không có dòng CT=03 nào được đổi sang NV=3 ("GQVL xã"). Kiểm tra ở màn "Quyết định" đã có QĐ NV=Địa phương xã với Mã NĐT khớp với các dòng CT=03 trong Báo cáo 31 hay chưa.
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary by Xa */}
          <Card>
            <CardHeader>
              <CardTitle>Tổng hợp theo xã</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <th className="px-4 py-3">Mã xã</th>
                      <th className="px-4 py-3">Tên xã</th>
                      <th className="px-4 py-3 text-right">Số món vay</th>
                      <th className="px-4 py-3 text-right">Tổng dư nợ (tr.đ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(byXa.entries()).map(([maXa, data], idx) => (
                      <tr
                        key={maXa}
                        className={`border-b border-slate-100 last:border-b-0 dark:border-slate-700/60 ${
                          idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">{maXa}</td>
                        <td className="px-4 py-2.5 text-slate-900 dark:text-white">{data.tenXa}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">{data.soMon.toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">{fmtMoney(data.tongDuNo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Detail table */}
          <Card>
            <CardHeader>
              <CardTitle>Chi tiết theo nhóm</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <th className="px-4 py-3">Xã</th>
                      <th className="px-4 py-3">Nguồn vốn</th>
                      <th className="px-4 py-3">Chương trình</th>
                      <th className="px-4 py-3 text-right">Món vay</th>
                      <th className="px-4 py-3 text-right">Dư nợ TH</th>
                      <th className="px-4 py-3 text-right">Dư nợ QH</th>
                      <th className="px-4 py-3 text-right">Dư nợ khoanh</th>
                      <th className="px-4 py-3 text-right">Tổng dư nợ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedActuals.map((a, idx) => (
                      <tr
                        key={`${a.maXa}-${a.maNguonVon}-${a.maChuongTrinh}`}
                        className={`border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-800/50 ${
                          idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/20' : ''
                        }`}
                      >
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{a.tenXa}</td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{nguonVonLabel(a.maNguonVon)}</td>
                        <td className="max-w-[260px] truncate px-4 py-2 text-slate-600 dark:text-slate-300" title={a.tenChuongTrinh}>{a.tenChuongTrinh}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">{a.soMonVay.toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">{fmtMoneyFull(a.duNoTrongHan)}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">{a.duNoQuaHan > 0 ? fmtMoneyFull(a.duNoQuaHan) : '—'}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">{a.duNoKhoanh > 0 ? fmtMoneyFull(a.duNoKhoanh) : '—'}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">{fmtMoneyFull(a.tongDuNo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
