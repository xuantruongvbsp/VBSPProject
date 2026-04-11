import * as Popover from '@radix-ui/react-popover';
import { fmtCurrency, fmtNumber, fmtPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  data: { ym: string; count: number; tongDuNo: number }[];
}

const MONTH_LABELS_VI: Record<number, string> = {
  1: 'Tháng 1',
  2: 'Tháng 2',
  3: 'Tháng 3',
  4: 'Tháng 4',
  5: 'Tháng 5',
  6: 'Tháng 6',
  7: 'Tháng 7',
  8: 'Tháng 8',
  9: 'Tháng 9',
  10: 'Tháng 10',
  11: 'Tháng 11',
  12: 'Tháng 12',
};

export function HeatmapMaturity({ data }: Props) {
  if (!data.length) return <div className="p-6 text-center text-xs text-slate-400">Không có dữ liệu đáo hạn</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const totalDuNo = data.reduce((s, d) => s + d.tongDuNo, 0);
  // group by year
  const byYear = new Map<string, { month: number; v: typeof data[number] }[]>();
  for (const d of data) {
    const [y, m] = d.ym.split('-');
    const arr = byYear.get(y) ?? [];
    arr.push({ month: Number(m), v: d });
    byYear.set(y, arr);
  }
  const years = Array.from(byYear.keys()).sort();
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <div className="space-y-2">
      <div className="scrollbar-thin max-h-[440px] overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="bg-white px-2 py-1 text-left text-slate-500">Năm</th>
              {months.map((m) => (
                <th key={m} className="bg-white px-1 py-1 text-center text-slate-500">
                  T{m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const arr = byYear.get(y) ?? [];
              const map = new Map(arr.map((a) => [a.month, a.v]));
              return (
                <tr key={y}>
                  <td className="px-2 py-1 font-semibold text-slate-700">{y}</td>
                  {months.map((m) => {
                    const c = map.get(m);
                    const intensity = c ? c.count / max : 0;
                    if (!c) {
                      return (
                        <td key={m} className="p-0.5">
                          <div
                            className="flex h-9 items-center justify-center rounded text-[10px] font-medium text-slate-300"
                            style={{ background: '#f1f5f9' }}
                          >
                            ·
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={m} className="p-0.5">
                        <Popover.Root>
                          <Popover.Trigger asChild>
                            <button
                              type="button"
                              aria-label={`${MONTH_LABELS_VI[m]} ${y} — ${c.count} khế ước`}
                              className={cn(
                                'flex h-9 w-full items-center justify-center rounded text-[10px] font-medium',
                                'cursor-pointer text-slate-900 transition-transform',
                                'hover:scale-105 hover:ring-2 hover:ring-brand-400 hover:ring-offset-1',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1'
                              )}
                              style={{
                                background: `rgba(29, 78, 216, ${0.1 + intensity * 0.7})`,
                                color: intensity > 0.5 ? 'white' : undefined,
                              }}
                            >
                              {fmtNumber(c.count)}
                            </button>
                          </Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Content
                              side="top"
                              align="center"
                              sideOffset={6}
                              collisionPadding={12}
                              className={cn(
                                'z-50 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg',
                                'text-left text-slate-700',
                                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
                              )}
                            >
                              <div className="space-y-3">
                                <div>
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Đáo hạn theo tháng
                                  </div>
                                  <div className="text-sm font-semibold text-slate-900">
                                    {MONTH_LABELS_VI[m]} {y}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                                  <div>
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">
                                      Số khế ước
                                    </div>
                                    <div className="text-base font-bold text-slate-900">
                                      {fmtNumber(c.count)}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {fmtPercent(totalCount > 0 ? (c.count / totalCount) * 100 : 0)} tổng số
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-[10px] uppercase tracking-wide text-slate-500">
                                      Tổng dư nợ
                                    </div>
                                    <div className="text-base font-bold text-slate-900">
                                      {fmtCurrency(c.tongDuNo)}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {fmtPercent(totalDuNo > 0 ? (c.tongDuNo / totalDuNo) * 100 : 0)} tổng dư nợ
                                    </div>
                                  </div>
                                </div>

                                <div className="border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-500">
                                  Số khế ước có ngày đến hạn (gia hạn nếu có, mặc định ngày đến hạn hợp đồng) rơi vào tháng này.
                                </div>
                              </div>
                              <Popover.Arrow className="fill-white" width={10} height={5} />
                            </Popover.Content>
                          </Popover.Portal>
                        </Popover.Root>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-slate-500">
        Mỗi ô = số khế ước đến hạn theo tháng. Bấm vào ô để xem chi tiết dư nợ và tỷ trọng.
      </div>
    </div>
  );
}
