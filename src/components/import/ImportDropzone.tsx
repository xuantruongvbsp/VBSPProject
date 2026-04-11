import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { parseExcelFile } from '@/data/parser';
import { useDataStore } from '@/store/useDataStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { saveRecentFile } from '@/lib/recent-files';
import { RecentFiles } from './RecentFiles';

export function ImportDropzone() {
  const { setData, setLoading, setError, isLoading, error } = useDataStore();
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const result = await parseExcelFile(file);
        setData(result.rows, result.ngaySoLieu);
        // Lưu vào IndexedDB để lần sau mở lại không cần tải tệp gốc
        try {
          await saveRecentFile(file, result.rows, result.ngaySoLieu);
        } catch (persistErr) {
          // Không chặn luồng nhập nếu IndexedDB từ chối lưu (quota, riêng tư...)
          console.warn('Không lưu được tệp vào danh sách gần đây:', persistErr);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lỗi khi xử lý tệp');
      } finally {
        setLoading(false);
      }
    },
    [setData, setLoading, setError]
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <RecentFiles />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center transition-colors',
          drag && 'border-brand-500 bg-brand-50'
        )}
      >
        <div className="rounded-full bg-brand-100 p-4 text-brand-700">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-8 w-8" />
          )}
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-800">
            Tải lên tệp báo cáo tín dụng
          </h2>
          <p className="text-sm text-slate-500">
            Hỗ trợ định dạng <strong>.xlsx</strong> – Báo cáo 31: Hồ sơ tín dụng
            chi tiết theo ngày
          </p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={isLoading}>
          <Upload className="h-4 w-4" />
          {isLoading ? 'Đang xử lý...' : 'Chọn tệp dữ liệu'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <p className="text-xs text-slate-400">
          Toàn bộ dữ liệu được xử lý cục bộ trên trình duyệt, không gửi lên máy
          chủ.
        </p>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}
    </div>
  );
}
