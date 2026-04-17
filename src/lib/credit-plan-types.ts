/** Một dòng trong kế hoạch tín dụng (nhập thủ công hoặc parse từ PDF) */
export interface PlanEntry {
  id: string;
  soQD: string;         // Số Quyết Định
  ngayQD: string;       // Ngày Quyết Định (yyyy-mm-dd)
  tenQD: string;        // Tên Quyết Định
  maXa: string;         // Mã xã
  tenXa: string;        // Tên xã
  maNguonVon: string;   // 1 = Trung ương, 2 = Địa phương
  maChuongTrinh: string;
  tenChuongTrinh: string;
  soTien: number;       // Triệu đồng
}

/** Tóm tắt thực tế theo nhóm (maXa + maNguonVon + maChuongTrinh) */
export interface ActualSummary {
  maXa: string;
  tenXa: string;
  maNguonVon: string;
  maChuongTrinh: string;
  tenChuongTrinh: string;
  tongDuNo: number;       // Tổng dư nợ
  duNoTrongHan: number;
  duNoQuaHan: number;
  duNoKhoanh: number;
  soMonVay: number;       // Số món vay
  tongGiaiNgan: number;
}

/** Kết quả parse file thực tế */
export interface ActualImportResult {
  summaries: ActualSummary[];
  ngaySoLieu: string | null;
  totalRows: number;
}

/** So sánh plan vs actual cho 1 nhóm */
export interface PlanVsActual {
  maXa: string;
  tenXa: string;
  maNguonVon: string;
  maChuongTrinh: string;
  tenChuongTrinh: string;
  planAmount: number;    // Kế hoạch (triệu đồng)
  actualAmount: number;  // Thực tế dư nợ (triệu đồng)
  diff: number;          // actual - plan
  pct: number;           // (actual / plan) * 100
}

/** Danh sách xã cố định (Định Quán) */
export const XA_LIST: { maXa: string; tenXa: string }[] = [
  { maXa: '460025', tenXa: 'La Ngà' },
  { maXa: '460044', tenXa: 'Phú Hòa' },
  { maXa: '460050', tenXa: 'Phú Vinh' },
  { maXa: '460060', tenXa: 'Thanh Sơn' },
  { maXa: '460092', tenXa: 'Định Quán' },
];

/** Nguồn vốn */
export const NGUON_VON_LIST = [
  { ma: '1', ten: 'Trung ương' },
  { ma: '2', ten: 'Địa phương' },
];

/** Chương trình cho vay
 * CT 03 (GQVL) với NV=1 (Trung ương) được tách thành:
 *   03A = Nguồn Ngân sách TW cấp (Cấp QLV ≠ NHCSXH)
 *   03B = Nguồn NHCSXH huy động  (Cấp QLV = 21/NHCSXH)
 */
export const CHUONG_TRINH_LIST = [
  { ma: '01', ten: 'Cho vay ưu đãi hộ nghèo' },
  { ma: '02', ten: 'Cho vay hộ cận nghèo theo QĐ 15' },
  { ma: '03A', ten: 'Cho vay GQVL — Ngân sách TW cấp' },
  { ma: '03B', ten: 'Cho vay GQVL — NHCSXH huy động' },
  { ma: '03', ten: 'Cho vay giải quyết việc làm (gộp)', hidden: true },
  { ma: '04', ten: 'Cho vay hộ mới thoát nghèo theo QĐ 28' },
  { ma: '06', ten: 'Cho vay nước sạch và vệ sinh môi trường nông thôn' },
  { ma: '07', ten: 'Cho vay ĐTCS đi lao động có thời hạn ở nước ngoài' },
  { ma: '09', ten: 'Cho vay học sinh, sinh viên có hoàn cảnh khó khăn' },
  { ma: '12', ten: 'Cho vay hộ nghèo về nhà ở' },
  { ma: '17', ten: 'Cho vay hộ đồng bào DTTS nghèo, đời sống khó khăn theo QĐ 755' },
  { ma: '19', ten: 'Cho vay nhà ở xã hội theo Nghị định số 100' },
  { ma: '26', ten: 'Cho vay người chấp hành xong án phạt tù' },
  { ma: 'STEM', ten: 'Cho vay HSSV các ngành học STEM' },
  { ma: '99', ten: 'Cho vay khác' },
] as const satisfies readonly { ma: string; ten: string; hidden?: boolean }[];

/** Danh sách chương trình hiển thị (ẩn mục gộp 03) */
export const CHUONG_TRINH_VISIBLE = CHUONG_TRINH_LIST.filter((c) => !('hidden' in c && c.hidden));

export function nguonVonLabel(ma: string): string {
  return NGUON_VON_LIST.find((n) => n.ma === ma)?.ten ?? ma;
}

export function chuongTrinhLabel(ma: string): string {
  return CHUONG_TRINH_LIST.find((c) => c.ma === ma)?.ten ?? ma;
}

export function xaLabel(ma: string): string {
  return XA_LIST.find((x) => x.maXa === ma)?.tenXa ?? ma;
}
