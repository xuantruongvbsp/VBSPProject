import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] Không thể hiển thị màn hình', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">
            Không thể mở màn hình này
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Dữ liệu trên máy vẫn được giữ nguyên. Hãy tải lại ứng dụng hoặc quay về trang chính.
          </p>
          <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.assign('/')}
            >
              <Home className="h-4 w-4" /> Trang chính
            </Button>
            <Button type="button" onClick={() => window.location.reload()}>
              <RotateCcw className="h-4 w-4" /> Tải lại ứng dụng
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
