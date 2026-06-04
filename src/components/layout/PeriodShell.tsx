import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import {
  Activity,
  GitBranch,
  ShieldCheck,
  TrendingUpDown,
  Users2,
  UserCheck,
  MapPin,
  Table,
  Megaphone,
  GitCompareArrows,
  ArrowLeft,
  RefreshCw,
  ArrowRight,
  Upload,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePeriodStore,
  PERIOD_SLOT_KEYS,
  PERIOD_SLOT_LABEL,
  type PeriodSlotKey,
  type PeriodSnapshot,
} from '@/store/usePeriodStore';
import { useIsOwner } from '@/store/useAuthStore';
import { fmtDate } from '@/lib/format';
import { parseExcelFile } from '@/data/parser';
import { saveRecentPeriodPair } from '@/lib/recent-period-pairs';
import { PeriodImportDropzone } from '@/components/import/PeriodImportDropzone';
import { ViewerEmptyState } from '@/components/auth/ViewerEmptyState';
import { DataAutoSync } from '@/components/owner/DataAutoSync';

const navItems = [
  { to: '/period/dien-bien', label: 'Diễn biến', icon: Activity },
  { to: '/period/ma-tran', label: 'Ma trận chuyển nhóm', icon: GitBranch },
  { to: '/period/chat-luong', label: 'Chất lượng tài sản', icon: ShieldCheck },
  { to: '/period/top-bien-dong', label: 'Top tăng / giảm', icon: TrendingUpDown },
  { to: '/period/hoi-doan-the', label: 'Hội đoàn thể & Tổ', icon: Users2 },
  { to: '/period/can-bo', label: 'So sánh hiệu quả cán bộ', icon: UserCheck },
  { to: '/period/diem-giao-dich', label: 'So sánh hiệu quả ĐGD', icon: MapPin },
  { to: '/period/khe-uoc', label: 'Bảng khế ước biến động', icon: Table },
  { to: '/period/khach-hang', label: 'Outreach & khách hàng', icon: Megaphone },
];

/**
 * Lớp bao trang ngoài cùng cho ứng dụng "So sánh giữa hai kỳ".
 * Khi chưa có ≥2 trong 3 slot, hiển thị `PeriodImportDropzone` thay vì
 * sidebar — buộc người dùng nhập đủ tệp trước khi vào sâu.
 */
export function PeriodShell() {
  const lastYear = usePeriodStore((s) => s.lastYear);
  const lastMonth = usePeriodStore((s) => s.lastMonth);
  const nowSnap = usePeriodStore((s) => s.now);
  const prev = usePeriodStore((s) => s.prev);
  const curr = usePeriodStore((s) => s.curr);
  const comparePair = usePeriodStore((s) => s.comparePair);
  const setComparePair = usePeriodStore((s) => s.setComparePair);
  const setSlot = usePeriodStore((s) => s.setSlot);
  const reset = usePeriodStore((s) => s.reset);
  const navigate = useNavigate();
  const isOwner = useIsOwner();

  // Trạng thái thay tệp tại chỗ cho từng slot — không dùng store để tránh
  // ô loading nhấp nháy trong các trang con khác.
  const [replacing, setReplacing] = useState<PeriodSlotKey | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const fileInputs = useRef<Record<PeriodSlotKey, HTMLInputElement | null>>({
    lastYear: null,
    lastMonth: null,
    now: null,
  });

  const slotMap = useMemo(
    () => ({ lastYear, lastMonth, now: nowSnap }),
    [lastYear, lastMonth, nowSnap]
  );
  const loadedKeys = useMemo(
    () => PERIOD_SLOT_KEYS.filter((k) => slotMap[k] != null),
    [slotMap]
  );
  const ready = loadedKeys.length >= 2 && !!prev && !!curr;

  // Khi đã đủ dữ liệu, đảm bảo URL nằm trong vùng /period.
  useEffect(() => {
    if (ready && window.location.pathname === '/period') {
      navigate('/period/dien-bien', { replace: true });
    }
  }, [ready, navigate]);

  /**
   * Thay thế tại chỗ một tệp ở slot cụ thể — không xóa các slot còn lại,
   * không thoát khỏi ứng dụng. Sau khi parse thành công sẽ cập nhật store
   * và lưu lại bản ghi recents (dưới ID mới do filename/ngày đổi).
   */
  const handleReplaceSlot = useCallback(
    async (key: PeriodSlotKey, file: File) => {
      setReplaceError(null);
      setReplacing(key);
      try {
        const result = await parseExcelFile(file);
        if (!result.ngaySoLieu) {
          throw new Error(
            'Không xác định được "Ngày số liệu" trong tệp. Hãy chắc chắn tệp là Báo cáo 31 chuẩn.'
          );
        }
        // Chặn trùng ngày với các slot còn lại đang còn dữ liệu.
        const otherKeys = PERIOD_SLOT_KEYS.filter((k) => k !== key);
        for (const k of otherKeys) {
          const other = slotMap[k];
          if (
            other?.ngaySoLieu &&
            other.ngaySoLieu.getTime() === result.ngaySoLieu.getTime()
          ) {
            throw new Error(
              `Tệp mới có cùng "Ngày số liệu" với ô ${PERIOD_SLOT_LABEL[k]}. Hãy chọn kỳ khác.`
            );
          }
        }
        const snap: PeriodSnapshot = {
          rows: result.rows,
          ngaySoLieu: result.ngaySoLieu,
          filename: file.name,
          source: 'file',
        };
        setSlot(key, snap);
        // Lưu lại recents với toàn bộ slot hiện tại (gồm slot vừa thay).
        const next: Record<PeriodSlotKey, PeriodSnapshot | null> = {
          ...slotMap,
          [key]: snap,
        };
        try {
          const slotsForSave: Parameters<typeof saveRecentPeriodPair>[0]['slots'] = {};
          for (const k of PERIOD_SLOT_KEYS) {
            const s = next[k];
            if (s) {
              slotsForSave[k] = {
                filename: s.filename,
                size: k === key ? file.size : undefined,
                rows: s.rows,
                ngaySoLieu: s.ngaySoLieu,
              };
            }
          }
          await saveRecentPeriodPair({ slots: slotsForSave });
        } catch (err) {
          console.warn('Không lưu được bộ tệp (sau khi thay slot):', err);
        }
      } catch (e) {
        setReplaceError(e instanceof Error ? e.message : 'Lỗi khi xử lý tệp');
      } finally {
        setReplacing(null);
      }
    },
    [slotMap, setSlot]
  );

  if (!ready) {
    // Người xem: không bao giờ thấy ô nhập tệp
    if (!isOwner) {
      return <ViewerEmptyState app="period" />;
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-period-50/30 px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-period-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Quay lại trang chính
          </button>
          <header className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-period-200 bg-period-50 px-4 py-1.5">
              <GitCompareArrows className="h-4 w-4 text-period-700" />
              <span className="text-xs font-semibold uppercase tracking-wide text-period-700">
                So sánh giữa hai kỳ
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Nhập tối đa 3 tệp Báo cáo 31 — chọn 2 để so sánh
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Ba ô gồm{' '}
              <span className="whitespace-nowrap">"Cuối năm trước" (31/12 năm trước)</span>,{' '}
              <span className="whitespace-nowrap">"Cuối tháng trước"</span> và{' '}
              <span className="whitespace-nowrap">"Hiện tại"</span>. Cần nạp ít nhất 2 ô để vào ứng dụng.
            </p>
          </header>
          <PeriodImportDropzone
            onLoaded={() => navigate('/period/dien-bien', { replace: true })}
          />
        </div>
      </div>
    );
  }

  // Sau khi đủ dữ liệu, nếu user đang ở /period (index) thì điều hướng vào trang đầu.
  if (window.location.pathname === '/period') {
    return <Navigate to="/period/dien-bien" replace />;
  }

  return (
    <div className="flex h-screen w-full">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-3 py-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-2 inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-period-700"
          >
            <ArrowLeft className="h-3 w-3" /> Quay lại trang chính
          </button>
          <div className="flex items-center gap-3 px-2">
            <div className="rounded-lg bg-period-700 p-2 text-white">
              <GitCompareArrows className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold uppercase tracking-wide text-period-700">
                So sánh hai kỳ
              </div>
              <div className="text-sm font-bold text-slate-800">Diễn biến danh mục</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-period-50 text-period-800'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Chọn 2 kỳ để so sánh
          </div>
          <div className="mt-2 space-y-1.5">
            {PERIOD_SLOT_KEYS.map((key) => {
              const snap = slotMap[key];
              const role: 'a' | 'b' | null =
                comparePair.a === key ? 'a' : comparePair.b === key ? 'b' : null;
              const isReplacing = replacing === key;
              return (
                <div
                  key={key}
                  className={cn(
                    'flex items-center gap-1 rounded-md border px-1 py-0.5 text-[11px] transition-colors',
                    !snap && 'border-dashed border-slate-200 text-slate-400',
                    snap && role === 'a' && 'border-slate-400 bg-slate-100 text-slate-800',
                    snap && role === 'b' && 'border-period-400 bg-period-50 text-period-800',
                    snap && role === null && 'border-slate-200 text-slate-600'
                  )}
                >
                  <button
                    type="button"
                    disabled={!snap || isReplacing}
                    onClick={() => onPickSlot(key, comparePair, setComparePair)}
                    className={cn(
                      'flex flex-1 items-center justify-between gap-2 rounded px-1 py-1 text-left',
                      snap && role === null && 'hover:bg-period-50'
                    )}
                    title={
                      !snap
                        ? 'Slot này chưa có dữ liệu — dùng nút bên cạnh để nạp tệp'
                        : role
                          ? `Đang dùng làm Kỳ ${role.toUpperCase()} — bấm để đảo vai trò`
                          : 'Bấm để dùng làm Kỳ B (mới hơn)'
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      {role && (
                        <span
                          className={cn(
                            'inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold',
                            role === 'a' ? 'bg-slate-700 text-white' : 'bg-period-700 text-white'
                          )}
                        >
                          {role.toUpperCase()}
                        </span>
                      )}
                      <span className="font-semibold">{PERIOD_SLOT_LABEL[key]}</span>
                    </span>
                    <span
                      className={cn(
                        'text-[10px]',
                        !snap
                          ? 'text-slate-400'
                          : role === 'b'
                            ? 'text-period-700'
                            : 'text-slate-500'
                      )}
                    >
                      {snap ? fmtDate(snap.ngaySoLieu) : 'trống'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={isReplacing}
                    onClick={() => fileInputs.current[key]?.click()}
                    title={snap ? `Thay tệp ${PERIOD_SLOT_LABEL[key]}` : `Nạp tệp ${PERIOD_SLOT_LABEL[key]}`}
                    aria-label={`Thay tệp ${PERIOD_SLOT_LABEL[key]}`}
                    className={cn(
                      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors',
                      !isReplacing && 'hover:bg-period-100 hover:text-period-700',
                      isReplacing && 'cursor-not-allowed text-period-500'
                    )}
                  >
                    {isReplacing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <input
                    ref={(el) => {
                      fileInputs.current[key] = el;
                    }}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        handleReplaceSlot(key, f);
                        // reset input để có thể chọn lại cùng tệp
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
          {replaceError && (
            <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] text-rose-700">
              {replaceError}
            </div>
          )}
          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
            <span className="font-semibold text-slate-700">Kỳ A</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-semibold text-period-700">Kỳ B</span>
            <span className="ml-auto text-slate-400">
              {prev.rows.length.toLocaleString('vi-VN')} → {curr.rows.length.toLocaleString('vi-VN')}
            </span>
          </div>
          {isOwner && (
            <>
              <button
                onClick={() => {
                  reset();
                  navigate('/period');
                }}
                className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600"
              >
                <RefreshCw className="h-3 w-3" /> Đổi tệp
              </button>
              <div className="mt-3">
                <DataAutoSync kind="period" />
              </div>
            </>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * Quy tắc bấm chip slot:
 *  - Bấm chip đang là Kỳ A: chuyển nó thành Kỳ B (và ngược lại) — đảo vai trò
 *    trong cùng cặp.
 *  - Bấm chip ngoài cặp: thay thế Kỳ B (kỳ mới hơn / phía right) bằng slot này;
 *    Kỳ A giữ nguyên. Nếu vô tình trùng A thì rơi sang Kỳ A.
 */
function onPickSlot(
  key: PeriodSlotKey,
  pair: { a: PeriodSlotKey; b: PeriodSlotKey },
  setComparePair: (p: { a: PeriodSlotKey; b: PeriodSlotKey }) => void
): void {
  if (key === pair.a) {
    setComparePair({ a: pair.b, b: key });
  } else if (key === pair.b) {
    setComparePair({ a: key, b: pair.a });
  } else {
    setComparePair({ a: pair.a, b: key });
  }
}
