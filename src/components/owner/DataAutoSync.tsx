// Tự động đồng bộ dữ liệu "Phân tích một kỳ" (snapshot) và "So sánh giữa
// hai kỳ" (period) lên endpoint xuất bản mỗi khi chủ sở hữu nạp/đổi dữ liệu.
// Người xem chỉ cần refresh để thấy bản mới — KHÔNG còn phụ thuộc nút bấm
// "Xuất bản cho người xem" thủ công.
//
// Hành vi:
//  - Chỉ chạy với role = 'owner'; viewer trả về null.
//  - Theo dõi tham chiếu dữ liệu của store tương ứng. `useDataStore` và
//    `usePeriodStore` đều KHÔNG persist → mỗi lần `setData`/`setSlot…` tạo
//    mảng/đối tượng mới, nên so sánh tham chiếu là tín hiệu "đã đổi" chính xác.
//  - Khi dữ liệu đổi: debounce 1.5s rồi publish (kèm danh mục Cán bộ + ĐGD).
//  - Dùng biến cấp module để nhớ bản đã xuất bản → KHÔNG tải lại payload
//    ~5 MB khi owner chỉ điều hướng qua lại giữa các trang trong cùng phiên.
//  - Hiện một pill trạng thái nhỏ ("Đã đồng bộ", "Đang đồng bộ…", "Lỗi…").

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useDataStore } from '@/store/useDataStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import type { ComparePair, PeriodSnapshot } from '@/store/usePeriodStore';
import { useStaffStore } from '@/store/useStaffStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import { publishSnapshot, publishPeriod, publishCatalog } from '@/lib/publish';
import type { LoanRecord } from '@/lib/types';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

// "Bản đã xuất bản" ở cấp module — giữ qua các lần remount/điều hướng trong
// cùng phiên để tránh tải lại payload lớn khi dữ liệu không thực sự đổi.
let lastSnapshotRows: LoanRecord[] | null = null;
const lastPeriod: {
  lastYear: PeriodSnapshot | null;
  lastMonth: PeriodSnapshot | null;
  now: PeriodSnapshot | null;
  pair: ComparePair | null;
} = { lastYear: null, lastMonth: null, now: null, pair: null };

function relTime(ts: number | null): string {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 5_000) return 'vừa xong';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s trước`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  return `${Math.floor(diff / 3_600_000)} giờ trước`;
}

export function DataAutoSync({ kind }: { kind: 'snapshot' | 'period' }) {
  const role = useAuthStore((s) => s.role);

  // Snapshot ("Phân tích một kỳ")
  const snapshotRows = useDataStore((s) => s.rows);
  const snapshotDate = useDataStore((s) => s.ngaySoLieu);

  // Period ("So sánh giữa hai kỳ")
  const lastYear = usePeriodStore((s) => s.lastYear);
  const lastMonth = usePeriodStore((s) => s.lastMonth);
  const now = usePeriodStore((s) => s.now);
  const comparePair = usePeriodStore((s) => s.comparePair);

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [, force] = useState(0);

  const timerRef = useRef<number | null>(null);
  const inFlight = useRef(false);
  const pendingRef = useRef(false);

  // Tick 30s để cập nhật chuỗi "vừa xong / 1 phút trước / …".
  useEffect(() => {
    if (role !== 'owner') return;
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [role]);

  useEffect(() => {
    if (role !== 'owner') return;

    const periodLoadedCount =
      (lastYear ? 1 : 0) + (lastMonth ? 1 : 0) + (now ? 1 : 0);
    const hasData =
      kind === 'snapshot' ? snapshotRows.length > 0 : periodLoadedCount >= 2;
    if (!hasData) return;

    // Dữ liệu có đổi so với bản đã xuất bản? (so sánh tham chiếu)
    const changed =
      kind === 'snapshot'
        ? snapshotRows !== lastSnapshotRows
        : lastYear !== lastPeriod.lastYear ||
          lastMonth !== lastPeriod.lastMonth ||
          now !== lastPeriod.now ||
          comparePair !== lastPeriod.pair;
    if (!changed) return;

    const doPublish = async () => {
      if (inFlight.current) {
        pendingRef.current = true;
        return;
      }
      inFlight.current = true;
      setStatus('syncing');
      try {
        if (kind === 'snapshot') {
          await publishSnapshot(snapshotRows, snapshotDate);
          lastSnapshotRows = snapshotRows;
        } else {
          await publishPeriod({ lastYear, lastMonth, now }, comparePair);
          lastPeriod.lastYear = lastYear;
          lastPeriod.lastMonth = lastMonth;
          lastPeriod.now = now;
          lastPeriod.pair = comparePair;
        }
        // Đính kèm danh mục Cán bộ + ĐGD (payload nhỏ, vài KB) để người xem ở
        // máy khác có cùng dữ liệu cho hai bộ chọn.
        const staff = useStaffStore.getState().staff;
        const points = useTxnPointStore.getState().points;
        await publishCatalog(staff, points);
        setLastAt(Date.now());
        setStatus('synced');
        setErrMsg(null);
      } catch (e) {
        setStatus('error');
        setErrMsg(e instanceof Error ? e.message : String(e));
      } finally {
        inFlight.current = false;
        if (pendingRef.current) {
          pendingRef.current = false;
          void doPublish();
        }
      }
    };

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = window.setTimeout(() => void doPublish(), 1500);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [
    role,
    kind,
    snapshotRows,
    snapshotDate,
    lastYear,
    lastMonth,
    now,
    comparePair,
  ]);

  if (role !== 'owner') return null;

  const tone = (() => {
    if (status === 'syncing')
      return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
    if (status === 'error')
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
    if (status === 'synced')
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400';
  })();

  const Icon = (() => {
    if (status === 'syncing') return Loader2;
    if (status === 'error') return AlertCircle;
    if (status === 'synced') return CheckCircle2;
    return RefreshCw;
  })();

  const label = (() => {
    if (status === 'syncing') return 'Đang đồng bộ cho người xem…';
    if (status === 'error') return 'Lỗi đồng bộ';
    if (status === 'synced')
      return lastAt ? `Đã đồng bộ · ${relTime(lastAt)}` : 'Đã đồng bộ';
    return 'Tự động đồng bộ cho người xem';
  })();

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium ${tone}`}
      title={
        status === 'error'
          ? errMsg ?? ''
          : 'Dữ liệu tự động xuất bản — người xem refresh trang sẽ thấy bản mới nhất'
      }
    >
      <Icon
        className={`h-3 w-3 shrink-0 ${status === 'syncing' ? 'animate-spin' : ''}`}
      />
      <span className="truncate">{label}</span>
    </div>
  );
}
