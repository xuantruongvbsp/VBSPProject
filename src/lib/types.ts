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
  thoiHanVay: number;
  laiSuat: number;
  hinhThucVay: string;
  tinhTrangMonVay: string;

  // Sản phẩm / Chương trình
  maChuongTrinh: string;
  tenChuongTrinh: string;
  maQuyetDinh: string;
  tenQuyetDinh: string;
  nguonVon: string;

  // Số tiền
  mucVay: number;
  tongGiaiNgan: number;
  duNoTrongHan: number;
  duNoQuaHan: number;
  duNoKhoanh: number;
  tongDuNo: number;
  gocDaTra: number;

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

  // Khác
  ngayGiaoDichGanNhat: Date | null;
  ngaySoLieu: Date | null;

  // Tham chiếu nguyên gốc (để hiển thị chi tiết toàn bộ 174 trường)
  raw: Record<string, unknown>;
}

export interface ImportResult {
  rows: LoanRecord[];
  ngaySoLieu: Date | null;
  totalRows: number;
}
