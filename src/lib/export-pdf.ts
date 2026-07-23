// Xuất báo cáo PDF (.pdf) cho webapp VSPPRO — bản "text gốc"
//
// Chiến lược MỚI (khác hẳn bản cũ chụp ảnh):
//  - Nhúng font Roboto (hỗ trợ đầy đủ dấu tiếng Việt) vào jsPDF, nhờ đó
//    toàn bộ tiêu đề / KPI / bảng số liệu là VĂN BẢN THẬT — chọn, copy,
//    tìm kiếm được; file nhẹ; dán thẳng vào báo cáo chính thức.
//  - Bảng số liệu dựng bằng `jspdf-autotable` (text thật, tự phân trang).
//  - Biểu đồ vẫn là ảnh (html2canvas) — chèn ở CUỐI báo cáo, dạng phụ lục,
//    vì biểu đồ không thể là "text". Có thể tắt qua `includeCharts: false`.
//
// Lý do bỏ cách cũ (rasterize toàn trang bằng html2canvas): file chỉ là
// ảnh bitmap → không copy được số liệu, không dùng lại được cho công văn.

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
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

export interface PdfTable {
  title: string;
  columns: PdfTableColumn[];
  rows: Record<string, unknown>[];
}

export interface PdfExportInput {
  /** Tiêu đề trang */
  pageTitle: string;
  /** Phụ đề tùy chọn (ví dụ: "Snapshot 28/03/2026 — 15.356 khế ước") */
  subtitle?: string;
  /** Bộ chỉ tiêu KPI đã tính sẵn */
  kpi: PortfolioKpi;
  /** Nhiều bảng số liệu (text thật) — xuất theo thứ tự truyền vào */
  tables?: PdfTable[];
  /** Bảng đơn (giữ lại cho tương thích ngược) */
  table?: PdfTable;
  /** Các phần tử DOM sẽ được chụp làm ảnh (biểu đồ), chèn ở cuối */
  chartElements?: HTMLElement[];
  /** Có chèn biểu đồ (ảnh) hay không — mặc định `true` */
  includeCharts?: boolean;
  /** Tên tệp, nếu bỏ trống sẽ tự sinh theo ngày giờ hiện tại */
  filename?: string;
}

// ----- Nhúng font Roboto (hỗ trợ tiếng Việt) ------------------------------
// Font đặt tại `public/fonts/`, chỉ tải khi người dùng bấm "Xuất PDF" nên
// không làm phình bundle chính. Kết quả base64 được cache theo module.

const FONT_FAMILY = 'Roboto';
const FONT_REGULAR_FILE = 'Roboto-Regular.ttf';
const FONT_BOLD_FILE = 'Roboto-Bold.ttf';

let fontCache: { regular: string; bold: string } | null = null;

/** Chuyển ArrayBuffer → base64 (theo khối để tránh tràn stack). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return btoa(binary);
}

async function fetchFontBase64(file: string): Promise<string> {
  // Tôn trọng `base` của Vite nếu có (mặc định '/'). Truy cập qua cast vì dự
  // án chưa khai báo type cho `import.meta.env`.
  const baseUrl =
    (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ??
    '/';
  const url = `${baseUrl}fonts/${file}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Không tải được font PDF (${file}): HTTP ${res.status}`);
  }
  return arrayBufferToBase64(await res.arrayBuffer());
}

async function loadFonts(): Promise<{ regular: string; bold: string }> {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    fetchFontBase64(FONT_REGULAR_FILE),
    fetchFontBase64(FONT_BOLD_FILE),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

/** Đăng ký font Roboto (normal + bold) vào một instance jsPDF. */
async function registerFonts(pdf: jsPDF): Promise<void> {
  const { regular, bold } = await loadFonts();
  pdf.addFileToVFS(FONT_REGULAR_FILE, regular);
  pdf.addFont(FONT_REGULAR_FILE, FONT_FAMILY, 'normal');
  pdf.addFileToVFS(FONT_BOLD_FILE, bold);
  pdf.addFont(FONT_BOLD_FILE, FONT_FAMILY, 'bold');
  pdf.setFont(FONT_FAMILY, 'normal');
}

// ----- Bố cục trang (mm) --------------------------------------------------

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_X = 14;
const MARGIN_TOP = 16;
const MARGIN_BOTTOM = 14;
const CONTENT_W = A4_W_MM - MARGIN_X * 2;
const PAGE_BOTTOM = A4_H_MM - MARGIN_BOTTOM;

// Bảng màu (đồng bộ với giao diện)
const C_TEAL: [number, number, number] = [15, 118, 110];
const C_DARK: [number, number, number] = [15, 23, 42];
const C_GRAY: [number, number, number] = [71, 85, 105];
const C_MUTED: [number, number, number] = [100, 116, 139];
const C_ROSE: [number, number, number] = [190, 18, 60];
const C_HEAD_BG: [number, number, number] = [241, 245, 249];
const C_STRIPE: [number, number, number] = [248, 250, 252];

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

// ----- Các khối văn bản (native text) -------------------------------------

/** Vẽ header báo cáo, trả về con trỏ y sau header. */
function drawHeader(
  pdf: jsPDF,
  pageTitle: string,
  subtitle: string | undefined
): number {
  let y = MARGIN_TOP;

  pdf.setFont(FONT_FAMILY, 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...C_GRAY);
  pdf.text('NGÂN HÀNG CHÍNH SÁCH XÃ HỘI', MARGIN_X, y);
  y += 6.5;

  pdf.setFont(FONT_FAMILY, 'bold');
  pdf.setFontSize(17);
  pdf.setTextColor(...C_DARK);
  const titleLines = pdf.splitTextToSize(pageTitle, CONTENT_W);
  pdf.text(titleLines, MARGIN_X, y);
  y += titleLines.length * 7;

  if (subtitle) {
    pdf.setFont(FONT_FAMILY, 'normal');
    pdf.setFontSize(10.5);
    pdf.setTextColor(...C_GRAY);
    const subLines = pdf.splitTextToSize(subtitle, CONTENT_W);
    pdf.text(subLines, MARGIN_X, y);
    y += subLines.length * 5;
  }

  const now = new Date();
  const gen = `${fmtDate(now)} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
  pdf.setFont(FONT_FAMILY, 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...C_MUTED);
  pdf.text(`Ngày xuất báo cáo: ${gen}`, MARGIN_X, y);
  y += 3.5;

  // Đường kẻ ngang teal
  pdf.setDrawColor(...C_TEAL);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN_X, y, A4_W_MM - MARGIN_X, y);
  y += 6;

  return y;
}

/** Tiêu đề nhỏ cho từng khối (KPI / bảng). */
function drawSectionTitle(pdf: jsPDF, title: string, y: number): number {
  pdf.setFont(FONT_FAMILY, 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(...C_DARK);
  pdf.text(title, MARGIN_X, y);
  return y + 2;
}

/** Bảng "Tóm tắt chỉ tiêu" (2 cột: Chỉ tiêu | Giá trị). */
function drawKpiTable(pdf: jsPDF, kpi: PortfolioKpi, startY: number): number {
  const items = kpiItems(kpi);
  const accent = new Set<number>();
  items.forEach((it, i) => {
    if (it.accent) accent.add(i);
  });

  let y = drawSectionTitle(pdf, 'Tóm tắt chỉ tiêu', startY);
  y += 2;

  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN_X, right: MARGIN_X },
    theme: 'grid',
    head: [['Chỉ tiêu', 'Giá trị']],
    body: items.map((it) => [it.label, it.value]),
    styles: {
      font: FONT_FAMILY,
      fontSize: 9.5,
      cellPadding: { top: 1.6, bottom: 1.6, left: 3, right: 3 },
      textColor: C_DARK,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      font: FONT_FAMILY,
      fontStyle: 'bold',
      fillColor: C_TEAL,
      textColor: [255, 255, 255],
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: CONTENT_W * 0.6 },
      1: { cellWidth: CONTENT_W * 0.4, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && accent.has(data.row.index)) {
        data.cell.styles.textColor = C_ROSE;
      }
    },
  });

  return (lastFinalY(pdf) ?? y) + 8;
}

/** Bảng số liệu chung. */
function drawDataTable(pdf: jsPDF, table: PdfTable, startY: number): number {
  if (!table.rows.length) return startY;

  let y = drawSectionTitle(pdf, table.title, startY);
  y += 2;

  const head = [table.columns.map((c) => c.header)];
  const body = table.rows.map((row) =>
    table.columns.map((c) => {
      const v = row[c.key];
      return v === null || v === undefined ? '' : String(v);
    })
  );

  const columnStyles: Record<number, { halign?: 'left' | 'right' | 'center' }> = {};
  table.columns.forEach((c, i) => {
    if (c.align) columnStyles[i] = { halign: c.align };
  });

  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN_X, right: MARGIN_X },
    theme: 'striped',
    head,
    body,
    styles: {
      font: FONT_FAMILY,
      fontSize: 8.5,
      cellPadding: { top: 1.4, bottom: 1.4, left: 2.5, right: 2.5 },
      textColor: C_DARK,
      overflow: 'linebreak',
    },
    headStyles: {
      font: FONT_FAMILY,
      fontStyle: 'bold',
      fillColor: C_HEAD_BG,
      textColor: [51, 65, 85],
      lineColor: [203, 213, 225],
      lineWidth: { top: 0, right: 0, bottom: 0.2, left: 0 },
    },
    alternateRowStyles: { fillColor: C_STRIPE },
    columnStyles,
  });

  return (lastFinalY(pdf) ?? y) + 8;
}

// ----- Biểu đồ (ảnh, phụ lục) --------------------------------------------

/** Lấy con trỏ y sau bảng autotable gần nhất (không có trong .d.ts của v5). */
function lastFinalY(pdf: jsPDF): number | undefined {
  return (pdf as unknown as { lastAutoTable?: { finalY?: number } })
    .lastAutoTable?.finalY;
}

/**
 * Chuẩn hoá neo văn bản SVG trên bản sao DOM mà html2canvas dùng để render.
 *
 * html2canvas thường bỏ qua `text-anchor`/`dominant-baseline` khai báo dạng
 * THUỘC TÍNH SVG (ví dụ nhãn trục Y nhiều dòng của BarByGroup) — nó đọc CSS
 * inline đáng tin hơn. Hàm này chỉ ÁP DỤNG BỔ SUNG inline style tương ứng,
 * không đổi giá trị, nên vô hại với các chart khác (idempotent, không có
 * text-anchor/dominant-baseline attribute thì không đụng tới).
 */
function normalizeSvgTextForCapture(root: Document): void {
  const nodes = root.querySelectorAll('text, tspan');
  nodes.forEach((node) => {
    const anchor = node.getAttribute('text-anchor');
    if (anchor && !(node as HTMLElement).style.textAnchor) {
      (node as HTMLElement).style.textAnchor = anchor;
    }
    const baseline = node.getAttribute('dominant-baseline');
    if (baseline && !(node as HTMLElement).style.dominantBaseline) {
      (node as HTMLElement).style.dominantBaseline = baseline;
    }
  });
}

async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  return html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    logging: false,
    useCORS: true,
    onclone: (clonedDoc) => normalizeSvgTextForCapture(clonedDoc),
  });
}

/**
 * Suy ra "tên biểu đồ" từ DOM: id `chart-*` nằm trên `CardContent`, còn tiêu
 * đề (CardTitle = <h3>) nằm ở `CardHeader` — là anh/chị em phía trước. Leo dần
 * lên và soi các phần tử đứng trước để lấy <h3> gần nhất. Nhờ đó không cần mỗi
 * trang tự khai báo tên biểu đồ.
 */
function chartTitleFromDom(el: HTMLElement): string | undefined {
  let node: HTMLElement | null = el;
  for (let depth = 0; node && depth < 4; depth++) {
    let sib = node.previousElementSibling;
    while (sib) {
      const h =
        sib.tagName === 'H3'
          ? sib
          : sib.querySelector('h1, h2, h3, h4');
      const text = h?.textContent?.replace(/\s+/g, ' ').trim();
      if (text) return text;
      sib = sib.previousElementSibling;
    }
    node = node.parentElement;
  }
  return undefined;
}

/**
 * Chèn các biểu đồ (ảnh) theo dòng chảy: xếp nhiều biểu đồ trên một trang
 * nếu còn chỗ, chỉ sang trang mới khi không đủ. Trả về con trỏ y cuối.
 */
const CAPTION_LINE_H = 5; // mm mỗi dòng tên biểu đồ

async function drawCharts(
  pdf: jsPDF,
  charts: HTMLElement[],
  startY: number
): Promise<number> {
  let y = startY;
  let first = true;
  let index = 0;

  for (const chart of charts) {
    if (!chart) continue;
    index += 1;

    // Tên biểu đồ (text thật) — lấy từ DOM, có số thứ tự để dễ tham chiếu.
    const domTitle = chartTitleFromDom(chart);
    const caption = `Biểu đồ ${index}${domTitle ? `. ${domTitle}` : ''}`;
    pdf.setFont(FONT_FAMILY, 'bold');
    pdf.setFontSize(10);
    const captionLines = pdf.splitTextToSize(caption, CONTENT_W);
    const captionH = captionLines.length * CAPTION_LINE_H + 1.5;

    const canvas = await captureElement(chart);
    let w = CONTENT_W;
    let h = (canvas.height * w) / canvas.width;
    // Không để (tên + biểu đồ) cao quá một trang — thu nhỏ ảnh giữ tỷ lệ.
    const maxImgH = PAGE_BOTTOM - MARGIN_TOP - captionH;
    if (h > maxImgH) {
      const scale = maxImgH / h;
      h *= scale;
      w *= scale;
    }

    if (first) {
      y = drawSectionTitle(pdf, 'Biểu đồ minh họa', y) + 4;
      first = false;
    }

    // Giữ tên + ảnh cùng một trang: nếu không đủ chỗ thì sang trang mới.
    if (y + captionH + h > PAGE_BOTTOM) {
      pdf.addPage();
      y = MARGIN_TOP;
    }

    pdf.setFont(FONT_FAMILY, 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...C_DARK);
    pdf.text(captionLines, MARGIN_X, y + CAPTION_LINE_H - 1);
    y += captionH;

    const x = MARGIN_X + (CONTENT_W - w) / 2;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h);
    y += h + 7;
  }

  return y;
}

/** Vẽ footer (tên hệ thống + số trang) cho tất cả các trang. */
function drawFooter(pdf: jsPDF): void {
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont(FONT_FAMILY, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...C_MUTED);
    const y = A4_H_MM - 7;
    pdf.text('Hệ thống VSPPRO', MARGIN_X, y);
    pdf.text(`Trang ${i}/${pageCount}`, A4_W_MM - MARGIN_X, y, {
      align: 'right',
    });
  }
}

// ----- API chính ----------------------------------------------------------

/**
 * Xuất báo cáo PDF (text gốc) và kích hoạt tải xuống.
 * Header / KPI / bảng số liệu là văn bản thật (chọn & copy được);
 * biểu đồ (nếu có) được chèn ở cuối dưới dạng ảnh phụ lục.
 */
export async function exportToPdf(input: PdfExportInput): Promise<void> {
  const {
    pageTitle,
    subtitle,
    kpi,
    tables,
    table,
    chartElements,
    includeCharts = true,
    filename,
  } = input;

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  await registerFonts(pdf);

  // 1) Header
  let y = drawHeader(pdf, pageTitle, subtitle);

  // 2) Tóm tắt KPI
  y = drawKpiTable(pdf, kpi, y);

  // 3) Bảng số liệu (autotable tự phân trang; chỉ cần đặt con trỏ đầu)
  const allTables: PdfTable[] = [
    ...(tables ?? []),
    ...(table ? [table] : []),
  ];
  for (const t of allTables) {
    // Nếu tiêu đề bảng sát đáy trang thì sang trang mới cho gọn.
    if (y > PAGE_BOTTOM - 24) {
      pdf.addPage();
      y = MARGIN_TOP;
    }
    y = drawDataTable(pdf, t, y);
  }

  // 4) Biểu đồ (ảnh) — phụ lục cuối báo cáo
  if (includeCharts && chartElements && chartElements.length) {
    pdf.addPage();
    await drawCharts(pdf, chartElements, MARGIN_TOP);
  }

  // 5) Footer sau cùng (đã biết tổng số trang)
  drawFooter(pdf);

  const out = filename ?? makeDefaultFilename(pageTitle, 'pdf');
  pdf.save(out);
}
