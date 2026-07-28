// Nút "Xuất báo cáo" — dropdown cho phép xuất trang hiện tại ra Excel (.xlsx)
// hoặc PDF (.pdf). Dùng chung cho các trang Tổng quan / Báo cáo so sánh /
// Tra cứu chi tiết. Dữ liệu được truyền từ bên ngoài (không truy cập store
// trực tiếp) để mỗi trang có thể quyết định nội dung xuất.

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { LoanRecord } from '@/lib/types';
import { computeKpi, groupBy, type GroupAgg, type PortfolioKpi } from '@/lib/metrics';
import { useDataStore } from '@/store/useDataStore';
import { fmtCurrency, fmtNumber, fmtPercent } from '@/lib/format';
import { exportToXlsx, type XlsxExportInput } from '@/lib/export-xlsx';
import { exportToPdf, type PdfExportInput, type PdfTable } from '@/lib/export-pdf';

// Loại các khế ước đã tất toán (Tình trạng món vay = "close") khỏi mọi
// bản xuất Excel/PDF. Người dùng vẫn xem được trong "Tra cứu chi tiết",
// nhưng không muốn các khế ước này lọt vào báo cáo gửi đi.
function excludeClosedLoans(rows: readonly LoanRecord[]): LoanRecord[] {
  return rows.filter((r) => {
    const s = (r.tinhTrangMonVay ?? '').trim().toLowerCase();
    return s !== 'close' && s !== 'closed';
  });
}

// Dựng bảng số liệu "text thật" mặc định cho PDF từ danh sách khế ước đang
// xuất. Mọi trang đều truyền `rows`, nên ta tự sinh các bảng phân rã theo
// Xã / Chương trình / ĐVUT — không cần mỗi trang tự viết. Trang nào cần bảng
// riêng có thể truyền `pdfTables` để ghi đè.
function breakdownTable(
  title: string,
  nameHeader: string,
  groups: GroupAgg[],
  limit = 40
): PdfTable | null {
  if (!groups.length) return null;
  return {
    title,
    columns: [
      { header: '#', key: 'stt', align: 'right' },
      { header: nameHeader, key: 'ten' },
      { header: 'Số KƯ', key: 'soKU', align: 'right' },
      { header: 'Dư nợ', key: 'duNo', align: 'right' },
      { header: 'Nợ quá hạn', key: 'nqh', align: 'right' },
      { header: '% QH', key: 'tyLe', align: 'right' },
    ],
    rows: groups.slice(0, limit).map((g, i) => ({
      stt: i + 1,
      ten: g.label,
      soKU: fmtNumber(g.soKheUoc),
      duNo: fmtCurrency(g.tongDuNo),
      nqh: fmtCurrency(g.duNoQuaHan),
      tyLe: fmtPercent(g.tyLeNoQH),
    })),
  };
}

function buildDefaultPdfTables(rows: readonly LoanRecord[]): PdfTable[] {
  const src = rows as LoanRecord[];
  return [
    breakdownTable('Dư nợ theo xã', 'Xã', groupBy(src, 'tenXa')),
    breakdownTable(
      'Dư nợ theo chương trình tín dụng',
      'Chương trình',
      groupBy(src, 'tenChuongTrinh')
    ),
    breakdownTable('Dư nợ theo đơn vị ủy thác', 'Đơn vị ủy thác', groupBy(src, 'tenDVUT')),
  ].filter((t): t is PdfTable => t !== null);
}

export interface ExportMenuProps {
  /** Tiêu đề trang, ví dụ "Tổng quan danh mục tín dụng" */
  pageTitle: string;
  /** Phụ đề tùy chọn (ví dụ "Snapshot 28/03/2026 — 15.356 khế ước") */
  subtitle?: string;
  /** Danh sách khế ước đã lọc (sẽ xuất trong sheet chi tiết) */
  rows: LoanRecord[];
  /** Bộ chỉ tiêu KPI đã tính sẵn */
  kpi: PortfolioKpi;

  /**
   * Các CSS selector trỏ tới phần tử biểu đồ cần chụp vào PDF.
   * Ví dụ: ['#chart-bar-dvut', '#chart-donut-program']
   */
  chartSelectors?: string[];
  /**
   * Hoặc refs trực tiếp tới phần tử biểu đồ. Có thể dùng song song với
   * `chartSelectors` — phần tử từ refs sẽ được xử lý trước.
   */
  chartRefs?: React.RefObject<HTMLElement>[];

  /** Bảng dữ liệu bổ sung hiển thị trong PDF (một bảng — tương thích ngược) */
  pdfTable?: PdfExportInput['table'];
  /** Nhiều bảng số liệu (text thật) hiển thị trong PDF */
  pdfTables?: PdfExportInput['tables'];
  /** Các sheet bổ sung hiển thị trong XLSX */
  xlsxExtraSheets?: XlsxExportInput['extraSheets'];

  /** Tên tệp XLSX tùy chọn */
  xlsxFilename?: string;
  /** Tên tệp PDF tùy chọn */
  pdfFilename?: string;

  /** Kích thước nút (mặc định `md`) */
  size?: 'sm' | 'md' | 'lg';
  /** Lớp CSS bổ sung cho nút */
  className?: string;
  /** Vô hiệu hoá toàn bộ menu */
  disabled?: boolean;
  /** Callback khi xuất gặp lỗi */
  onError?: (err: unknown) => void;
}

type Mode = 'idle' | 'xlsx' | 'pdf' | 'both';

function resolveChartElements(
  chartRefs: readonly React.RefObject<HTMLElement>[] | undefined,
  chartSelectors: readonly string[] | undefined
): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (chartRefs) {
    for (const r of chartRefs) {
      if (r.current) out.push(r.current);
    }
  }
  if (chartSelectors) {
    for (const sel of chartSelectors) {
      const el = document.querySelector(sel);
      if (el instanceof HTMLElement) out.push(el);
    }
  }
  return out;
}

export function ExportMenu(props: ExportMenuProps): React.ReactElement {
  const {
    pageTitle,
    subtitle,
    rows,
    kpi,
    pdfTable,
    pdfTables,
    xlsxExtraSheets,
    xlsxFilename,
    pdfFilename,
    size = 'md',
    className,
    disabled,
    onError,
  } = props;

  const { chartSelectors, chartRefs } = props;

  const [mode, setMode] = React.useState<Mode>('idle');
  const [open, setOpen] = React.useState(false);
  const busy = mode !== 'idle';

  const handleError = React.useCallback(
    (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[ExportMenu] Xuất báo cáo thất bại:', err);
      if (onError) onError(err);
    },
    [onError]
  );

  // Chuẩn hóa dữ liệu xuất: loại bỏ khế ước đã tất toán và tính lại KPI cho
  // khớp với danh sách thật sự được ghi vào file.
  const exportRows = React.useMemo(() => excludeClosedLoans(rows), [rows]);
  const exportKpi = React.useMemo<PortfolioKpi>(
    () =>
      exportRows.length === rows.length
        ? kpi
        : computeKpi(exportRows, useDataStore.getState().depositByKH),
    [exportRows, rows.length, kpi]
  );

  const runXlsx = React.useCallback(async () => {
    await exportToXlsx({
      rows: exportRows,
      kpi: exportKpi,
      pageTitle,
      subtitle,
      extraSheets: xlsxExtraSheets,
      filename: xlsxFilename,
    });
  }, [exportRows, exportKpi, pageTitle, subtitle, xlsxExtraSheets, xlsxFilename]);

  const runPdf = React.useCallback(async () => {
    const chartElements = resolveChartElements(chartRefs, chartSelectors);
    // Ưu tiên bảng do trang truyền vào; nếu không có, tự sinh bảng phân rã
    // mặc định (Xã / Chương trình / ĐVUT) từ danh sách khế ước đang xuất.
    const tables = pdfTables ?? buildDefaultPdfTables(exportRows);
    await exportToPdf({
      pageTitle,
      subtitle,
      kpi: exportKpi,
      chartElements,
      tables,
      table: pdfTable,
      filename: pdfFilename,
    });
  }, [
    chartRefs,
    chartSelectors,
    pageTitle,
    subtitle,
    exportKpi,
    exportRows,
    pdfTables,
    pdfTable,
    pdfFilename,
  ]);

  const onClickXlsx = React.useCallback(async () => {
    if (busy) return;
    setOpen(false);
    setMode('xlsx');
    try {
      await runXlsx();
    } catch (err) {
      handleError(err);
    } finally {
      setMode('idle');
    }
  }, [busy, runXlsx, handleError]);

  const onClickPdf = React.useCallback(async () => {
    if (busy) return;
    setOpen(false);
    setMode('pdf');
    try {
      await runPdf();
    } catch (err) {
      handleError(err);
    } finally {
      setMode('idle');
    }
  }, [busy, runPdf, handleError]);

  const onClickBoth = React.useCallback(async () => {
    if (busy) return;
    setOpen(false);
    setMode('both');
    try {
      await Promise.all([runXlsx(), runPdf()]);
    } catch (err) {
      handleError(err);
    } finally {
      setMode('idle');
    }
  }, [busy, runXlsx, runPdf, handleError]);

  const label = busy ? 'Đang xuất…' : 'Xuất báo cáo';
  const isDisabled = disabled || busy || exportRows.length === 0;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={isDisabled}
          className={cn('gap-2', className)}
          aria-label="Xuất báo cáo"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
          <span>{label}</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-50 w-60 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-lg',
            'focus:outline-none'
          )}
        >
          <MenuItem
            icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
            label="Xuất Excel (.xlsx)"
            description="Dữ liệu chi tiết + KPI"
            onClick={onClickXlsx}
            disabled={busy}
          />
          <MenuItem
            icon={<FileText className="h-4 w-4 text-rose-600" />}
            label="Xuất PDF (.pdf)"
            description="Báo cáo định dạng"
            onClick={onClickPdf}
            disabled={busy}
          />
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
          <MenuItem
            icon={<Download className="h-4 w-4 text-slate-600" />}
            label="Xuất cả hai định dạng"
            description="Tải đồng thời .xlsx và .pdf"
            onClick={onClickBoth}
            disabled={busy}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
}

function MenuItem({
  icon,
  label,
  description,
  onClick,
  disabled,
}: MenuItemProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-3 rounded-sm px-2.5 py-2 text-left text-sm',
        'hover:bg-slate-50 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex flex-col">
        <span className="font-medium text-slate-800 dark:text-slate-100">{label}</span>
        {description ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
        ) : null}
      </span>
    </button>
  );
}

export default ExportMenu;
