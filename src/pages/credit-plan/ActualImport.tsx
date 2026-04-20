import { useState, useCallback, Fragment } from 'react';
import { Upload, Trash2, AlertCircle, BanIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
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
      const result = await parseActualFile(file, idSet);
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
        },
        result.loanDetailsByBucket,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi đọc file');
    } finally {
      setLoading(false);
    }
  }, [setActuals, nq11MonVayIds]);

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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dữ liệu thực tế</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nhập file Báo cáo 31 (sao kê chi tiết) để lấy dữ liệu dư nợ thực tế
          </p>
        </div>
        {actuals.length > 0 && (
          <Button variant="outline" onClick={clearActuals}>
            <Trash2 className="h-4 w-4" /> Xóa dữ liệu
          </Button>
        )}
      </div>

      {/* Dropzone */}
      <Card>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
              dragOver
                ? 'border-plan-400 bg-plan-50 dark:bg-plan-900/20'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-3 text-slate-500">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-plan-600 border-t-transparent" />
                Đang đọc file...
              </div>
            ) : (
              <>
                <Upload className="mb-3 h-10 w-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Kéo thả file Excel vào đây
                </p>
                <p className="mt-1 text-xs text-slate-500">hoặc</p>
                <label className="mt-2 cursor-pointer rounded-md bg-plan-700 px-4 py-2 text-sm font-medium text-white hover:bg-plan-800">
                  Chọn file
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileSelect} />
                </label>
                <p className="mt-3 text-xs text-slate-400">
                  File Excel Báo cáo 31 — dạng sao kê chi tiết theo ngày (260331.Actual.XLSX)
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* NQ11 — Sao kê món vay GQVL không được cho vay quay vòng */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BanIcon className="h-4 w-4 text-rose-600" />
              Cho vay GQVL — NQ11 (không được cho vay quay vòng)
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              File SK_GQVL_*.xlsx — danh sách món vay bị đánh dấu NQ11. Match bằng "Mã món vay".
              Số liệu sẽ được tách ra khỏi 03A / 03B trong báo cáo.
            </p>
          </div>
          {nq11Summaries.length > 0 && (
            <Button variant="outline" onClick={clearNq11}>
              <Trash2 className="h-4 w-4" /> Xóa NQ11
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setNq11DragOver(true); }}
            onDragLeave={() => setNq11DragOver(false)}
            onDrop={onNq11Drop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
              nq11DragOver
                ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {nq11Loading ? (
              <div className="flex items-center gap-3 text-slate-500">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />
                Đang đọc file NQ11...
              </div>
            ) : (
              <>
                <Upload className="mb-2 h-8 w-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Kéo thả file SK_GQVL vào đây
                </p>
                <p className="mt-1 text-xs text-slate-500">hoặc</p>
                <label className="mt-2 cursor-pointer rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                  Chọn file NQ11
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onNq11FileSelect} />
                </label>
              </>
            )}
          </div>

          {nq11Error && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
              <AlertCircle className="h-4 w-4" /> {nq11Error}
            </div>
          )}

          {nq11Summaries.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Tổng dư nợ NQ11</div>
                <div className="text-lg font-bold text-rose-600">{fmtMoney(nq11TotalDuNo)}</div>
                <div className="text-[11px] text-slate-500">triệu đồng</div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Số món vay</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {nq11TotalMon.toLocaleString('vi-VN')}
                </div>
                <div className="text-[11px] text-slate-500">{nq11MonVayIds.length.toLocaleString('vi-VN')} Mã món vay</div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Số xã</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {nq11Summaries.length}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Ngày số liệu</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">{nq11Date ?? '—'}</div>
                <div className="text-[11px] text-slate-500">{nq11TotalRows.toLocaleString('vi-VN')} dòng</div>
              </div>
            </div>
          )}

          {nq11Summaries.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300">Xã</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Món</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Tổng dư nợ</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Từ 03A</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-300">Từ 03B</th>
                  </tr>
                </thead>
                <tbody>
                  {nq11Summaries.map((s) => {
                    const open = !!nq11Expanded[s.maXa];
                    return (
                      <Fragment key={s.maXa}>
                        <tr className="border-b border-slate-100 dark:border-slate-700">
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setNq11Expanded((prev) => ({ ...prev, [s.maXa]: !prev[s.maXa] }))
                              }
                              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
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
                            {s.tenXa} ({s.maXa})
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                            {s.soMonVay.toLocaleString('vi-VN')}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-rose-600">
                            {fmtMoneyFull(s.tongDuNo)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500">
                            {s.from03A_tongDuNo > 0 ? fmtMoneyFull(s.from03A_tongDuNo) : '—'}
                            {s.from03A_soMonVay > 0 && (
                              <span className="ml-1 text-[11px] text-slate-400">
                                ({s.from03A_soMonVay})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500">
                            {s.from03B_tongDuNo > 0 ? fmtMoneyFull(s.from03B_tongDuNo) : '—'}
                            {s.from03B_soMonVay > 0 && (
                              <span className="ml-1 text-[11px] text-slate-400">
                                ({s.from03B_soMonVay})
                              </span>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b border-slate-100 dark:border-slate-700">
                            <td></td>
                            <td colSpan={5} className="bg-slate-50 px-3 py-2 dark:bg-slate-800/40">
                              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                                Danh sách Mã món vay ({(s.monVayIds ?? []).length})
                              </div>
                              {(s.monVayIds ?? []).length === 0 ? (
                                <div className="mt-1 text-[11px] italic text-slate-400">
                                  Dữ liệu NQ11 đã lưu trước đây không chứa Mã món vay. Vui lòng bấm "Xóa NQ11" và tải lại file SK_GQVL.
                                </div>
                              ) : (
                                <div className="mt-1 flex flex-wrap gap-1.5">
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="py-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Tổng dư nợ</div>
                <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {fmtMoney(totalDuNo)}
                </div>
                <div className="text-xs text-slate-500">triệu đồng</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Tổng món vay</div>
                <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {totalMon.toLocaleString('vi-VN')}
                </div>
                <div className="text-xs text-slate-500">khế ước</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Số nhóm</div>
                <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{actuals.length}</div>
                <div className="text-xs text-slate-500">xã × nguồn vốn × chương trình</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Ngày số liệu</div>
                <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {actualDate ?? '—'}
                </div>
                <div className="text-xs text-slate-500">{actualTotalRows.toLocaleString('vi-VN')} dòng gốc</div>
              </CardContent>
            </Card>
          </div>

          {/* Diagnostic panel — giúp kiểm tra bộ lọc dòng cộng/tổng */}
          {actualDiag && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-700 dark:bg-slate-800/50">
              <div className="mb-1 font-semibold text-slate-700 dark:text-slate-200">
                Chẩn đoán import (dùng để xác nhận bộ lọc dòng cộng/tổng đang hoạt động)
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-600 dark:text-slate-300 md:grid-cols-4">
                <div>Tổng dòng quét: <span className="font-mono font-semibold text-slate-900 dark:text-white">{(actualDiag.scannedRows ?? 0).toLocaleString('vi-VN')}</span></div>
                <div>Dòng chi tiết (tính): <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">{actualTotalRows.toLocaleString('vi-VN')}</span></div>
                <div>Dòng cộng/tổng (bỏ): <span className={`font-mono font-semibold ${(actualDiag.skippedRows ?? 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{(actualDiag.skippedRows ?? 0).toLocaleString('vi-VN')}</span></div>
                <div>Dòng trùng (đã loại): <span className={`font-mono font-semibold ${(actualDiag.duplicateLoanIds ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{(actualDiag.duplicateLoanIds ?? 0).toLocaleString('vi-VN')}</span></div>
                <div className="md:col-span-4">Cột nhận dạng: <span className="font-mono text-slate-700 dark:text-slate-200">{(actualDiag.detectedIdCols ?? []).join(', ') || '—'}</span></div>
              </div>
              {(actualDiag.duplicateLoanIds ?? 0) > 0 && (
                <div className="mt-2 text-amber-700 dark:text-amber-300">
                  ℹ {(actualDiag.duplicateLoanIds ?? 0).toLocaleString('vi-VN')} dòng trùng Số khế ước/Mã món vay đã được loại bỏ.
                  Mỗi khoản vay được tính 1 lần.
                </div>
              )}
              {(actualDiag.detectedIdCols ?? []).length === 0 && (
                <div className="mt-2 text-rose-600 dark:text-rose-300">
                  ⚠ Không phát hiện cột nhận dạng dòng chi tiết (Số khế ước / Mã món vay / Mã KH / Tên KH).
                  Mọi dòng có Mã xã đều được tính — có khả năng cộng cả dòng cộng/tổng. Vui lòng gửi tên cột chính xác để điều chỉnh bộ lọc.
                </div>
              )}
            </div>
          )}

          {/* Summary by Xa */}
          <Card>
            <CardHeader>
              <CardTitle>Tổng hợp theo xã</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Mã xã</th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Tên xã</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Số món vay</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Tổng dư nợ (tr.đ)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(byXa.entries()).map(([maXa, data]) => (
                    <tr key={maXa} className="border-b border-slate-100 dark:border-slate-700">
                      <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">{maXa}</td>
                      <td className="px-4 py-2.5 text-slate-900 dark:text-white">{data.tenXa}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{data.soMon.toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-900 dark:text-white">{fmtMoney(data.tongDuNo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Xã</th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Nguồn vốn</th>
                      <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Chương trình</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Món vay</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Dư nợ TH</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Dư nợ QH</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Dư nợ khoanh</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-300">Tổng dư nợ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedActuals.map((a) => (
                      <tr key={`${a.maXa}-${a.maNguonVon}-${a.maChuongTrinh}`} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{a.tenXa}</td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{nguonVonLabel(a.maNguonVon)}</td>
                        <td className="max-w-[250px] truncate px-4 py-2 text-slate-600 dark:text-slate-300">{a.tenChuongTrinh}</td>
                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{a.soMonVay.toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-600 dark:text-slate-300">{fmtMoneyFull(a.duNoTrongHan)}</td>
                        <td className="px-4 py-2 text-right font-mono text-rose-600 dark:text-rose-400">{a.duNoQuaHan > 0 ? fmtMoneyFull(a.duNoQuaHan) : '—'}</td>
                        <td className="px-4 py-2 text-right font-mono text-amber-600 dark:text-amber-400">{a.duNoKhoanh > 0 ? fmtMoneyFull(a.duNoKhoanh) : '—'}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900 dark:text-white">{fmtMoneyFull(a.tongDuNo)}</td>
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
