// Hộp thoại nhập mật khẩu để mở khóa chế độ quản trị (chủ sở hữu).
//
// Khi mật khẩu khớp với hash trong `src/config/auth.ts`, vai trò trong
// useAuthStore được nâng lên 'owner' và hộp thoại tự đóng. Sau đó các nút
// nhập tệp / xuất bản dữ liệu sẽ hiển thị trên hai vỏ ứng dụng.

import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError(null);
      setBusy(false);
      setShowPassword(false);
      // Cho focus vào ô mật khẩu sau khi modal hiển thị
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const h = await hashPassword(password);
      const expected = await getOwnerPasswordSha256();
      if (h === expected) {
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
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-login-title"
      >
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-100 p-2 text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="owner-login-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                Chế độ quản trị
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhập mật khẩu để mở khóa quyền nhập và xuất bản dữ liệu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="owner-password"
              className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="owner-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-brand-500/20"
                placeholder="Nhập mật khẩu"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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
