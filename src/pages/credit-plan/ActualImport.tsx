import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { parseActualFile } from '@/data/credit-plan-parser';
import { nguonVonLabel } from '@/lib/credit-plan-types';

function fmtMoney(n: number) {
  return Math.round(n / 1_000_000).toLocaleString('vi-VN');
}

function fmtMoneyFull(n: number) {
  return n.toLocaleString('vi-VN');
}

export function ActualImport() {
  const { actuals, actualDate, actualTotalRows, setActuals, clearActuals } = useCreditPlanStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      setError('Chỉ hỗ trợ file Excel (.xlsx, .xls)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await parseActualFile(file);
      setActuals(result.summaries, result.ngaySoLieu, result.totalRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi đọc file');
    } finally {
      setLoading(false);
    }
  }, [setActuals]);

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

  // Aggregate by xa for summary
  const byXa = new Map<string, { tenXa: string; tongDuNo: number; soMon: number }>();
  for (const a of actuals) {
    const existing = byXa.get(a.maXa);
    if (existing) {
      existing.tongDuNo += a.tongDuNo;
      existing.soMon += a.soMonVay;
    } else {
      byXa.set(a.maXa, { tenXa: a.tenXa, tongDuNo: a.tongDuNo, soMon: a.soMonVay });
    }
  }

  const totalDuNo = actuals.reduce((s, a) => s + a.tongDuNo, 0);
  const totalMon = actuals.reduce((s, a) => s + a.soMonVay, 0);

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
                    {actuals.map((a) => (
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
