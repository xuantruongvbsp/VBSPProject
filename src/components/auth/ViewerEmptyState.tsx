// Trạng thái trống dành cho người xem khi chưa có dữ liệu được xuất bản
// cho ứng dụng tương ứng. KHÔNG đề cập đến tệp Excel, nhập tệp, hay tên
// chủ sở hữu — chỉ thông báo đợi và liên hệ quản trị viên.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Hourglass, LogIn } from 'lucide-react';
import { OwnerLoginModal } from '@/components/auth/OwnerLoginModal';

interface Props {
  app: 'snapshot' | 'period' | 'credit-plan';
}

export function ViewerEmptyState({ app }: Props) {
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const title =
    app === 'snapshot'
      ? 'Phân tích một kỳ — chưa có dữ liệu'
      : app === 'period'
      ? 'So sánh giữa hai kỳ — chưa có dữ liệu'
      : 'Kế hoạch tín dụng — chưa có dữ liệu';
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mx-auto mb-6 flex w-fit items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Quay lại trang chính
        </button>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <Hourglass className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Quản trị viên chưa xuất bản dữ liệu cho ứng dụng này. Vui lòng quay
          lại sau hoặc liên hệ quản trị viên để biết thêm thông tin.
        </p>
        <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Bạn là người quản trị và muốn nhập dữ liệu trên máy này?
          </p>
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 dark:bg-brand-500 dark:text-slate-950 dark:hover:bg-brand-400"
          >
            <LogIn className="h-4 w-4" /> Mở chế độ quản trị
          </button>
        </div>
      </div>
      <OwnerLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
