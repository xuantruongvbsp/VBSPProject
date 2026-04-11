// Hộp thoại nhập mật khẩu để mở khóa chế độ quản trị (chủ sở hữu).
//
// Khi mật khẩu khớp với hash trong `src/config/auth.ts`, vai trò trong
// useAuthStore được nâng lên 'owner' và hộp thoại tự đóng. Sau đó các nút
// nhập tệp / xuất bản dữ liệu sẽ hiển thị trên hai vỏ ứng dụng.

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { OWNER_PASSWORD_SHA256, hashPassword } from '@/config/auth';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OwnerLoginModal({ open, onClose }: Props) {
  const setRole = useAuthStore((s) => s.setRole);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError(null);
      setBusy(false);
      // Cho focus vào ô mật khẩu sau khi modal hiển thị
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const h = await hashPassword(password);
      if (h === OWNER_PASSWORD_SHA256) {
        setRole('owner');
        onClose();
      } else {
        setError('Mật khẩu không đúng');
      }
    } catch {
      setError('Không kiểm tra được mật khẩu');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-100 p-2 text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Chế độ quản trị
              </h2>
              <p className="text-xs text-slate-500">
                Nhập mật khẩu để mở khóa quyền nhập và xuất bản dữ liệu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="owner-password"
              className="mb-1 block text-xs font-medium text-slate-700"
            >
              Mật khẩu
            </label>
            <input
              ref={inputRef}
              id="owner-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={busy || !password}>
              {busy ? 'Đang kiểm tra…' : 'Mở khóa'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
