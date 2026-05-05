// Trạng thái trống dành cho người xem khi chưa có dữ liệu được xuất bản
// cho ứng dụng tương ứng. KHÔNG đề cập đến tệp Excel, nhập tệp, hay tên
// chủ sở hữu — chỉ thông báo đợi và liên hệ quản trị viên.

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Hourglass } from 'lucide-react';

interface Props {
  app: 'snapshot' | 'period' | 'credit-plan';
}

export function ViewerEmptyState({ app }: Props) {
  const navigate = useNavigate();
  const title =
    app === 'snapshot'
      ? 'Phân tích một kỳ — chưa có dữ liệu'
      : app === 'period'
      ? 'So sánh giữa hai kỳ — chưa có dữ liệu'
      : 'Kế hoạch tín dụng — chưa có dữ liệu';
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-lg text-center">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Quay lại trang chính
        </button>
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Hourglass className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Quản trị viên chưa xuất bản dữ liệu cho ứng dụng này. Vui lòng quay
          lại sau hoặc liên hệ quản trị viên để biết thêm thông tin.
        </p>
      </div>
    </div>
  );
}
