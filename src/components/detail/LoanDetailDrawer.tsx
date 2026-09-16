import { useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import type { LoanRecord } from '@/lib/types';
import { fmtCurrency, fmtDate, fmtNumber, fmtPercent } from '@/lib/format';

interface Props {
  record: LoanRecord | null;
  onClose: () => void;
}

// Drawer đọc thẳng các trường đã type hóa của `LoanRecord` (không còn `raw`
// 174 cột — xem ghi chú ở `LoanRecord`). Cột Excel tương ứng ghi trong
// `label`/comment để đối chiếu với Báo cáo 31.
type FieldKey = keyof LoanRecord;
type Kind = 'text' | 'money' | 'date' | 'percent' | 'number';
interface Field {
  label: string;
  key: FieldKey;
  kind?: Kind;
}

const sections: { title: string; fields: Field[] }[] = [
  {
    title: 'Đơn vị quản lý',
    fields: [
      { label: 'Mã chi nhánh', key: 'maCN' },
      { label: 'Mã PGD', key: 'maPGD' },
      { label: 'Tên PGD', key: 'tenPGD' },
      { label: 'Mã xã', key: 'maXa' },
      { label: 'Tên xã', key: 'tenXa' },
      { label: 'Tên thôn', key: 'tenThon' },
    ],
  },
  {
    title: 'Khách hàng',
    fields: [
      { label: 'Mã KH', key: 'maKH' },
      { label: 'Họ tên', key: 'tenKH' },
      { label: 'Ngày sinh', key: 'ngaySinh', kind: 'date' },
      { label: 'Giới tính', key: 'gioiTinh' },
      { label: 'Phân loại', key: 'phanLoai' },
      { label: 'Loại KH', key: 'loaiKH' },
      { label: 'Dân tộc', key: 'tenDanToc' },
      { label: 'Số CMND', key: 'soCMND' },
      { label: 'Nơi cấp CMND', key: 'noiCapCMND' },
      { label: 'Địa chỉ', key: 'diaChi' },
      { label: 'Số điện thoại', key: 'soDienThoai' },
    ],
  },
  {
    title: 'Tổ TK&VV và Đơn vị ủy thác',
    fields: [
      { label: 'Mã tổ', key: 'maTo' },
      { label: 'Tên tổ', key: 'tenTo' },
      { label: 'Loại tổ', key: 'loaiTo' },
      { label: 'Mã ĐVUT', key: 'maDVUT' },
      { label: 'Tên ĐVUT', key: 'tenDVUT' },
    ],
  },
  {
    title: 'Khế ước',
    fields: [
      { label: 'Số khế ước', key: 'soKheUoc' },
      { label: 'Ngày vay', key: 'ngayVay', kind: 'date' },
      { label: 'Ngày đến hạn HĐ', key: 'ngayDHHopDong', kind: 'date' },
      { label: 'Ngày đến hạn (gia hạn)', key: 'ngayDHGiaHan', kind: 'date' },
      { label: 'Thời hạn vay', key: 'thoiHanVay' },
      { label: 'Lãi suất (%)', key: 'laiSuat', kind: 'percent' },
      { label: 'Hình thức vay', key: 'hinhThucVay' },
      { label: 'Tình trạng món vay', key: 'tinhTrangMonVay' },
    ],
  },
  {
    title: 'Số dư & Giải ngân',
    fields: [
      { label: 'Mức vay', key: 'mucVay', kind: 'money' },
      { label: 'Tổng giải ngân', key: 'tongGiaiNgan', kind: 'money' },
      { label: 'Dư nợ trong hạn', key: 'duNoTrongHan', kind: 'money' },
      { label: 'Dư nợ quá hạn', key: 'duNoQuaHan', kind: 'money' },
      { label: 'Dư nợ khoanh', key: 'duNoKhoanh', kind: 'money' },
      { label: 'Tổng dư nợ', key: 'tongDuNo', kind: 'money' },
      { label: 'Gốc đã trả', key: 'gocDaTra', kind: 'money' },
      { label: 'Giải ngân trong tháng', key: 'giaiNganTrongThang', kind: 'money' },
      { label: 'Số dư tiền gửi 105', key: 'soDuTienGui105', kind: 'money' },
    ],
  },
  {
    title: 'Lãi & Thu nợ',
    fields: [
      { label: 'Tổng thu lãi TH', key: 'tongThuLaiTH', kind: 'money' },
      { label: 'Lãi tồn TH', key: 'laiTonTH', kind: 'money' },
      { label: 'Tổng thu lãi QH', key: 'tongThuLaiQH', kind: 'money' },
      { label: 'Lãi tồn QH', key: 'laiTonQH', kind: 'money' },
      { label: 'Lãi DT chưa đến hạn', key: 'laiDTChuaDenHan', kind: 'money' },
      { label: 'Thu lãi tháng', key: 'thuLaiTHThang', kind: 'money' },
      { label: 'Thu nợ tháng', key: 'thuNoTHThang', kind: 'money' },
    ],
  },
  {
    title: 'Chương trình tín dụng',
    fields: [
      { label: 'Mã chương trình', key: 'maChuongTrinh' },
      { label: 'Tên chương trình', key: 'tenChuongTrinh' },
      { label: 'Tên Quyết định', key: 'tenQuyetDinh' },
      { label: 'Nguồn vốn', key: 'nguonVon' },
      { label: 'Đối tượng thụ hưởng', key: 'tenDTTH' },
    ],
  },
];

function format(kind: Kind | undefined, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (kind === 'percent') return fmtPercent(Number(v), 3);
  if (kind === 'money') return fmtCurrency(Number(v));
  if (kind === 'date') return v instanceof Date ? fmtDate(v) : String(v);
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
      <div className="absolute inset-0 bg-slate-900/30 dark:bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl">
        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Khế ước · {record.soKheUoc}
              </div>
              <div className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-slate-100">
                {record.tenKH}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                {record.tenPGD} · {record.tenXa} · {record.tenDVUT}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-center">
            <div>
              <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Tổng dư nợ</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{fmtCurrency(record.tongDuNo)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Quá hạn</div>
              <div className="text-sm font-bold text-rose-600">{fmtCurrency(record.duNoQuaHan)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400">Lãi suất</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{fmtPercent(record.laiSuat, 3)}</div>
            </div>
          </div>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-4">
          {sections.map((s) => (
            <details key={s.title} open className="mb-3 group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-md bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                <span>{s.title}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 px-1 text-xs">
                {s.fields.map((f) => (
                  <div key={f.key} className="flex flex-col py-1">
                    <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400">{f.label}</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {format(f.kind, record[f.key])}
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
