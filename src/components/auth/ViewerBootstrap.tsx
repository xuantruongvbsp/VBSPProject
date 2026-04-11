// Khi vai trò là 'viewer', tự động tải dữ liệu đã xuất bản và đổ vào hai
// store (snapshot + period). Người xem KHÔNG bao giờ thấy ô nhập tệp; nếu
// chưa có dữ liệu xuất bản thì các trang con tự hiển thị thông báo trống.
//
// Việc tải chỉ chạy một lần mỗi phiên trình duyệt — sau khi store đã có dữ
// liệu thì không gọi lại fetch nữa.

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useDataStore } from '@/store/useDataStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { fetchPublishedSnapshot, fetchPublishedPeriod } from '@/lib/publish';

export function ViewerBootstrap() {
  const role = useAuthStore((s) => s.role);
  const snapshotRows = useDataStore((s) => s.rows);
  const setSnapshot = useDataStore((s) => s.setData);
  const periodPrev = usePeriodStore((s) => s.prev);
  const periodCurr = usePeriodStore((s) => s.curr);
  const setPeriodBoth = usePeriodStore((s) => s.setBoth);
  const ranOnce = useRef(false);

  useEffect(() => {
    if (role !== 'viewer') return;
    if (ranOnce.current) return;
    ranOnce.current = true;

    if (snapshotRows.length === 0) {
      fetchPublishedSnapshot()
        .then((d) => {
          if (d) setSnapshot(d.rows, d.ngaySoLieu);
        })
        .catch((e) => console.warn('[viewer] không tải được snapshot', e));
    }
    if (!periodPrev || !periodCurr) {
      fetchPublishedPeriod()
        .then((d) => {
          if (d) setPeriodBoth(d.prev, d.curr);
        })
        .catch((e) => console.warn('[viewer] không tải được period', e));
    }
  }, [role, snapshotRows.length, periodPrev, periodCurr, setSnapshot, setPeriodBoth]);

  return null;
}
