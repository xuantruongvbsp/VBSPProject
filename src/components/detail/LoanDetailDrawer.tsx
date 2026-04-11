import { useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import type { LoanRecord } from '@/lib/types';
import { fmtCurrency, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';

interface Props {
  record: LoanRecord | null;
  onClose: () => void;
}

const sections: { title: string; fields: { label: string; key: string }[] }[] = [
  {
    title: 'Đơn vị quản lý',
    fields: [
      { label: 'Mã chi nhánh', key: 'Mã CN' },
      { label: 'Mã PGD', key: 'Mã PGD' },
      { label: 'Tên PGD', key: 'Tên PGD' },
      { label: 'Mã xã', key: 'Mã xã' },
      { label: 'Tên xã', key: 'Tên xã' },
      { label: 'Tên thôn', key: 'Tên thôn' },
    ],
  },
  {
    title: 'Khách hàng',
    fields: [
      { label: 'Mã KH', key: 'Mã KH' },
      { label: 'Họ tên', key: 'Tên KH' },
      { label: 'Ngày sinh', key: 'Ngày sinh' },
      { label: 'Giới tính', key: 'Giới tính' },
      { label: 'Phân loại', key: 'Phân loại' },
      { label: 'Loại KH', key: 'Loại KH' },
      { label: 'Dân tộc', key: 'Tên DT' },
      { label: 'Số CMND', key: 'Số CMND' },
      { label: 'Nơi cấp CMND', key: 'Nơi cấp CMND' },
      { label: 'Địa chỉ', key: 'Địa chỉ' },
      { label: 'Số điện thoại', key: 'Số điện thoại' },
    ],
  },
  {
    title: 'Tổ TK&VV và Đơn vị ủy thác',
    fields: [
      { label: 'Mã tổ', key: 'Mã tổ' },
      { label: 'Tên tổ', key: 'Tên tổ' },
      { label: 'Loại tổ', key: 'Loại tổ' },
      { label: 'Mã ĐVUT', key: 'Mã ĐVUT' },
      { label: 'Tên ĐVUT', key: 'Tên ĐVUT' },
    ],
  },
  {
    title: 'Khế ước',
    fields: [
      { label: 'Số khế ước', key: 'Số khế ước' },
      { label: 'Ngày vay', key: 'Ngày vay' },
      { label: 'Ngày đến hạn HĐ', key: 'Ngày ĐH theo hợp đồng' },
      { label: 'Ngày đến hạn (gia hạn)', key: 'Ngày ĐH theo Gia hạn' },
      { label: 'Thời hạn vay', key: 'Thời hạn vay' },
      { label: 'Lãi suất (%)', key: 'Lãi suất' },
      { label: 'Hình thức vay', key: 'Hình thức vay' },
      { label: 'Tình trạng món vay', key: 'Tình trạng món vay' },
    ],
  },
  {
    title: 'Số dư & Giải ngân',
    fields: [
      { label: 'Mức vay', key: 'Mức vay' },
      { label: 'Tổng giải ngân', key: 'Tổng giải ngân' },
      { label: 'Dư nợ trong hạn', key: 'Dư nợ trong hạn' },
      { label: 'Dư nợ quá hạn', key: 'Dư nợ quá hạn' },
      { label: 'Dư nợ khoanh', key: 'Dư nợ khoanh' },
      { label: 'Tổng dư nợ', key: 'Tổng dư nợ' },
      { label: 'Gốc đã trả', key: 'Gốc đã trả' },
      { label: 'Giải ngân trong tháng', key: 'Giải ngân trong tháng' },
    ],
  },
  {
    title: 'Lãi & Thu nợ',
    fields: [
      { label: 'Tổng thu lãi TH', key: 'Tổng thu lãi TH' },
      { label: 'Lãi tồn TH', key: 'Lãi tồn TH' },
      { label: 'Tổng thu lãi QH', key: 'Tổng thu lãi QH' },
      { label: 'Lãi tồn QH', key: 'Lãi tồn QH' },
      { label: 'Lãi DT chưa đến hạn', key: 'Lãi DT chưa đến hạn' },
      { label: 'Thu lãi tháng', key: 'Thu lãi TH tháng' },
      { label: 'Thu nợ tháng', key: 'Thu nợ TH tháng' },
    ],
  },
  {
    title: 'Chương trình tín dụng',
    fields: [
      { label: 'Mã chương trình', key: 'Mã chương trình' },
      { label: 'Tên chương trình', key: 'Tên chương trình' },
      { label: 'Tên Quyết định', key: 'Tên Quyết định' },
      { label: 'Nguồn vốn', key: 'Nguồn vốn' },
      { label: 'Đối tượng thụ hưởng', key: 'Tên ĐTTH' },
    ],
  },
];

const moneyKeys = new Set([
  'Mức vay',
  'Tổng giải ngân',
  'Dư nợ trong hạn',
  'Dư nợ quá hạn',
  'Dư nợ khoanh',
  'Tổng dư nợ',
  'Gốc đã trả',
  'Tổng thu lãi TH',
  'Lãi tồn TH',
  'Tổng thu lãi QH',
  'Lãi tồn QH',
  'Lãi DT chưa đến hạn',
  'Thu lãi TH tháng',
  'Thu nợ TH tháng',
  'Giải ngân trong tháng',
]);
const dateKeys = new Set([
  'Ngày sinh',
  'Ngày vay',
  'Ngày ĐH theo hợp đồng',
  'Ngày ĐH theo Gia hạn',
]);

function format(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (key === 'Lãi suất') return fmtPercent(Number(v), 3);
  if (moneyKeys.has(key)) return fmtCurrency(Number(v));
  if (dateKeys.has(key)) {
    if (typeof v === 'string') return v;
    if (v instanceof Date) return fmtDate(v);
  }
  if (typeof v === 'number') return fmtNumber(v);
  return String(v);
}

export function LoanDetailDrawer({ record, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!record) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Khế ước · {record.soKheUoc}
              </div>
              <div className="mt-1 truncate text-lg font-bold text-slate-900">
                {record.tenKH}
              </div>
              <div className="text-xs text-slate-600">
                {record.tenPGD} · {record.tenXa} · {record.tenDVUT}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-center">
            <div>
              <div className="text-[10px] uppercase text-slate-500">Tổng dư nợ</div>
              <div className="text-sm font-bold text-slate-900">{fmtCurrency(record.tongDuNo)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500">Quá hạn</div>
              <div className="text-sm font-bold text-rose-600">{fmtCurrency(record.duNoQuaHan)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500">Lãi suất</div>
              <div className="text-sm font-bold text-slate-900">{fmtPercent(record.laiSuat, 3)}</div>
            </div>
          </div>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-4">
          {sections.map((s) => (
            <details key={s.title} open className="mb-3 group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <span>{s.title}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 px-1 text-xs">
                {s.fields.map((f) => (
                  <div key={f.key} className="flex flex-col py-1">
                    <span className="text-[10px] uppercase text-slate-500">{f.label}</span>
                    <span className="font-medium text-slate-900">
                      {format(f.key, record.raw[f.key])}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
