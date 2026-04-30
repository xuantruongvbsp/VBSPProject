import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Calendar,
} from 'lucide-react';
import { parseExcelFile } from '@/data/parser';
import {
  usePeriodStore,
  PERIOD_SLOT_KEYS,
  PERIOD_SLOT_LABEL,
  type ComparePair,
  type PeriodSlotKey,
  type PeriodSnapshot,
} from '@/store/usePeriodStore';
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
  /** Gọi sau khi đã nạp đủ ≥ 2 slot và lưu vào store. */
  onLoaded?: () => void;
}

const SLOT_HINTS: Record<PeriodSlotKey, string> = {
  lastYear: 'Báo cáo 31 chốt 31/12 năm trước (ví dụ 31/12/2025)',
  lastMonth: 'Báo cáo 31 chốt ngày cuối cùng của tháng trước',
  now: 'Báo cáo 31 mới nhất hiện có',
};

/** Gợi ý ngày kỳ vọng cho từng slot, tính theo ngày hôm nay. */
function expectedDate(key: PeriodSlotKey, today = new Date()): Date | null {
  const y = today.getFullYear();
  const m = today.getMonth();
  if (key === 'lastYear') return new Date(y - 1, 11, 31);
  if (key === 'lastMonth') return new Date(y, m, 0); // ngày 0 của tháng hiện tại = cuối tháng trước
  return null;
}

export function PeriodImportDropzone({ onLoaded }: Props) {
  const setSlots = usePeriodStore((s) => s.setSlots);
  const setComparePair = usePeriodStore((s) => s.setComparePair);
  const setError = usePeriodStore((s) => s.setError);
  const error = usePeriodStore((s) => s.error);

  const [slots, setSlotState] = useState<Record<PeriodSlotKey, SlotState>>({
    lastYear: { ...EMPTY_SLOT },
    lastMonth: { ...EMPTY_SLOT },
    now: { ...EMPTY_SLOT },
  });
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

  const updateSlot = useCallback(
    (key: PeriodSlotKey, patch: SlotState | ((prev: SlotState) => SlotState)) => {
      setSlotState((s) => ({
        ...s,
        [key]: typeof patch === 'function' ? patch(s[key]) : patch,
      }));
    },
    []
  );

  const parseInto = useCallback(
    async (key: PeriodSlotKey, file: File) => {
      updateSlot(key, { ...EMPTY_SLOT, file, loading: true });
      try {
        const result = await parseExcelFile(file);
        if (!result.ngaySoLieu) {
          throw new Error(
            'Không xác định được "Ngày số liệu" trong tệp. Hãy chắc chắn tệp là Báo cáo 31 chuẩn.'
          );
        }
        updateSlot(key, {
          file,
          rows: result.rows,
          ngaySoLieu: result.ngaySoLieu,
          loading: false,
          error: null,
        });
      } catch (e) {
        updateSlot(key, {
          file,
          rows: null,
          ngaySoLieu: null,
          loading: false,
          error: e instanceof Error ? e.message : 'Lỗi khi xử lý tệp',
        });
      }
    },
    [updateSlot]
  );

  const readyKeys = useMemo(
    () =>
      PERIOD_SLOT_KEYS.filter(
        (k) => slots[k].rows != null && !slots[k].loading && !slots[k].error
      ),
    [slots]
  );

  const validateAndCommit = useCallback(async () => {
    setError(null);
    if (readyKeys.length < 2) {
      setError('Cần nạp đủ ít nhất 2 trong 3 ô (Cuối năm trước / Cuối tháng trước / Hiện tại).');
      return;
    }

    // Kiểm tra trùng "Ngày số liệu" giữa các slot đã nạp
    const dateBuckets = new Map<number, PeriodSlotKey[]>();
    for (const k of readyKeys) {
      const t = slots[k].ngaySoLieu!.getTime();
      const arr = dateBuckets.get(t) ?? [];
      arr.push(k);
      dateBuckets.set(t, arr);
    }
    for (const [, ks] of dateBuckets) {
      if (ks.length > 1) {
        setError(
          `Hai ô có cùng "Ngày số liệu" (${ks.map((k) => PERIOD_SLOT_LABEL[k]).join(', ')}). Vui lòng chọn các kỳ khác nhau.`
        );
        return;
      }
    }

    // Đẩy vào store
    const snaps: Partial<Record<PeriodSlotKey, PeriodSnapshot | null>> = {};
    for (const k of PERIOD_SLOT_KEYS) {
      const s = slots[k];
      if (s.rows && s.file && s.ngaySoLieu) {
        snaps[k] = {
          rows: s.rows,
          ngaySoLieu: s.ngaySoLieu,
          filename: s.file.name,
          source: 'file',
        };
      } else {
        snaps[k] = null;
      }
    }
    setSlots(snaps);

    // Mặc định cặp so sánh: ưu tiên (lastMonth, now), fallback theo thứ tự thời gian
    const ordered = readyKeys
      .slice()
      .sort((a, b) => slots[a].ngaySoLieu!.getTime() - slots[b].ngaySoLieu!.getTime());
    const pair: ComparePair =
      readyKeys.includes('lastMonth') && readyKeys.includes('now')
        ? { a: 'lastMonth', b: 'now' }
        : { a: ordered[0], b: ordered[ordered.length - 1] };
    setComparePair(pair);

    // Lưu toàn bộ slot đã nạp (1–3) vào IndexedDB recents.
    try {
      const slotsForSave: Parameters<typeof saveRecentPeriodPair>[0]['slots'] = {};
      for (const k of readyKeys) {
        const s = slots[k];
        if (s.file && s.rows) {
          slotsForSave[k] = {
            filename: s.file.name,
            size: s.file.size,
            rows: s.rows,
            ngaySoLieu: s.ngaySoLieu,
          };
        }
      }
      await saveRecentPeriodPair({ slots: slotsForSave });
    } catch (persistErr) {
      console.warn('Không lưu được bộ tệp:', persistErr);
    }

    onLoaded?.();
  }, [slots, readyKeys, setSlots, setComparePair, setError, onLoaded]);

  const handleLoadRecent = useCallback(
    async (id: string) => {
      setLoadingRecentId(id);
      setError(null);
      try {
        const result = await loadRecentPeriodPair(id);
        if (!result) {
          setError('Không tìm thấy bộ tệp đã lưu. Có thể đã bị xóa.');
          await refreshRecents();
          return;
        }
        // Khôi phục tất cả các slot đã lưu (1–3 slot).
        const restored: Parameters<typeof setSlots>[0] = {
          lastYear: null,
          lastMonth: null,
          now: null,
        };
        for (const k of PERIOD_SLOT_KEYS) {
          const slotMeta = result.meta.slots[k];
          const slotRows = result.rows[k];
          if (slotMeta && slotRows) {
            restored[k] = {
              rows: slotRows,
              ngaySoLieu: slotMeta.ngaySoLieu,
              filename: slotMeta.filename,
              source: 'recent',
            };
          }
        }
        setSlots(restored);
        // Cặp mặc định: ưu tiên (lastMonth, now); fallback theo thứ tự thời gian
        const loaded = PERIOD_SLOT_KEYS.filter((k) => restored[k] != null);
        const pair: ComparePair =
          loaded.includes('lastMonth') && loaded.includes('now')
            ? { a: 'lastMonth', b: 'now' }
            : (() => {
                const ordered = loaded
                  .slice()
                  .sort(
                    (a, b) =>
                      (restored[a]!.ngaySoLieu?.getTime() ?? 0) -
                      (restored[b]!.ngaySoLieu?.getTime() ?? 0)
                  );
                return { a: ordered[0], b: ordered[ordered.length - 1] };
              })();
        setComparePair(pair);
        onLoaded?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Lỗi khi tải lại bộ tệp');
      } finally {
        setLoadingRecentId(null);
      }
    },
    [setSlots, setComparePair, setError, onLoaded, refreshRecents]
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
    if (!confirm('Xóa toàn bộ danh sách bộ tệp gần đây?')) return;
    try {
      await clearAllRecentPeriodPairs();
      await refreshRecents();
    } catch (err) {
      console.warn('Không xóa được danh sách:', err);
    }
  }, [refreshRecents]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {recents && recents.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">
                Bộ tệp đã nhập gần đây
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
              const filledKeys = PERIOD_SLOT_KEYS.filter((k) => it.slots[k] != null);
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
                    aria-label={`Mở bộ tệp ${filledKeys.length} slot`}
                  />
                  <div className="pointer-events-none rounded-lg bg-white p-2 text-period-700 shadow-sm">
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                  </div>
                  <div className="pointer-events-none flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {filledKeys.map((k, idx) => {
                      const m = it.slots[k]!;
                      return (
                        <div key={k} className="flex items-center gap-2">
                          {idx > 0 && (
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-period-500" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-period-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-period-700">
                                {PERIOD_SLOT_LABEL[k]}
                              </span>
                              <span className="truncate text-xs font-semibold text-slate-800">
                                {m.filename}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {fmtDate(m.ngaySoLieu)} · {fmtNumber(m.totalRows)} khế ước
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <span className="pointer-events-none rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {filledKeys.length}/3
                  </span>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PERIOD_SLOT_KEYS.map((key) => (
          <Slot
            key={key}
            slotKey={key}
            label={PERIOD_SLOT_LABEL[key]}
            subtitle={SLOT_HINTS[key]}
            expectedAt={expectedDate(key)}
            state={slots[key]}
            onPick={(file) => parseInto(key, file)}
            onClear={() => updateSlot(key, { ...EMPTY_SLOT })}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <div>
          Đã nạp <span className="font-semibold text-slate-700">{readyKeys.length}/3</span> ô.
          Cần ít nhất 2 ô để vào ứng dụng so sánh.
        </div>
        <div>Trong ứng dụng có thể đổi cặp đang so sánh bất kỳ lúc nào.</div>
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
          disabled={readyKeys.length < 2}
          className="bg-period-700 hover:bg-period-800"
        >
          <ArrowRight className="h-4 w-4" /> Vào ứng dụng so sánh
        </Button>
      </div>
    </div>
  );
}

interface SlotProps {
  slotKey: PeriodSlotKey;
  label: string;
  subtitle: string;
  expectedAt: Date | null;
  state: SlotState;
  onPick: (file: File) => void;
  onClear: () => void;
}

function Slot({ label, subtitle, expectedAt, state, onPick, onClear }: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const ready = !!state.rows && !state.loading && !state.error;

  // Cảnh báo nhẹ nếu Ngày số liệu lệch xa kỳ vọng (chỉ thông báo, không chặn)
  const dateMismatch = useMemo(() => {
    if (!ready || !expectedAt || !state.ngaySoLieu) return false;
    return state.ngaySoLieu.getTime() !== expectedAt.getTime();
  }, [ready, expectedAt, state.ngaySoLieu]);

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
        'relative flex min-h-[210px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white p-6 text-center transition-colors',
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
      {expectedAt && (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
          <Calendar className="h-2.5 w-2.5" /> Mong đợi {fmtDate(expectedAt)}
        </div>
      )}

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
            {dateMismatch && (
              <div className="mx-auto mt-1 max-w-xs rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
                Ngày không khớp với mong đợi {fmtDate(expectedAt)}. Vẫn dùng được nhưng hãy kiểm tra lại tệp.
              </div>
            )}
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
