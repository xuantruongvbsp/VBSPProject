// Tự động đồng bộ "Kế hoạch tín dụng" lên endpoint xuất bản mỗi khi chủ
// sở hữu chỉnh sửa. Người xem (mặc định) chỉ cần refresh để thấy bản mới.
//
// Hành vi:
//  - Khi mount với role = 'owner', publish ngay lần đầu (dù dữ liệu chưa
//    đổi) để bảo đảm máy của viewer luôn thấy đúng những gì owner đang có.
//  - Mỗi lần persisted slice của store đổi, debounce 1.5s rồi publish lại.
//  - Hiện một pill trạng thái nhỏ ("Đã đồng bộ", "Đang đồng bộ…", "Lỗi…")
//    cho owner biết tình hình. Với viewer trả về null.

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useCreditPlanStore } from '@/store/useCreditPlanStore';
import { publishCreditPlan, publishAttachment } from '@/lib/publish';
import { getAttachmentBlob } from '@/lib/decision-attachments';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

function relTime(ts: number | null): string {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 5_000) return 'vừa xong';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s trước`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  return `${Math.floor(diff / 3_600_000)} giờ trước`;
}

export function CreditPlanAutoSync() {
  const role = useAuthStore((s) => s.role);
  const xaCatalog = useCreditPlanStore((s) => s.xaCatalog);
  const decisions = useCreditPlanStore((s) => s.decisions);
  const plans = useCreditPlanStore((s) => s.plans);
  const actuals = useCreditPlanStore((s) => s.actuals);
  const actualDate = useCreditPlanStore((s) => s.actualDate);
  const actualTotalRows = useCreditPlanStore((s) => s.actualTotalRows);
  const actualDiag = useCreditPlanStore((s) => s.actualDiag);
  const nq11Summaries = useCreditPlanStore((s) => s.nq11Summaries);
  const nq11MonVayIds = useCreditPlanStore((s) => s.nq11MonVayIds);
  const nq11Date = useCreditPlanStore((s) => s.nq11Date);
  const nq11TotalRows = useCreditPlanStore((s) => s.nq11TotalRows);
  const nq11MatchByXa = useCreditPlanStore((s) => s.nq11MatchByXa);
  const nq11NoxhSummaries = useCreditPlanStore((s) => s.nq11NoxhSummaries);
  const nq11NoxhMonVayIds = useCreditPlanStore((s) => s.nq11NoxhMonVayIds);
  const nq11NoxhDate = useCreditPlanStore((s) => s.nq11NoxhDate);
  const nq11NoxhTotalRows = useCreditPlanStore((s) => s.nq11NoxhTotalRows);

  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [, force] = useState(0);

  const timerRef = useRef<number | null>(null);
  const firstRun = useRef(true);
  const inFlight = useRef(false);
  const pendingRef = useRef(false);

  // Tick mỗi 30s để cập nhật chuỗi "vừa xong / 1 phút trước / …" cho owner.
  useEffect(() => {
    if (role !== 'owner') return;
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [role]);

  // Backfill PDF đính kèm: lần đầu mount với role=owner, đẩy mọi PDF còn
  // trong IndexedDB (nhưng có thể chưa có bản trên server) lên một lần.
  // Đảm bảo các viewer thấy được mọi file kể cả khi owner đã thêm trước
  // khi tính năng publish-attachment được bật. Best-effort, không chặn UI.
  const decisionsForBackfill = decisions;
  useEffect(() => {
    if (role !== 'owner') return;
    let aborted = false;
    (async () => {
      for (const d of decisionsForBackfill) {
        if (aborted) return;
        if (!d.attachment) continue;
        try {
          const blob = await getAttachmentBlob(d.id);
          if (!blob) continue;
          await publishAttachment(d.id, blob);
        } catch {
          /* silent — backfill chỉ là best-effort */
        }
      }
    })();
    return () => {
      aborted = true;
    };
    // Chỉ cần chạy 1 lần khi role chuyển thành 'owner'. Cố tình không lấy
    // `decisions` làm dep — mọi attachment mới sau đó đã được publish ngay
    // tại handleSubmit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (role !== 'owner') return;

    const doPublish = async () => {
      if (inFlight.current) {
        // Có request đang chạy — đặt cờ pending để chạy lại sau khi xong.
        pendingRef.current = true;
        return;
      }
      inFlight.current = true;
      setStatus('syncing');
      try {
        await publishCreditPlan({
          xaCatalog,
          decisions,
          plans,
          actuals,
          actualDate,
          actualTotalRows,
          actualDiag,
          nq11Summaries,
          nq11MonVayIds,
          nq11Date,
          nq11TotalRows,
          nq11MatchByXa,
          nq11NoxhSummaries,
          nq11NoxhMonVayIds,
          nq11NoxhDate,
          nq11NoxhTotalRows,
        });
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
          // Một thay đổi đã xảy ra trong lúc upload — chạy lại ngay.
          void doPublish();
        }
      }
    };

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Lần đầu mount: publish ngay (delay 0). Các lần sau: debounce 1.5s.
    const delay = firstRun.current ? 0 : 1500;
    firstRun.current = false;
    timerRef.current = window.setTimeout(() => {
      void doPublish();
    }, delay);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [
    role,
    xaCatalog,
    decisions,
    plans,
    actuals,
    actualDate,
    actualTotalRows,
    actualDiag,
    nq11Summaries,
    nq11MonVayIds,
    nq11Date,
    nq11TotalRows,
    nq11MatchByXa,
    nq11NoxhSummaries,
    nq11NoxhMonVayIds,
    nq11NoxhDate,
    nq11NoxhTotalRows,
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
      return lastAt
        ? `Đã đồng bộ · ${relTime(lastAt)}`
        : 'Đã đồng bộ';
    return 'Chờ đồng bộ…';
  })();

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${tone}`}
      title={status === 'error' ? errMsg ?? '' : 'Người xem refresh trang sẽ thấy dữ liệu mới nhất'}
    >
      <Icon className={`h-3 w-3 shrink-0 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      <span className="truncate">{label}</span>
    </div>
  );
}
