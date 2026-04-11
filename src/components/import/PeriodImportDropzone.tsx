import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  ArrowRight,
  X,
  History,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
} from 'lucide-react';
import { parseExcelFile } from '@/data/parser';
import { usePeriodStore } from '@/store/usePeriodStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { fmtDate, fmtNumber } from '@/lib/format';
import {
  saveRecentPeriodPair,
  listRecentPeriodPairs,
  loadRecentPeriodPair,
  removeRecentPeriodPair,
  clearAllRecentPeriodPairs,
  type RecentPeriodPairMeta,
} from '@/lib/recent-period-pairs';
import type { LoanRecord } from '@/lib/types';

interface SlotState {
  file: File | null;
  rows: LoanRecord[] | null;
  ngaySoLieu: Date | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_SLOT: SlotState = {
  file: null,
  rows: null,
  ngaySoLieu: null,
  loading: false,
  error: null,
};

interface Props {
  /** Gọi sau khi đã nạp đủ hai slot và lưu vào store. */
  onLoaded?: () => void;
}

export function PeriodImportDropzone({ onLoaded }: Props) {
  const setBoth = usePeriodStore((s) => s.setBoth);
  const setError = usePeriodStore((s) => s.setError);
  const error = usePeriodStore((s) => s.error);

  const [prev, setPrev] = useState<SlotState>({ ...EMPTY_SLOT });
  const [curr, setCurr] = useState<SlotState>({ ...EMPTY_SLOT });
  const [recents, setRecents] = useState<RecentPeriodPairMeta[] | null>(null);
  const [loadingRecentId, setLoadingRecentId] = useState<string | null>(null);

  const refreshRecents = useCallback(async () => {
    try {
      const list = await listRecentPeriodPairs();
      setRecents(list);
    } catch (e) {
      console.warn('Không đọc được danh sách cặp tệp gần đây:', e);
      setRecents([]);
    }
  }, []);

  useEffect(() => {
    refreshRecents();
  }, [refreshRecents]);

  const parseInto = useCallback(
    async (
      file: File,
      setSlot: React.Dispatch<React.SetStateAction<SlotState>>
    ) => {
      setSlot({ ...EMPTY_SLOT, file, loading: true });
      try {
        const result = await parseExcelFile(file);
        if (!result.ngaySoLieu) {
          throw new Error(
            'Không xác định được "Ngày số liệu" trong tệp. Hãy chắc chắn tệp là Báo cáo 31 chuẩn.'
          );
        }
        setSlot({
          file,
          rows: result.rows,
          ngaySoLieu: result.ngaySoLieu,
          loading: false,
          error: null,
        });
      } catch (e) {
        setSlot({
          file,
          rows: null,
          ngaySoLieu: null,
          loading: false,
          error: e instanceof Error ? e.message : 'Lỗi khi xử lý tệp',
        });
      }
    },
    []
  );

  const validateAndCommit = useCallback(async () => {
    setError(null);
    if (
      !prev.file ||
      !curr.file ||
      !prev.rows ||
      !curr.rows ||
      !prev.ngaySoLieu ||
      !curr.ngaySoLieu
    ) {
      setError('Cần nạp đủ hai tệp Báo cáo 31 ở cả hai ô trước khi tiếp tục.');
      return;
    }
    if (prev.ngaySoLieu.getTime() === curr.ngaySoLieu.getTime()) {
      setError('Hai tệp có cùng "Ngày số liệu". Vui lòng chọn hai kỳ khác nhau.');
      return;
    }
    if (prev.ngaySoLieu.getTime() > curr.ngaySoLieu.getTime()) {
      setError(
        `Tệp ở ô "Kỳ trước" (${fmtDate(prev.ngaySoLieu)}) đang muộn hơn ô "Kỳ sau" (${fmtDate(curr.ngaySoLieu)}). Vui lòng đổi vị trí.`
      );
      return;
    }

    setBoth(
      {
        rows: prev.rows,
        ngaySoLieu: prev.ngaySoLieu,
        filename: prev.file.name,
        source: 'file',
      },
      {
        rows: curr.rows,
        ngaySoLieu: curr.ngaySoLieu,
        filename: curr.file.name,
        source: 'file',
      }
    );

    try {
      await saveRecentPeriodPair({
        prev: { file: prev.file, rows: prev.rows, ngaySoLieu: prev.ngaySoLieu },
        curr: { file: curr.file, rows: curr.rows, ngaySoLieu: curr.ngaySoLieu },
      });
    } catch (persistErr) {
      console.warn('Không lưu được cặp tệp:', persistErr);
    }

    onLoaded?.();
  }, [prev, curr, setBoth, setError, onLoaded]);

  const handleSwap = useCallback(() => {
    setPrev((prevSlot) => {
      setCurr(prevSlot);
      return curr;
    });
  }, [curr]);

  const handleLoadRecent = useCallback(
    async (id: string) => {
      setLoadingRecentId(id);
      setError(null);
      try {
        const result = await loadRecentPeriodPair(id);
        if (!result) {
          setError('Không tìm thấy cặp tệp đã lưu. Có thể đã bị xóa.');
          await refreshRecents();
          return;
        }
        setBoth(
          {
            rows: result.prevRows,
            ngaySoLieu: result.meta.prevNgaySoLieu,
            filename: result.meta.prevFilename,
            source: 'recent',
          },
          {
            rows: result.currRows,
            ngaySoLieu: result.meta.currNgaySoLieu,
            filename: result.meta.currFilename,
            source: 'recent',
          }
        );
        onLoaded?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lỗi khi tải lại cặp tệp');
      } finally {
        setLoadingRecentId(null);
      }
    },
    [setBoth, setError, onLoaded, refreshRecents]
  );

  const handleRemoveRecent = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await removeRecentPeriodPair(id);
        await refreshRecents();
      } catch (err) {
        console.warn('Không xóa được cặp tệp:', err);
      }
    },
    [refreshRecents]
  );

  const handleClearAllRecents = useCallback(async () => {
    if (!confirm('Xóa toàn bộ danh sách cặp tệp gần đây?')) return;
    try {
      await clearAllRecentPeriodPairs();
      await refreshRecents();
    } catch (err) {
      console.warn('Không xóa được danh sách:', err);
    }
  }, [refreshRecents]);

  const bothReady =
    !!prev.rows && !!curr.rows && !prev.loading && !curr.loading && !prev.error && !curr.error;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {recents && recents.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">
                Cặp tệp đã nhập gần đây
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {recents.length}
              </span>
            </div>
            <button
              onClick={handleClearAllRecents}
              className="text-[11px] text-slate-500 hover:text-rose-600"
            >
              Xóa tất cả
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {recents.map((it) => {
              const loading = loadingRecentId === it.id;
              const disabled = loadingRecentId !== null;
              return (
                <div
                  key={it.id}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors',
                    'hover:border-period-400 hover:bg-period-50',
                    disabled && 'pointer-events-none opacity-60'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleLoadRecent(it.id)}
                    disabled={disabled}
                    className="absolute inset-0 rounded-xl"
                    aria-label={`Mở cặp tệp ${it.prevFilename} → ${it.currFilename}`}
                  />
                  <div className="pointer-events-none rounded-lg bg-white p-2 text-period-700 shadow-sm">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                  </div>
                  <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-800">
                        {it.prevFilename}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {fmtDate(it.prevNgaySoLieu)} · {fmtNumber(it.prevTotalRows)} khế ước
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-period-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-800">
                        {it.currFilename}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {fmtDate(it.currNgaySoLieu)} · {fmtNumber(it.currTotalRows)} khế ước
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveRecent(it.id, e)}
                    title="Xóa khỏi danh sách"
                    className="relative z-10 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
        <Slot
          label="Kỳ trước"
          subtitle="Tệp Báo cáo 31 ở thời điểm cũ hơn"
          state={prev}
          accent="period"
          onPick={(file) => parseInto(file, setPrev)}
          onClear={() => setPrev({ ...EMPTY_SLOT })}
        />
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={handleSwap}
            disabled={!prev.file && !curr.file}
            title="Đổi vị trí hai ô"
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:border-period-400 hover:text-period-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>
        <Slot
          label="Kỳ sau"
          subtitle="Tệp Báo cáo 31 ở thời điểm mới hơn"
          state={curr}
          accent="period"
          onPick={(file) => parseInto(file, setCurr)}
          onClear={() => setCurr({ ...EMPTY_SLOT })}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={validateAndCommit}
          disabled={!bothReady}
          className="bg-period-700 hover:bg-period-800"
        >
          <ArrowRight className="h-4 w-4" /> Vào ứng dụng so sánh
        </Button>
      </div>
    </div>
  );
}

interface SlotProps {
  label: string;
  subtitle: string;
  state: SlotState;
  accent: 'period';
  onPick: (file: File) => void;
  onClear: () => void;
}

function Slot({ label, subtitle, state, onPick, onClear }: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const ready = !!state.rows && !state.loading && !state.error;

  return (
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
        if (f) onPick(f);
      }}
      className={cn(
        'relative flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white p-6 text-center transition-colors',
        ready
          ? 'border-emerald-300 bg-emerald-50/40'
          : drag
            ? 'border-period-500 bg-period-50'
            : 'border-slate-300'
      )}
    >
      <div
        className={cn(
          'absolute left-3 top-3 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          ready ? 'bg-emerald-100 text-emerald-700' : 'bg-period-100 text-period-700'
        )}
      >
        {label}
      </div>

      {ready ? (
        <>
          <div className="rounded-full bg-emerald-100 p-3 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="max-w-xs truncate text-sm font-semibold text-slate-800">
              {state.file?.name}
            </div>
            <div className="text-xs text-slate-500">
              {fmtDate(state.ngaySoLieu)} · {fmtNumber(state.rows?.length ?? 0)} khế ước
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600"
          >
            <X className="h-3 w-3" /> Bỏ tệp này
          </button>
        </>
      ) : state.loading ? (
        <>
          <div className="rounded-full bg-period-100 p-3 text-period-700">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-800">Đang đọc tệp…</div>
            <div className="max-w-xs truncate text-xs text-slate-500">{state.file?.name}</div>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-full bg-period-100 p-3 text-period-700">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-800">{subtitle}</div>
            <p className="text-[11px] text-slate-500">
              Kéo thả tệp <strong>.xlsx</strong> hoặc bấm để chọn
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="border-period-300 text-period-700 hover:bg-period-50"
          >
            <Upload className="h-3.5 w-3.5" /> Chọn tệp
          </Button>
          {state.error && (
            <div className="mt-1 max-w-xs text-[11px] text-rose-700">{state.error}</div>
          )}
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
    </div>
  );
}
