// Nút "Xuất bản dữ liệu" — chỉ hiện cho chủ sở hữu trên thanh bên của
// hai vỏ ứng dụng. Khi bấm sẽ gửi toàn bộ rows hiện tại đến endpoint
// nội bộ của vite-plugin-publish, ghi thành tệp tĩnh trong public/.

import { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useDataStore } from '@/store/useDataStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { useStaffStore } from '@/store/useStaffStore';
import { useTxnPointStore } from '@/store/useTxnPointStore';
import {
  publishSnapshot,
  publishPeriod,
  publishCatalog,
} from '@/lib/publish';

interface Props {
  kind: 'snapshot' | 'period';
}

type State =
  | { phase: 'idle' }
  | { phase: 'busy'; step: 'serializing' | 'uploading' }
  | { phase: 'done' }
  | { phase: 'error'; msg: string };

export function PublishButton({ kind }: Props) {
  const [state, setState] = useState<State>({ phase: 'idle' });
  const snapshotRows = useDataStore((s) => s.rows);
  const snapshotDate = useDataStore((s) => s.ngaySoLieu);
  const periodLastYear = usePeriodStore((s) => s.lastYear);
  const periodLastMonth = usePeriodStore((s) => s.lastMonth);
  const periodNow = usePeriodStore((s) => s.now);
  const periodPair = usePeriodStore((s) => s.comparePair);

  // Cho phép xuất bản period khi có ≥ 2 slot — viewer sẽ hydrate đủ những
  // slot có dữ liệu và giữ nguyên toggle "Cuối năm trước/Cuối tháng/Hiện tại".
  const periodLoadedCount =
    (periodLastYear ? 1 : 0) +
    (periodLastMonth ? 1 : 0) +
    (periodNow ? 1 : 0);
  const canPublish =
    kind === 'snapshot' ? snapshotRows.length > 0 : periodLoadedCount >= 2;

  const handleClick = async () => {
    if (state.phase === 'busy') return;
    setState({ phase: 'busy', step: 'serializing' });
    const onProgress = (step: 'serializing' | 'uploading') =>
      setState({ phase: 'busy', step });
    try {
      if (kind === 'snapshot') {
        await publishSnapshot(snapshotRows, snapshotDate, { onProgress });
      } else if (periodLoadedCount >= 2) {
        await publishPeriod(
          {
            lastYear: periodLastYear,
            lastMonth: periodLastMonth,
            now: periodNow,
          },
          periodPair,
          { onProgress }
        );
      }
      // Đồng thời xuất bản danh mục Cán bộ + ĐGD để người xem ở laptop khác
      // có cùng dữ liệu cho hai bộ chọn. Catalog rất nhỏ (vài KB) nên đính kèm
      // mỗi lần publish là rẻ và đảm bảo viewer luôn đồng bộ với owner.
      const staff = useStaffStore.getState().staff;
      const points = useTxnPointStore.getState().points;
      await publishCatalog(staff, points);
      setState({ phase: 'done' });
      setTimeout(() => setState({ phase: 'idle' }), 2500);
    } catch (e) {
      setState({
        phase: 'error',
        msg: e instanceof Error ? e.message : 'Lỗi không xác định',
      });
    }
  };

  const label = (() => {
    if (state.phase === 'busy')
      return state.step === 'serializing'
        ? 'Đang chuẩn bị dữ liệu…'
        : 'Đang tải lên…';
    if (state.phase === 'done') return 'Đã xuất bản';
    return 'Xuất bản cho người xem';
  })();

  const Icon = (() => {
    if (state.phase === 'busy') return Loader2;
    if (state.phase === 'done') return CheckCircle2;
    if (state.phase === 'error') return AlertCircle;
    return Send;
  })();

  const colorClass = (() => {
    if (state.phase === 'done')
      return 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
    if (state.phase === 'error')
      return 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100';
    return 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100';
  })();

  return (
    <div>
      <button
        type="button"
        disabled={!canPublish || state.phase === 'busy'}
        onClick={handleClick}
        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${colorClass}`}
        title="Lưu dữ liệu hiện tại để mọi người xem có thể xem qua URL"
      >
        <Icon
          className={`h-3.5 w-3.5 ${state.phase === 'busy' ? 'animate-spin' : ''}`}
        />
        {label}
      </button>
      {state.phase === 'error' && (
        <div className="mt-1 text-[10px] text-rose-600" title={state.msg}>
          {state.msg.length > 60 ? state.msg.slice(0, 60) + '…' : state.msg}
        </div>
      )}
    </div>
  );
}
