// Mô hình dữ liệu chuẩn hóa cho một khế ước tín dụng (1 dòng = 1 khế ước)

export interface LoanRecord {
  // Đơn vị
  maCN: string;
  maPGD: string;
  tenPGD: string;
  maXa: string;
  tenXa: string;
  maThon: string;
  tenThon: string;

  // Khách hàng
  maKH: string;
  tenKH: string;
  ngaySinh: Date | null;
  phanLoai: string;
  loaiKH: string;
  gioiTinh: string;
  maDanToc: string;
  tenDanToc: string;
  soCMND: string;
  noiCapCMND: string;
  diaChi: string;
  soDienThoai: string;

  // Tổ TK&VV
  maTo: string;
  loaiTo: string;
  tenTo: string;

  // Đơn vị ủy thác (Hội Đoàn thể)
  maDVUT: string;
  tenDVUT: string;

  // Khế ước
  soKheUoc: string;
  ngayVay: Date | null;
  ngayDHHopDong: Date | null;
  ngayDHGiaHan: Date | null;
  ngayDHGDXA: Date | null;
  /** Giữ nguyên chữ trong Báo cáo 31 ("Ngắn hạn"/"Trung hạn"/"Dài hạn"). */
  thoiHanVay: string;
  laiSuat: number;
  hinhThucVay: string;
  tinhTrangMonVay: string;

  // Sản phẩm / Chương trình
  maChuongTrinh: string;
  tenChuongTrinh: string;
  maQuyetDinh: string;
  tenQuyetDinh: string;
  nguonVon: string;
  /** Đối tượng thụ hưởng (cột "Tên ĐTTH"). */
  tenDTTH: string;

  // Số tiền
  mucVay: number;
  tongGiaiNgan: number;
  duNoTrongHan: number;
  duNoQuaHan: number;
  duNoKhoanh: number;
  tongDuNo: number;
  gocDaTra: number;
  /** Số dư tiền gửi tiết kiệm 105 — chỉ tiêu cấp khách hàng (lặp trên các
   *  dòng khế ước của cùng 1 KH). Khi tổng hợp phải dedupe theo `maKH` để
   *  không cộng lặp nhiều lần. */
  soDuTienGui105: number;

  // Lãi
  tongThuLaiTH: number;
  laiTonTH: number;
  tongThuLaiQH: number;
  laiTonQH: number;
  laiDTChuaDenHan: number;
  thuLaiTHThang: number;
  thuLaiQHThang: number;

  // Giải ngân / hoạt động trong tháng
  giaiNganTrongThang: number;
  thuNoTHThang: number;
  thuNoQHThang: number;

  // Biến động NPL theo Tháng
  chuyenQHThang: number;
  chuyenKhoanhThang: number;
  thuNoKhoanhThang: number;
  gocXoaThang: number;

  // Biến động NPL theo Quý
  chuyenQHQuy: number;
  chuyenKhoanhQuy: number;
  thuNoQHQuy: number;
  thuNoKhoanhQuy: number;
  gocXoaQuy: number;

  // Biến động NPL theo Năm
  chuyenQHNam: number;
  chuyenKhoanhNam: number;
  thuNoQHNam: number;
  thuNoKhoanhNam: number;
  gocXoaNam: number;

  // Khác
  ngayGiaoDichGanNhat: Date | null;
  ngaySoLieu: Date | null;
  /** Ngày hết hạn khoanh nợ — chỉ có ý nghĩa với khế ước có duNoKhoanh > 0. */
  ngayHetHanKhoanh: Date | null;

  // LƯU Ý: KHÔNG còn trường `raw` (bản sao 174 cột gốc). Mỗi bản sao là một
  // object ~350 khóa/dòng → 15k dòng ≈ 200 MB khi structured-clone từ worker
  // sang main thread và khi ghi IndexedDB — nguyên nhân Chrome "Wait or Exit"
  // lúc nhập sao kê. Mọi cột cần hiển thị đã được type hóa ở trên; cache
  // IndexedDB cũ còn `raw` được dọn bằng `upgradeLegacyRows()` trong
  // `lib/loan-record-compat.ts`.
}

export interface ImportResult {
  rows: LoanRecord[];
  ngaySoLieu: Date | null;
  totalRows: number;
}

/**
 * Cán bộ tín dụng phụ trách. Mỗi cán bộ phụ trách nhiều **Điểm giao dịch**
 * (ĐGD). Danh sách Mã thôn của cán bộ được suy ra từ tổng các Mã thôn
 * thuộc các ĐGD họ phụ trách (nguồn: useTxnPointStore).
 */
export interface StaffRecord {
  id: string;
  maNV: string;
  tenNV: string;
  /** Danh sách Mã ĐGD (mã, không phải id) cán bộ phụ trách. */
  maDGDs: string[];
}

/**
 * Điểm giao dịch (ĐGD) — cấp dưới của Xã, một ĐGD bao gồm nhiều Mã thôn.
 * Dùng để lọc các báo cáo theo địa bàn ĐGD phụ trách.
 */
export interface TxnPointRecord {
  id: string;
  maDGD: string;
  tenDGD: string;
  maThons: string[];
}
