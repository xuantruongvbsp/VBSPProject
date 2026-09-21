// Badge trạng thái cho người xem: cho biết dữ liệu họ đang xem được chủ sở
// hữu xuất bản lúc nào. Giúp phân biệt dữ liệu mới/cũ, giảm thắc mắc "sao số
// liệu chưa cập nhật".

import { Clock } from 'lucide-react';

function fmtPublishedAt(iso: string, compact: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (compact) {
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  const date = d.toLocaleDateString('vi-VN');
  const time = d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} ${time}`;
}

export function PublishedAtBadge({
  publishedAt,
  compact = false,
}: {
  publishedAt: string | null;
  compact?: boolean;
}) {
  if (!publishedAt) return null;
  const label = fmtPublishedAt(publishedAt, compact);
  if (!label) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <Clock className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {compact ? `Cập nhật ${label}` : `Cập nhật lúc ${label}`}
      </span>
    </div>
  );
}
