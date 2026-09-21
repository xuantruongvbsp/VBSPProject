import { useCallback, useEffect, useState } from 'react';

// Khoảng thời gian kiểm tra phiên bản mới (ms). Ngoài polling định kỳ còn
// kiểm tra lại ngay khi tab chuyển về trạng thái hiển thị.
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// Cờ ẩn banner chỉ tồn tại trong phiên hiện tại (sessionStorage). Đóng hẳn
// browser rồi mở lại thì vẫn hiện lại nếu còn bản mới — không ẩn vĩnh viễn.
const DISMISS_KEY = 'vsppro.new-version-dismissed';

interface RemoteVersion {
  version?: string;
  buildId?: string;
  buildTs?: number;
}

export interface NewVersionCheck {
  hasNewVersion: boolean;
  remoteBuildId: string | null;
  dismissed: boolean;
  dismiss: () => void;
  reload: () => void;
}

export function useNewVersionCheck(): NewVersionCheck {
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [remoteBuildId, setRemoteBuildId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1',
  );

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }, []);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const stop = () => {
      if (!active) return;
      active = false;
      if (timer !== undefined) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };

    const check = async () => {
      if (!active) return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        // Chế độ `npm run dev` chưa build → không có version.json (404).
        // Fetch fail / !res.ok / JSON không có buildTs đều là tình huống bình
        // thường, không phải lỗi → bỏ qua im lặng và thử lại ở lần poll sau.
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as RemoteVersion;
        if (typeof data.buildTs !== 'number') {
          return;
        }
        if (data.buildTs > __APP_BUILD__.buildTs) {
          setRemoteBuildId(typeof data.buildId === 'string' ? data.buildId : null);
          setHasNewVersion(true);
          stop();
        }
      } catch {
        // Lỗi mạng/JSON tạm thời không được làm mất cơ hội phát hiện bản mới
        // ở các lần poll sau.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check();
    };

    void check();
    timer = window.setInterval(() => void check(), POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      active = false;
      if (timer !== undefined) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return { hasNewVersion, remoteBuildId, dismissed, dismiss, reload };
}
