// Xuất báo cáo PDF (.pdf) cho webapp VSPPRO
//
// Chiến lược: dựng một khối HTML ẩn (off-screen) với font hệ thống hỗ trợ
// tiếng Việt, sau đó dùng `html2canvas` để rasterize thành ảnh và đưa vào
// jsPDF. Cách này tránh hoàn toàn vấn đề font Unicode của jsPDF (jsPDF chỉ
// có font Helvetica / Times / Courier, không hỗ trợ dấu tiếng Việt đầy đủ).
//
// Trade-off:
//  + Tiếng Việt hiển thị đúng 100% (render từ trình duyệt).
//  + Giữ được bố cục / màu sắc / typography giống giao diện.
//  - Nội dung là ảnh bitmap → file lớn hơn, không chọn/copy được chữ.
//  - Bảng dài có thể bị cắt qua nhiều trang — ta xử lý bằng slicing canvas.

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { PortfolioKpi } from '@/lib/metrics';
import {
  fmtCurrency,
  fmtDate,
  fmtNumber,
  fmtPercent,
} from '@/lib/format';
import { makeDefaultFilename } from '@/lib/export-xlsx';

export interface PdfTableColumn {
  header: string;
  key: string;
  /** Căn phải cho cột số (mặc định căn trái) */
  align?: 'left' | 'right' | 'center';
}

export interface PdfExportInput {
  /** Tiêu đề trang */
  pageTitle: string;
  /** Phụ đề tùy chọn (ví dụ: "Snapshot 28/03/2026 — 15.356 khế ước") */
  subtitle?: string;
  /** Bộ chỉ tiêu KPI đã tính sẵn */
  kpi: PortfolioKpi;
  /** Các phần tử DOM sẽ được chụp làm ảnh (biểu đồ) */
  chartElements?: HTMLElement[];
  /** Bảng dữ liệu bổ sung tùy chọn */
  table?: {
    title: string;
    columns: PdfTableColumn[];
    rows: Record<string, unknown>[];
  };
  /** Tên tệp, nếu bỏ trống sẽ tự sinh theo ngày giờ hiện tại */
  filename?: string;
}

// ----- Dựng báo cáo HTML để rasterize -------------------------------------

interface KpiItem {
  label: string;
  value: string;
  accent?: boolean;
}

function kpiItems(kpi: PortfolioKpi): KpiItem[] {
  return [
    { label: 'Số khế ước', value: fmtNumber(kpi.soKheUoc) },
    { label: 'Số khách hàng', value: fmtNumber(kpi.soKhachHang) },
    { label: 'Tổng dư nợ', value: fmtCurrency(kpi.tongDuNo) },
    { label: 'Tổng giải ngân', value: fmtCurrency(kpi.tongGiaiNgan) },
    { label: 'Dư nợ quá hạn', value: fmtCurrency(kpi.duNoQuaHan), accent: true },
    { label: 'Tỷ lệ nợ quá hạn', value: fmtPercent(kpi.tyLeNoQuaHan), accent: true },
    { label: 'Dư nợ khoanh', value: fmtCurrency(kpi.duNoKhoanh) },
    { label: 'Lãi tồn trong hạn', value: fmtCurrency(kpi.laiTonTH) },
    { label: 'Thu lãi TH trong tháng', value: fmtCurrency(kpi.thuLaiTHThang) },
    { label: 'Lãi suất bình quân', value: fmtPercent(kpi.laiSuatBQ) },
    { label: 'Mức vay bình quân', value: fmtCurrency(kpi.mucVayBQ) },
  ];
}

/** HTML-escape an arbitrary string */
function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tạo một container HTML ẩn, đính vào body (off-screen), trả về phần tử và
 * hàm dọn dẹp.
 */
function createOffscreenContainer(widthPx: number): {
  el: HTMLDivElement;
  cleanup: () => void;
} {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '-99999px';
  el.style.width = `${widthPx}px`;
  el.style.background = '#ffffff';
  el.style.color = '#0f172a';
  el.style.fontFamily =
    "'Segoe UI', 'Inter', system-ui, -apple-system, Arial, sans-serif";
  el.style.fontSize = '13px';
  el.style.lineHeight = '1.45';
  el.style.padding = '24px';
  el.style.boxSizing = 'border-box';
  document.body.appendChild(el);
  return {
    el,
    cleanup: () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    },
  };
}

/** Dựng nội dung HTML cho phần đầu báo cáo (header + KPI) */
function buildHeaderHtml(
  pageTitle: string,
  subtitle: string | undefined,
  kpi: PortfolioKpi
): string {
  const generated = new Date();
  const gen = `${fmtDate(generated)} ${String(generated.getHours()).padStart(
    2,
    '0'
  )}:${String(generated.getMinutes()).padStart(2, '0')}`;

  const kpiHtml = kpiItems(kpi)
    .map(
      (k) => `
        <div style="
          flex: 1 1 calc(25% - 8px);
          min-width: 160px;
          border: 1px solid #e2e8f0;
          border-left: 4px solid ${k.accent ? '#e11d48' : '#0f766e'};
          border-radius: 6px;
          padding: 10px 12px;
          background: #ffffff;
        ">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.02em;">${esc(
            k.label
          )}</div>
          <div style="font-size: 16px; font-weight: 600; color: ${
            k.accent ? '#be123c' : '#0f172a'
          }; margin-top: 2px;">${esc(k.value)}</div>
        </div>`
    )
    .join('');

  return `
    <div style="border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 16px;">
      <div style="font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">
        Ngân hàng Chính sách Xã hội
      </div>
      <div style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 2px;">
        ${esc(pageTitle)}
      </div>
      ${
        subtitle
          ? `<div style="font-size: 13px; color: #475569; margin-top: 2px;">${esc(
              subtitle
            )}</div>`
          : ''
      }
      <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
        Ngày xuất báo cáo: ${esc(gen)}
      </div>
    </div>

    <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin: 4px 0 8px;">
      Tóm tắt chỉ tiêu
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      ${kpiHtml}
    </div>
  `;
}

/** Dựng HTML cho bảng dữ liệu */
function buildTableHtml(table: NonNullable<PdfExportInput['table']>): string {
  const thead = table.columns
    .map(
      (c) => `
        <th style="
          text-align: ${c.align ?? 'left'};
          padding: 6px 8px;
          background: #f1f5f9;
          border-bottom: 1px solid #cbd5e1;
          font-size: 11px;
          color: #334155;
          font-weight: 600;
        ">${esc(c.header)}</th>`
    )
    .join('');

  const tbody = table.rows
    .map(
      (row, i) =>
        `<tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">` +
        table.columns
          .map(
            (c) => `
          <td style="
            text-align: ${c.align ?? 'left'};
            padding: 5px 8px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 11px;
            color: #0f172a;
            vertical-align: top;
          ">${esc(row[c.key])}</td>`
          )
          .join('') +
        '</tr>'
    )
    .join('');

  return `
    <div style="margin-top: 18px;">
      <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 6px;">
        ${esc(table.title)}
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  `;
}

// ----- Chụp ảnh biểu đồ ---------------------------------------------------

async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    logging: false,
    useCORS: true,
  });
}

// ----- Ghép ảnh vào jsPDF -------------------------------------------------

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 12;
const FOOTER_MM = 10;
const USABLE_W = A4_W_MM - MARGIN_MM * 2;
const USABLE_H = A4_H_MM - MARGIN_MM * 2 - FOOTER_MM;

/**
 * Thêm một canvas vào PDF, tự động chia trang nếu cao quá một trang.
 * Trả về con trỏ y sau khi thêm (mm) — tuy nhiên vì ta luôn đặt mỗi canvas ở
 * đầu trang nên giá trị trả về không thật sự cần thiết.
 */
function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  startNewPage: boolean
): void {
  if (startNewPage) pdf.addPage();

  // Tính kích thước mm dựa trên tỷ lệ khung hình
  const imgWmm = USABLE_W;
  const imgHmm = (canvas.height * imgWmm) / canvas.width;

  if (imgHmm <= USABLE_H) {
    const dataUrl = canvas.toDataURL('image/png');
    pdf.addImage(dataUrl, 'PNG', MARGIN_MM, MARGIN_MM, imgWmm, imgHmm);
    return;
  }

  // Canvas quá cao — cắt thành nhiều trang
  const pxPerMm = canvas.width / imgWmm;
  const pageHpx = Math.floor(USABLE_H * pxPerMm);
  let offsetPx = 0;
  let first = true;

  while (offsetPx < canvas.height) {
    const slicePx = Math.min(pageHpx, canvas.height - offsetPx);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = slicePx;
    const ctx = slice.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0,
      offsetPx,
      canvas.width,
      slicePx,
      0,
      0,
      canvas.width,
      slicePx
    );
    if (!first) pdf.addPage();
    const hMm = slicePx / pxPerMm;
    pdf.addImage(
      slice.toDataURL('image/png'),
      'PNG',
      MARGIN_MM,
      MARGIN_MM,
      imgWmm,
      hMm
    );
    offsetPx += slicePx;
    first = false;
  }
}

/** Vẽ footer (số trang + tên hệ thống) cho tất cả các trang */
function drawFooter(pdf: jsPDF): void {
  const pageCount = pdf.getNumberOfPages();
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    const y = A4_H_MM - 6;
    pdf.text('He thong VSPPRO', MARGIN_MM, y);
    pdf.text(
      `Trang ${i}/${pageCount}`,
      A4_W_MM - MARGIN_MM,
      y,
      { align: 'right' }
    );
  }
}

// ----- API chính ----------------------------------------------------------

/**
 * Xuất báo cáo PDF và kích hoạt tải xuống.
 * Toàn bộ nội dung (trừ footer) được rasterize qua html2canvas để đảm bảo
 * hiển thị tiếng Việt có dấu chính xác.
 */
export async function exportToPdf(input: PdfExportInput): Promise<void> {
  const {
    pageTitle,
    subtitle,
    kpi,
    chartElements,
    table,
    filename,
  } = input;

  // Container A4 rộng ~794 px (tương đương 210mm ở 96 DPI)
  const containerWidthPx = 794;
  const { el: headerEl, cleanup: cleanupHeader } =
    createOffscreenContainer(containerWidthPx);
  headerEl.innerHTML = buildHeaderHtml(pageTitle, subtitle, kpi);

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  try {
    // Trang 1: header + KPI
    const headerCanvas = await captureElement(headerEl);
    addCanvasToPdf(pdf, headerCanvas, false);

    // Biểu đồ: mỗi biểu đồ một trang mới (hoặc tiếp nối nếu nhỏ — để đơn
    // giản, ta luôn sang trang mới cho biểu đồ để tránh chồng lên KPI).
    if (chartElements?.length) {
      for (const chart of chartElements) {
        if (!chart) continue;
        const canvas = await captureElement(chart);
        addCanvasToPdf(pdf, canvas, true);
      }
    }

    // Bảng (nếu có)
    if (table && table.rows.length) {
      const { el: tableEl, cleanup: cleanupTable } =
        createOffscreenContainer(containerWidthPx);
      try {
        tableEl.innerHTML = buildTableHtml(table);
        const tableCanvas = await captureElement(tableEl);
        addCanvasToPdf(pdf, tableCanvas, true);
      } finally {
        cleanupTable();
      }
    }

    // Footer — vẽ sau cùng để biết tổng số trang
    drawFooter(pdf);

    const out = filename ?? makeDefaultFilename(pageTitle, 'pdf');
    pdf.save(out);
  } finally {
    cleanupHeader();
  }
}
