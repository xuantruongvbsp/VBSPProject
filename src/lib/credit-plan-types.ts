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
  /** Nếu truyền nq11Ids cho parser — đây là kết quả match theo xã */
  nq11MatchByXa?: Nq11MatchXa[];
}

/** Thu hồi NQ11 theo xã — kết quả match giữa SK_GQVL và Báo cáo 31 */
export interface Nq11MatchXa {
  maXa: string;
  tenXa: string;
  /** Tổng dư nợ của các món NQ11 đã match trong Báo cáo 31 hiện tại */
  matchedTongDuNo: number;
  /** Số món NQ11 tìm thấy trong Báo cáo 31 */
  matchedSoMon: number;
  /** Số món trong SK_GQVL nhưng KHÔNG tìm thấy trong Báo cáo 31
   *  (thường là đã tất toán — coi như thu hồi hoàn toàn) */
  missingSoMon: number;
}

/** Tóm tắt file SK_GQVL (loan-level, phân nhóm theo xã).
 *  Cần split theo CAPQLV để biết trừ từ 03A hay 03B khi merge vào báo cáo. */
export interface Nq11XaSummary {
  maXa: string;
  tenXa: string;
  /** Tổng NQ11 của xã (tất cả loan trong xã) */
  tongDuNo: number;
  duNoTrongHan: number;
  duNoQuaHan: number;
  duNoKhoanh: number;
  tongGiaiNgan: number;
  soMonVay: number;
  /** Phần bắt nguồn từ Cấp QLV ≠ 21 (sẽ trừ từ 03A) */
  from03A_tongDuNo: number;
  from03A_duNoTrongHan: number;
  from03A_duNoQuaHan: number;
  from03A_duNoKhoanh: number;
  from03A_tongGiaiNgan: number;
  from03A_soMonVay: number;
  /** Phần bắt nguồn từ Cấp QLV = 21 (sẽ trừ từ 03B) */
  from03B_tongDuNo: number;
  from03B_duNoTrongHan: number;
  from03B_duNoQuaHan: number;
  from03B_duNoKhoanh: number;
  from03B_tongGiaiNgan: number;
  from03B_soMonVay: number;
  /** Danh sách Mã món vay thuộc xã này (theo thứ tự trong file) */
  monVayIds: string[];
}

/** Kết quả parse file SK_GQVL */
export interface Nq11ImportResult {
  summariesByXa: Nq11XaSummary[];
  monVayIds: string[];
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
 *   03N = Món vay NQ11 (không được cho vay quay vòng) — tách ra từ 03A/03B
 */
export const CHUONG_TRINH_LIST = [
  { ma: '01', ten: 'Cho vay ưu đãi hộ nghèo' },
  { ma: '02', ten: 'Cho vay hộ cận nghèo theo QĐ 15' },
  { ma: '03A', ten: 'Cho vay GQVL — Ngân sách TW cấp' },
  { ma: '03B', ten: 'Cho vay GQVL — NHCSXH huy động' },
  { ma: '03N', ten: 'Cho vay GQVL — NQ11' },
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
