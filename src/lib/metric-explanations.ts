/**
 * Diễn giải chi tiết các chỉ tiêu KPI trên trang Tổng quan.
 *
 * Mỗi chỉ tiêu cung cấp:
 *  - title:      Tên chính thức của chỉ tiêu
 *  - definition: Định nghĩa ngắn gọn
 *  - formula:    Cách tính dựa trên Báo cáo 31
 *  - note:       Ghi chú, lưu ý diễn giải (tùy chọn)
 */

export interface MetricExplanation {
  title: string;
  definition: string;
  formula: string;
  note?: string;
}

export const METRIC_EXPLANATIONS: Record<string, MetricExplanation> = {
  tongDuNo: {
    title: 'Tổng dư nợ',
    definition:
      'Tổng số tiền gốc khách hàng còn phải trả tại thời điểm chốt số liệu, bao gồm toàn bộ các khế ước đang có hiệu lực trong danh mục tín dụng.',
    formula:
      'Cộng dồn cột "Dư nợ" trên Báo cáo 31 theo từng khế ước, sau khi đã áp dụng bộ lọc hiện hành (chi nhánh, phòng giao dịch, chương trình, đơn vị ủy thác, trạng thái nợ).',
    note: 'Chỉ tiêu phản ánh quy mô danh mục cho vay tại ngày báo cáo. Không bao gồm nợ đã tất toán.',
  },
  khachHang: {
    title: 'Số khách hàng',
    definition:
      'Số lượng khách hàng riêng biệt còn dư nợ đang hoạt động tại thời điểm chốt số liệu, sau khi đã khử trùng lặp theo mã khách hàng.',
    formula:
      'Đếm số giá trị duy nhất của trường "Mã khách hàng" trên các khế ước có Tình trạng món vay khác rỗng và khác "close". Một khách hàng vay nhiều khế ước chỉ được tính một lần.',
    note: 'Khế ước đã tất toán (Tình trạng món vay = "close") hoặc không có trạng thái sẽ không đóng góp vào số khách hàng. Một khách hàng có thể có nhiều khế ước ở các chương trình khác nhau.',
  },
  giaiNganLuyKe: {
    title: 'Tổng giải ngân lũy kế',
    definition:
      'Tổng số tiền đã giải ngân cộng dồn cho toàn bộ các khế ước trong danh mục kể từ ngày phát sinh cho đến thời điểm chốt số liệu.',
    formula:
      'Cộng dồn cột "Số tiền cho vay" (số tiền ký hợp đồng, tức dư nợ ban đầu) của toàn bộ khế ước trên Báo cáo 31 sau khi đã áp dụng bộ lọc.',
    note: 'Chỉ tiêu phản ánh quy mô vốn đã đưa ra nền kinh tế, không phản ánh số dư còn lại tại thời điểm hiện tại.',
  },
  mucVayBinhQuan: {
    title: 'Mức vay bình quân',
    definition:
      'Dư nợ bình quân trên mỗi khách hàng đang còn dư nợ — phản ánh quy mô vay bình quân của một khách hàng trong danh mục.',
    formula:
      'Mức vay bình quân = Tổng dư nợ / Số khách hàng. Số khách hàng là số mã khách hàng riêng biệt trên Báo cáo 31 sau khi đã áp dụng bộ lọc.',
    note: 'Chỉ tiêu tính trên khách hàng, không phải trên khế ước — một khách hàng có thể có nhiều khế ước và chỉ được đếm một lần.',
  },
  duNoQuaHan: {
    title: 'Dư nợ quá hạn',
    definition:
      'Phần dư nợ gốc đã đến hạn trả nhưng khách hàng chưa thanh toán, được chuyển sang trạng thái theo dõi quá hạn theo quy định của NHCSXH.',
    formula:
      'Cộng dồn cột "Dư nợ quá hạn" trên Báo cáo 31 theo từng khế ước, sau khi áp dụng bộ lọc hiện hành.',
    note: 'Tỷ lệ nợ quá hạn trên tổng dư nợ là một trong những chỉ báo chính về chất lượng tín dụng của danh mục.',
  },
  duNoKhoanh: {
    title: 'Dư nợ khoanh',
    definition:
      'Phần dư nợ được cấp có thẩm quyền cho phép khoanh lại (tạm thời không thu hồi, không tính lãi phạt) do khách hàng gặp rủi ro bất khả kháng theo quy định hiện hành.',
    formula:
      'Cộng dồn cột "Dư nợ khoanh" trên Báo cáo 31 theo từng khế ước, sau khi áp dụng bộ lọc hiện hành.',
    note: 'Nợ khoanh vẫn thuộc danh mục theo dõi nhưng tạm thời không tính vào chỉ tiêu thu hồi trong kỳ.',
  },
  laiTonTrongHan: {
    title: 'Lãi tồn trong hạn',
    definition:
      'Số tiền lãi đã phát sinh nhưng khách hàng chưa nộp tại thời điểm chốt số liệu, đối với các khế ước vẫn còn trong hạn trả nợ.',
    formula:
      'Cộng dồn cột "Lãi tồn trong hạn" (hoặc cột tương đương trên Báo cáo 31) theo từng khế ước, sau khi áp dụng bộ lọc hiện hành.',
    note: 'Chỉ tiêu giúp theo dõi khả năng thu lãi định kỳ và cảnh báo sớm các khế ước có dấu hiệu chậm trả.',
  },
  laiSuatBinhQuan: {
    title: 'Lãi suất bình quân',
    definition:
      'Mức lãi suất bình quân gia quyền theo dư nợ của toàn bộ khế ước trong danh mục, phản ánh chi phí vốn bình quân của danh mục cho vay.',
    formula:
      'Lãi suất bình quân = Tổng (Lãi suất của khế ước × Dư nợ của khế ước) / Tổng dư nợ. Lãi suất và dư nợ được lấy trực tiếp từ Báo cáo 31 sau khi áp dụng bộ lọc.',
    note: 'Do tính theo bình quân gia quyền, các khế ước có dư nợ lớn sẽ ảnh hưởng nhiều hơn tới kết quả so với các khế ước có dư nợ nhỏ.',
  },

  // ─── Diễn giải các biểu đồ trên trang Tổng quan ───────────────────────────

  chartDvut: {
    title: 'Dư nợ theo Đơn vị ủy thác',
    definition:
      'Cơ cấu dư nợ theo bốn tổ chức chính trị – xã hội nhận ủy thác: HLHPN, HND, HCCB, ĐTN.',
    formula:
      'Tổng hợp dư nợ theo cột "Đơn vị ủy thác" trên Báo cáo 31 sau khi áp dụng bộ lọc.',
    note: 'Cho thấy tổ chức nào đang quản lý phần lớn dư nợ ủy thác.',
  },
  chartProgram: {
    title: 'Dư nợ theo Chương trình tín dụng',
    definition:
      'Phân bố dư nợ giữa các chương trình tín dụng chính sách (hộ nghèo, GQVL, HSSV, NS&VSMTNT, …).',
    formula:
      'Tổng hợp dư nợ theo cột "Chương trình" trên Báo cáo 31 sau khi áp dụng bộ lọc.',
    note: 'Giúp đánh giá mức độ tập trung vốn vào từng chương trình mục tiêu.',
  },
  chartXa: {
    title: 'Dư nợ theo Xã',
    definition:
      'So sánh quy mô dư nợ giữa các xã/phường trên địa bàn, lấy 10 đơn vị có dư nợ lớn nhất.',
    formula:
      'Tổng hợp dư nợ theo cột "Xã/Phường" trên Báo cáo 31, sắp xếp giảm dần và lấy Top 10.',
    note: 'Phản ánh mức độ phân bổ vốn theo địa bàn; bấm vào cột để lọc nhanh danh mục theo xã.',
  },
  chartPgd: {
    title: 'Dư nợ theo Phòng giao dịch',
    definition:
      'So sánh quy mô dư nợ giữa các phòng giao dịch trực thuộc chi nhánh, lấy 12 đơn vị có dư nợ lớn nhất.',
    formula:
      'Tổng hợp dư nợ theo cột "Phòng giao dịch", sắp xếp giảm dần và lấy Top 12.',
    note: 'Phản ánh tỷ trọng đóng góp của từng phòng giao dịch vào tổng danh mục.',
  },
  chartHistogram: {
    title: 'Phân bố mức vay',
    definition:
      'Số khế ước phân theo các khoảng giá trị mức vay (dưới 50 triệu, 50–100 triệu, …).',
    formula:
      'Đếm số khế ước rơi vào từng khoảng dư nợ, dữ liệu lấy từ Báo cáo 31 đã lọc.',
    note: 'Giúp nhận diện nhóm khế ước phổ biến và các khoản vay quy mô lớn.',
  },
  chartTimeSeries: {
    title: 'Giải ngân theo thời gian',
    definition:
      'Tổng số tiền giải ngân của các khế ước theo từng tháng, dựa trên ngày phát sinh.',
    formula:
      'Cộng dồn "Số tiền cho vay" theo tháng của ngày giải ngân, sau khi áp dụng bộ lọc.',
    note: 'Cho thấy nhịp độ giải ngân và các tháng cao điểm trong kỳ.',
  },
  chartCustomerStructure: {
    title: 'Cơ cấu khách hàng',
    definition:
      'Tỷ trọng số khách hàng theo phân loại hộ vay, giới tính hoặc dân tộc.',
    formula:
      'Đếm số khách hàng riêng biệt theo trường được chọn từ menu trên biểu đồ.',
    note: 'Hỗ trợ phân tích cơ cấu đối tượng vay vốn chính sách.',
  },
  chartMaturity: {
    title: 'Lịch đáo hạn theo tháng',
    definition:
      'Số khế ước đến hạn trả nợ phân theo tháng và năm trong tương lai.',
    formula:
      'Đếm số khế ước theo cột "Ngày ĐH theo GDXA" trên Báo cáo 31, nhóm theo năm – tháng. Khế ước không có ngày GDXA được bỏ qua.',
    note: 'Ô càng đậm thể hiện áp lực thu hồi trong tháng đó càng lớn.',
  },
  chartTopCustomers: {
    title: 'Top 20 khách hàng theo dư nợ',
    definition:
      '20 khách hàng có tổng dư nợ lớn nhất tại thời điểm chốt số liệu.',
    formula:
      'Sắp xếp danh sách khế ước theo dư nợ giảm dần và lấy 20 dòng đầu.',
    note: 'Nhấp vào một dòng để mở chi tiết toàn bộ thông tin khế ước.',
  },
  chartDormantCustomers: {
    title: 'Khách hàng ngừng giao dịch',
    definition:
      'Danh sách khách hàng còn dư nợ nhưng đã không phát sinh giao dịch trong khoảng thời gian được chọn (2–3 tháng, 3–6 tháng, 6–12 tháng hoặc trên 12 tháng tính tới ngày chốt số liệu).',
    formula:
      'Gom nhóm theo mã khách hàng, lấy ngày giao dịch gần nhất trong tất cả khế ước của khách. Khoảng cách giữa ngày chốt số liệu và ngày giao dịch gần nhất được so sánh với khoảng tháng đã chọn để phân loại vào từng nhóm.',
    note: 'Sử dụng để nhận diện khách hàng có nguy cơ "ngủ đông", phục vụ kế hoạch tiếp cận, đôn đốc và giữ chân khách hàng. Chỉ tiêu thẻ KPI sử dụng ngưỡng từ 3 tháng trở lên.',
  },
  khachHangNgungGiaoDich: {
    title: 'Khách hàng ngừng giao dịch (≥ 3 tháng)',
    definition:
      'Số khách hàng còn dư nợ nhưng đã không phát sinh bất kỳ giao dịch nào trong ít nhất 3 tháng gần nhất tính tới ngày chốt số liệu.',
    formula:
      'Đếm số khách hàng riêng biệt có ngày giao dịch gần nhất cách ngày chốt số liệu từ 3 tháng trở lên (tính trên toàn bộ khế ước của khách).',
    note: 'Cảnh báo sớm về nguy cơ khách hàng "ngủ đông". Bảng chi tiết bên dưới phân nhóm theo các khoảng 2–3, 3–6, 6–12 và trên 12 tháng để dễ ưu tiên xử lý.',
  },

  // ─── Diễn giải các bảng/biểu đồ trên trang Báo cáo so sánh ────────────────

  compareDeltaTable: {
    title: 'Bảng đối chiếu chỉ tiêu',
    definition:
      'Bảng tổng hợp các chỉ tiêu chính của từng đối tượng được chọn so sánh.',
    formula:
      'Mỗi cột là một đối tượng; ▲/▼ là chênh lệch phần trăm so với đối tượng đầu tiên (gốc).',
    note: 'Với chỉ tiêu xấu hơn khi tăng (NQH, lãi tồn) hệ thống tự đảo màu xanh/đỏ.',
  },
  compareRadar: {
    title: 'Biểu đồ radar',
    definition:
      'So sánh trực quan nhiều chỉ tiêu cùng lúc giữa các đối tượng.',
    formula:
      'Mỗi chỉ tiêu được chuẩn hóa theo giá trị lớn nhất trong nhóm so sánh (max = 100).',
    note: 'Đối tượng có hình radar phủ rộng hơn = chỉ số tổng thể vượt trội hơn.',
  },
  compareProgramStructure: {
    title: 'Cơ cấu Chương trình tín dụng',
    definition:
      'Phân bố dư nợ theo từng chương trình tín dụng cho từng đối tượng được so sánh.',
    formula:
      'Cộng dư nợ theo cột "Chương trình" cho từng đối tượng đã chọn.',
    note: 'Giúp phát hiện đối tượng nào tập trung vào chương trình nào.',
  },
  compareRanking: {
    title: 'Xếp hạng theo từng chỉ tiêu',
    definition:
      'Thanh xếp hạng các đối tượng theo từng chỉ tiêu riêng lẻ.',
    formula:
      'Mỗi chỉ tiêu sắp xếp giảm dần (chỉ tiêu xấu khi tăng được sắp tăng dần).',
    note: 'Cho phép xác định nhanh đối tượng dẫn đầu hoặc tụt hậu ở từng chỉ tiêu.',
  },

  // ─── Diễn giải trang Tra cứu chi tiết ─────────────────────────────────────

  explorerTable: {
    title: 'Tra cứu chi tiết khế ước',
    definition:
      'Bảng dữ liệu toàn bộ khế ước sau khi áp dụng bộ lọc, hỗ trợ sắp xếp theo cột.',
    formula:
      'Dữ liệu lấy trực tiếp từ Báo cáo 31 đã lọc; ảo hóa hàng để xử lý hàng chục nghìn dòng.',
    note: 'Nhấp vào một dòng để mở chi tiết đầy đủ 174 trường thông tin của khế ước.',
  },

  // ─── Ứng dụng "So sánh giữa hai kỳ" ───────────────────────────────────────

  // Trang Diễn biến (Page 1)
  pagePeriodOverview: {
    title: 'Diễn biến danh mục giữa hai kỳ',
    definition:
      'Trang đầu tiên của ứng dụng so sánh — tổng hợp 8 KPI biến động chính, roll/cure rate, vòng đời khế ước & khách hàng, và cơ cấu chất lượng dư nợ giữa hai kỳ Báo cáo 31.',
    formula:
      'Mọi chỉ tiêu được tính trên hai tập dữ liệu (kỳ trước · kỳ sau) sau khi đã áp dụng bộ lọc đồng thời cho cả hai kỳ.',
    note: 'Bộ lọc trên FilterBar áp dụng đồng thời cho cả kỳ trước và kỳ sau để đảm bảo tính so sánh được.',
  },
  periodKpiDeltas: {
    title: '8 chỉ tiêu KPI biến động',
    definition:
      'Tám chỉ tiêu cốt lõi của danh mục được hiển thị dưới dạng thẻ DeltaCard, mỗi thẻ cho thấy giá trị kỳ sau, giá trị kỳ trước, chênh lệch tuyệt đối và phần trăm thay đổi.',
    formula:
      'Δ tuyệt đối = giá trị kỳ sau − giá trị kỳ trước. Δ% = Δ tuyệt đối / giá trị kỳ trước × 100.',
    note: 'Mũi tên xanh = tăng theo chiều có lợi; mũi tên đỏ = tăng theo chiều bất lợi. Quy ước này khác nhau theo từng chỉ tiêu (ví dụ Tổng dư nợ tăng = tốt, Dư nợ quá hạn tăng = xấu).',
  },
  periodRollRate: {
    title: 'Roll rate (tỷ lệ chuyển xấu)',
    definition:
      'Tỷ lệ giá trị dư nợ trong hạn ở kỳ trước bị chuyển sang quá hạn ở kỳ sau, tính theo dư nợ (value-weighted) chứ không phải theo số lượng khế ước.',
    formula:
      'Roll rate = Σ dư nợ quá hạn ở kỳ sau (của các khế ước vốn trong hạn ở kỳ trước) / Σ dư nợ trong hạn ở kỳ trước.',
    note: 'Là chỉ báo cảnh báo sớm về chất lượng tín dụng. Roll rate cao đồng nghĩa với dòng nợ xấu mới đang phát sinh nhanh.',
  },
  periodCureRate: {
    title: 'Cure rate (tỷ lệ phục hồi)',
    definition:
      'Tỷ lệ giá trị dư nợ quá hạn ở kỳ trước được phục hồi về trong hạn ở kỳ sau, đối ngẫu với roll rate.',
    formula:
      'Cure rate = Σ dư nợ trong hạn ở kỳ sau (của các khế ước vốn quá hạn ở kỳ trước) / Σ dư nợ quá hạn ở kỳ trước.',
    note: 'Cure rate cao = công tác đôn đốc thu hồi tốt; thấp = dòng nợ xấu cũ chưa được khắc phục.',
  },
  periodLifecycleLoans: {
    title: 'Vòng đời khế ước',
    definition:
      'Theo dõi sự thay đổi của tập khế ước giữa hai kỳ: bao nhiêu khế ước đã tất toán (chỉ có ở kỳ trước), bao nhiêu duy trì (cả hai kỳ), và bao nhiêu mới phát sinh (chỉ có ở kỳ sau).',
    formula:
      'Nối khế ước theo khóa (số khế ước + mã KH). Tổng kỳ trước = Tất toán + Duy trì. Tổng kỳ sau = Duy trì + Mới phát sinh.',
    note: 'Khóa nối được ghép từ số khế ước và mã khách hàng để tránh trùng lặp do số khế ước được tái sử dụng.',
  },
  periodLifecycleCustomers: {
    title: 'Vòng đời khách hàng',
    definition:
      'Theo dõi sự thay đổi của tập khách hàng giữa hai kỳ: bao nhiêu rời danh mục, bao nhiêu duy trì, bao nhiêu mới, và đặc biệt là bao nhiêu kích hoạt lại (im lặng ≥ 6 tháng nay quay lại vay).',
    formula:
      'Khách hàng kích hoạt lại = khách hàng có dư nợ ở kỳ sau, đồng thời trước đây đã không phát sinh giao dịch trong ít nhất 6 tháng tính tới ngày chốt số liệu kỳ trước.',
    note: 'Nhóm "kích hoạt lại" thường là khách hàng đã trả hết nợ một thời gian dài rồi quay lại vay vốn — tín hiệu tích cực cho công tác tiếp cận khách.',
  },
  periodQualityComposition: {
    title: 'Cơ cấu chất lượng dư nợ',
    definition:
      'So sánh tỷ trọng dư nợ trong hạn / quá hạn / khoanh giữa hai kỳ trên thanh xếp chồng (stacked bar).',
    formula:
      'Mỗi thanh = Σ dư nợ trong hạn + Σ dư nợ quá hạn + Σ dư nợ khoanh từ Báo cáo 31 đã lọc.',
    note: 'Chiều dài thanh phản ánh quy mô tổng dư nợ; tỷ lệ các phân đoạn phản ánh chất lượng tín dụng.',
  },

  // Trang Ma trận chuyển nhóm (Page 2)
  pagePeriodMigration: {
    title: 'Ma trận chuyển nhóm tình trạng',
    definition:
      'Bảng 4×4 cho biết bao nhiêu khế ước chuyển từ tình trạng dòng (kỳ trước) sang tình trạng cột (kỳ sau): Trong hạn / Quá hạn / Khoanh / Tất toán hoặc Mới.',
    formula:
      'Với mỗi khế ước, suy ra tình trạng kỳ trước và kỳ sau theo các cột dư nợ (kh > qh > th). Đếm số khế ước rơi vào mỗi cặp (from, to).',
    note: 'Bấm vào một ô để xem danh sách chi tiết các khế ước thuộc cell đó.',
  },
  periodMigrationSummary: {
    title: 'Tổng cải thiện · Tổng giảm sút',
    definition:
      'Hai chỉ tiêu tổng hợp từ ma trận chuyển nhóm: số khế ước chuyển từ nhóm xấu hơn về tốt hơn (cải thiện) và ngược lại (giảm sút).',
    formula:
      'Cải thiện = các ô (qh→th, kh→th, kh→qh). Giảm sút = các ô (th→qh, th→kh, qh→kh). Không tính các ô đường chéo và các ô liên quan tới "Tất toán/Mới".',
    note: 'Hai con số dư nợ kèm theo là Σ dư nợ kỳ sau của nhóm khế ước tương ứng.',
  },
  periodMigrationMatrix: {
    title: 'Bảng ma trận 4×4',
    definition:
      'Mỗi ô = số khế ước có tình trạng dòng ở kỳ trước và tình trạng cột ở kỳ sau, kèm tổng dư nợ kỳ sau của nhóm.',
    formula:
      'Bấm vào một ô có dữ liệu để mở danh sách chi tiết các khế ước thuộc cell đó.',
    note: 'Ô xanh lá = chuyển tốt hơn; ô đỏ = chuyển xấu hơn; ô xám = cùng nhóm hoặc liên quan đến đóng/mở khế ước.',
  },

  // Trang Chất lượng tài sản (Page 5)
  pagePeriodAssetQuality: {
    title: 'Chất lượng tài sản giữa hai kỳ',
    definition:
      'Trang chuyên về rủi ro tín dụng: PAR theo ngày quá hạn, vintage NQH theo năm vay, chỉ số tập trung HHI và lịch đáo hạn 90 ngày tới.',
    formula:
      'Mọi chỉ tiêu được tính trên hai tập dữ liệu (kỳ trước · kỳ sau) sau khi đã áp dụng bộ lọc.',
    note: 'Dùng để báo cáo về sức khỏe danh mục và dự báo áp lực thu hồi sắp tới.',
  },
  periodPar: {
    title: 'PAR (Portfolio at Risk)',
    definition:
      'Tổng dư nợ của các khế ước có số ngày quá hạn vượt ngưỡng (30/90/180 ngày), bao gồm cả dư nợ trong hạn của khế ước đó.',
    formula:
      'Số ngày quá hạn = ngày chốt số liệu − (ngày đến hạn gia hạn ?? ngày đến hạn hợp đồng). PAR-N = Σ tổng dư nợ của khế ước có số ngày quá hạn > N.',
    note: 'Chuẩn quốc tế của ngành tài chính vi mô. Tỷ lệ PAR cao hơn = chất lượng tài sản xấu hơn.',
  },
  periodKhoanh: {
    title: 'Dư nợ khoanh',
    definition:
      'Phần dư nợ được cấp có thẩm quyền cho phép khoanh lại do khách hàng gặp rủi ro bất khả kháng. So sánh tổng dư nợ khoanh giữa hai kỳ.',
    formula:
      'Σ dư nợ khoanh từ Báo cáo 31 đã lọc, cho cả kỳ trước và kỳ sau.',
    note: 'Nợ khoanh tăng có thể do nhiều yếu tố: thiên tai, dịch bệnh, hoặc chính sách hỗ trợ mới.',
  },
  periodVintage: {
    title: 'Tỷ lệ NQH theo năm vay (vintage)',
    definition:
      'Phân tích vintage cổ điển: với mỗi năm vay, tính tỷ lệ NQH ở kỳ trước và kỳ sau, sau đó so sánh chênh lệch.',
    formula:
      'Tỷ lệ NQH (theo năm vay y) = Σ dư nợ quá hạn / Σ tổng dư nợ, lọc theo những khế ước có ngayVay rơi vào năm y.',
    note: 'Vintage giúp nhận diện các "lứa" cho vay nào đang xấu đi nhanh nhất, phục vụ điều chỉnh chính sách cấp tín dụng.',
  },
  periodHHI: {
    title: 'Chỉ số tập trung HHI',
    definition:
      'Herfindahl–Hirschman Index — đo mức độ tập trung dư nợ vào một nhóm (PGD, Chương trình, ĐVUT, Xã). Thang 0–10000.',
    formula:
      'HHI = Σ (share_i)² × 10000, trong đó share_i = dư nợ của nhóm i / tổng dư nợ.',
    note: 'Quy ước thông dụng: <1500 phân tán · 1500–2500 trung bình · >2500 tập trung cao. HHI cao ⇒ rủi ro tập trung lớn.',
  },
  periodTopConcentration: {
    title: 'Top 10 khách hàng tập trung dư nợ',
    definition:
      'Mười khách hàng có dư nợ lớn nhất ở kỳ sau và tỷ trọng của họ trong tổng danh mục đã lọc.',
    formula:
      'Sắp xếp khách hàng theo Σ tổng dư nợ giảm dần, lấy 10 dòng đầu. % danh mục = tổng dư nợ Top 10 / tổng dư nợ kỳ sau.',
    note: 'Cảnh báo sớm về rủi ro tập trung khách hàng. Tỷ trọng > 10% là dấu hiệu cần theo dõi đặc biệt.',
  },
  periodMaturity90: {
    title: 'Lịch đáo hạn 90 ngày tới',
    definition:
      'Số khế ước (và dư nợ) sẽ đến hạn trả nợ trong 30/60/90 ngày tới tính từ ngày chốt số liệu kỳ sau.',
    formula:
      'Phân loại theo (ngày đến hạn − ngày chốt số liệu kỳ sau): 0–30 / 31–60 / 61–90 ngày.',
    note: 'Phục vụ lập kế hoạch thu hồi và đôn đốc khách hàng trong quý tới.',
  },

  // Trang Top tăng/giảm (Page 3)
  pagePeriodMovers: {
    title: 'Top tăng / giảm theo nhóm',
    definition:
      'Xếp hạng các nhóm có biến động lớn nhất giữa hai kỳ theo dimension (PGD/Xã/ĐVUT/Chương trình/Tổ TK&VV) × metric (Tổng dư nợ/Tỷ lệ NQH/Roll rate).',
    formula:
      'Mỗi dimension được aggregate hai kỳ. Δ tính theo metric đã chọn. Lọc bỏ các nhóm có dư nợ < 0,5% nhóm lớn nhất để tránh nhiễu.',
    note: 'Bấm vào một dòng để mở Bảng khế ước biến động đã lọc sẵn theo nhóm tương ứng.',
  },
  periodMoversRanking: {
    title: 'Hai cột Top 10',
    definition:
      'Cột trái: Top 10 nhóm có biến động tích cực nhất. Cột phải: Top 10 nhóm có biến động tiêu cực nhất.',
    formula:
      'Với metric "Tổng dư nợ" (good-up): cải thiện = Δ tăng, giảm sút = Δ giảm. Với "Tỷ lệ NQH" (bad-up): ngược lại. Với "Roll rate": chỉ có Top 10 cao nhất.',
    note: 'Chiều "tốt/xấu" được suy ra theo bản chất chỉ tiêu, không phải dấu của Δ.',
  },

  // Trang Hội đoàn thể & Tổ TK&VV (Page 6)
  pagePeriodOrgGroups: {
    title: 'Hội đoàn thể & Tổ TK&VV',
    definition:
      'Hiệu quả ủy thác qua bốn hội đoàn thể (HLHPN/HND/HCCB/ĐTN) và các Tổ tiết kiệm và vay vốn — hai trục đặc thù của VBSP.',
    formula:
      'Aggregate dư nợ và NQH theo trường tenDVUT và tenTo, so sánh hai kỳ.',
    note: 'Bấm vào một dòng để mở danh sách khế ước thuộc đơn vị/tổ tương ứng.',
  },
  periodDvut: {
    title: 'Bốn Đơn vị ủy thác',
    definition:
      'Bảng so sánh dư nợ, số khế ước, số khách hàng và tỷ lệ NQH giữa hai kỳ cho từng tổ chức nhận ủy thác.',
    formula:
      'Σ tổng dư nợ và Σ dư nợ quá hạn theo cột "Đơn vị ủy thác" trên Báo cáo 31, cho cả hai kỳ.',
    note: 'HLHPN = Hội Liên hiệp Phụ nữ · HND = Hội Nông dân · HCCB = Hội Cựu chiến binh · ĐTN = Đoàn Thanh niên.',
  },
  periodToWorsened: {
    title: 'Tổ TK&VV — biến động xấu nhất',
    definition:
      'Top 15 Tổ tiết kiệm và vay vốn có Δ% NQH tăng cao nhất giữa hai kỳ.',
    formula:
      'Δ% NQH = (NQH kỳ sau / dư nợ kỳ sau) − (NQH kỳ trước / dư nợ kỳ trước). Sắp xếp giảm dần.',
    note: 'Dùng để ưu tiên kiểm tra giám sát và kiểm điểm hoạt động Tổ.',
  },
  periodToImproved: {
    title: 'Tổ TK&VV — cải thiện nhiều nhất',
    definition:
      'Top 15 Tổ tiết kiệm và vay vốn có Δ% NQH giảm nhiều nhất giữa hai kỳ.',
    formula:
      'Δ% NQH âm nhất = các Tổ đã thu hồi/gia hạn được nhiều nợ xấu nhất.',
    note: 'Có thể dùng làm điển hình tốt để chia sẻ kinh nghiệm.',
  },

  // Trang Bảng khế ước biến động (Page 4)
  pagePeriodExplorer: {
    title: 'Bảng khế ước biến động',
    definition:
      'Liệt kê mọi khế ước đã thay đổi giữa hai kỳ, phân loại theo 8 nhóm: mới · tất toán · tăng dư nợ · giảm dư nợ · chuyển xấu · cải thiện · gia hạn · không đổi.',
    formula:
      'Mỗi khế ước được phân loại bằng hàm classifyChanges dựa trên trạng thái (th/qh/kh/none) và độ thay đổi dư nợ giữa hai kỳ.',
    note: 'Bấm vào chip để bật/tắt nhóm. Bấm vào một dòng để xem chi tiết toàn bộ 174 trường của khế ước.',
  },

  // Trang Outreach & khách hàng (Page 7)
  pagePeriodOutreach: {
    title: 'Outreach & khách hàng',
    definition:
      'Danh sách khách hàng đáng chú ý phục vụ công tác tiếp cận: KH mới phát sinh, KH đã rời danh mục, KH kích hoạt lại, KH có biến động dư nợ lớn nhất.',
    formula:
      'Phân loại bằng hàm joinByCustomer trên hai tập dữ liệu kỳ trước và kỳ sau, đối chiếu theo mã KH.',
    note: 'Sắp xếp theo dư nợ giảm dần để KH có quy mô lớn ưu tiên ở đầu danh sách.',
  },
  periodOutreachNew: {
    title: 'KH mới phát sinh',
    definition:
      'Khách hàng chỉ có ở kỳ sau (chưa từng có dư nợ ở kỳ trước trong phạm vi bộ lọc đang áp).',
    formula:
      'Bộ chia hiệu {curr customers} \\ {prev customers} theo mã KH.',
    note: 'Cần tiếp xúc xác minh thông tin và phổ biến quy trình thu hồi nợ.',
  },
  periodOutreachChurned: {
    title: 'KH đã rời danh mục',
    definition:
      'Khách hàng có ở kỳ trước nhưng không còn dư nợ ở kỳ sau (đã trả hết hoặc chuyển sang khác).',
    formula:
      'Bộ chia hiệu {prev customers} \\ {curr customers} theo mã KH.',
    note: 'Đối chiếu lý do rời danh mục, phục vụ phân tích chính sách giữ chân khách hàng.',
  },
  periodOutreachReact: {
    title: 'KH kích hoạt lại',
    definition:
      'Khách hàng có ở cả hai kỳ nhưng trước đó đã ngừng giao dịch ≥ 6 tháng tính tới ngày chốt số liệu kỳ trước.',
    formula:
      'Tiêu chí: prevDate − ngày giao dịch gần nhất ở kỳ trước ≥ 6 tháng (≈ 180 ngày).',
    note: 'Tín hiệu tích cực cho công tác tiếp cận khách. Nên ghi nhận và theo dõi tiếp.',
  },
  periodOutreachMovers: {
    title: 'KH biến động dư nợ lớn',
    definition:
      'Top 100 khách hàng có chênh lệch dư nợ tuyệt đối |Δ| lớn nhất trong số những khách hàng duy trì giữa hai kỳ.',
    formula:
      '|Δ| = |dư nợ kỳ sau − dư nợ kỳ trước|. Sắp xếp giảm dần.',
    note: 'Đáng theo dõi và tiếp cận để hiểu lý do biến động.',
  },

  // ─── Diễn giải cấp trang ──────────────────────────────────────────────────

  pageOverview: {
    title: 'Tổng quan danh mục tín dụng',
    definition:
      'Trang tổng hợp các chỉ tiêu, biểu đồ và bảng phục vụ giám sát danh mục tín dụng tại thời điểm chốt số liệu.',
    formula:
      'Toàn bộ KPI và biểu đồ tự động cập nhật theo bộ lọc đang áp dụng phía trên.',
    note: 'Sử dụng nút ⓘ trên từng chỉ tiêu hoặc biểu đồ để xem cách tính chi tiết.',
  },
  pageCompare: {
    title: 'Báo cáo so sánh',
    definition:
      'Trang đối chiếu các chỉ tiêu giữa nhiều đối tượng (PGD, ĐVUT, chương trình…) hoặc bên trong một đối tượng.',
    formula:
      'Chọn chế độ "Giữa các đối tượng" hoặc "Trong cùng đối tượng", sau đó chọn tối đa 6 đối tượng để bắt đầu.',
    note: 'Đối tượng đầu tiên được chọn làm gốc (baseline) cho các phép so sánh chênh lệch.',
  },
  pageExplorer: {
    title: 'Tra cứu chi tiết khế ước',
    definition:
      'Trang tra cứu danh sách khế ước với khả năng lọc, sắp xếp và xem chi tiết toàn bộ trường thông tin.',
    formula:
      'Bộ lọc và ô tìm kiếm phía trên áp dụng cho toàn bộ bảng. Số liệu đã lọc cũng là dữ liệu được xuất ra báo cáo.',
    note: 'Nhấp vào một dòng để mở ngăn chi tiết bên phải hiển thị 174 trường của khế ước.',
  },

  // ─── Báo cáo NPL ──────────────────────────────────────────────────────────

  pageNpl: {
    title: 'Báo cáo NPL — Dư nợ quá hạn & Khoanh',
    definition:
      'Trang chuyên sâu về chất lượng tín dụng: liệt kê dư nợ quá hạn, dư nợ khoanh, các điểm nóng NPL và những khế ước quá hạn lớn nhất.',
    formula:
      'NPL (nợ xấu) ≈ Dư nợ quá hạn + Dư nợ khoanh. Tỷ lệ NPL = NPL / Tổng dư nợ sau khi áp dụng bộ lọc.',
    note: 'Nhấp vào một nhóm trên biểu đồ hoặc một dòng ở bảng điểm nóng để drill-down sang danh sách khế ước tương ứng.',
  },
  tongNoXau: {
    title: 'Tổng nợ xấu (QH + Khoanh)',
    definition:
      'Tổng cộng dư nợ quá hạn và dư nợ khoanh tại ngày chốt số liệu, thể hiện quy mô nợ cần xử lý.',
    formula: 'Tổng nợ xấu = Σ "Dư nợ quá hạn" + Σ "Dư nợ khoanh" sau khi áp dụng bộ lọc.',
    note: 'Khác với chỉ tiêu "Dư nợ quá hạn" — đã bao gồm phần dư nợ đang được khoanh.',
  },
  chartNplPgd: {
    title: 'Dư nợ quá hạn theo Phòng giao dịch',
    definition: 'Xếp hạng các phòng giao dịch theo quy mô dư nợ quá hạn.',
    formula: 'Tổng Σ "Dư nợ quá hạn" theo cột "Tên PGD", sắp xếp giảm dần, lấy Top 10.',
    note: 'Chỉ hiển thị các PGD có dư nợ quá hạn > 0.',
  },
  chartNplDvut: {
    title: 'Dư nợ quá hạn theo Đơn vị ủy thác',
    definition: 'So sánh quy mô dư nợ quá hạn giữa bốn tổ chức chính trị – xã hội nhận ủy thác.',
    formula: 'Tổng Σ "Dư nợ quá hạn" theo cột "Tên ĐVUT", sắp xếp giảm dần.',
    note: 'Cho thấy tổ chức ủy thác nào đang tập trung nhiều nợ quá hạn nhất.',
  },
  chartNplXa: {
    title: 'Dư nợ quá hạn theo Xã',
    definition: 'Xếp hạng xã/phường theo quy mô dư nợ quá hạn.',
    formula: 'Tổng Σ "Dư nợ quá hạn" theo cột "Tên xã", lấy Top 10 xã lớn nhất về dư nợ quá hạn.',
  },
  chartNplProgram: {
    title: 'Dư nợ quá hạn theo Chương trình tín dụng',
    definition: 'Phân bố dư nợ quá hạn giữa các chương trình tín dụng chính sách.',
    formula:
      'Tổng Σ "Dư nợ quá hạn" theo cột "Tên chương trình", lấy Top 10 chương trình có dư nợ quá hạn lớn nhất.',
    note: 'Giúp nhận diện chương trình nào có rủi ro cao cần giám sát.',
  },
  chartNplHotspot: {
    title: 'Điểm nóng NPL theo Xã',
    definition:
      'Các xã/phường có tỷ lệ nợ quá hạn cao nhất — xác định những địa bàn cần can thiệp thu hồi nợ.',
    formula:
      'Tỷ lệ QH = Dư nợ quá hạn / Tổng dư nợ của xã. Chỉ xét các xã có ≥ 3 khế ước để tránh nhiễu từ xã quá nhỏ. Top 15.',
    note: 'Nhấp vào một dòng để xem danh sách khế ước của xã trong Tra cứu chi tiết.',
  },
  chartNplTop: {
    title: 'Top 20 khế ước quá hạn lớn nhất',
    definition:
      'Danh sách 20 khế ước có dư nợ quá hạn lớn nhất theo bộ lọc hiện hành — để tập trung xử lý trước.',
    formula: 'Lọc các khế ước có "Dư nợ quá hạn" > 0, sắp xếp giảm dần, lấy 20 khế ước đầu.',
    note: 'Nhấp vào một dòng để mở ngăn chi tiết toàn bộ thông tin khế ước.',
  },

  // ─── Báo cáo Dư nợ khoanh ─────────────────────────────────────────────────

  pageKhoanh: {
    title: 'Báo cáo Dư nợ khoanh',
    definition:
      'Trang chuyên sâu về các khế ước đang được khoanh (tạm dừng tính lãi, chờ xử lý). Khoanh thường là hệ quả của thiên tai, dịch bệnh hoặc quyết định của cấp có thẩm quyền, là chỉ tiêu riêng so với nợ quá hạn thông thường.',
    formula: 'Chỉ xét các khế ước có "Dư nợ khoanh" > 0 sau khi áp dụng bộ lọc.',
    note: 'Khế ước khoanh cũng được tính trong "Tổng nợ xấu" ở Báo cáo NPL — trang này tách riêng để theo dõi rủi ro xử lý và lãi dự thu chưa đến hạn.',
  },
  laiDtKhoanh: {
    title: 'Lãi DT chưa đến hạn (trên khế ước khoanh)',
    definition:
      'Lãi dự thu chưa đến hạn thu, cộng dồn trên các khế ước có dư nợ khoanh — ước lượng tổn thất lãi tiềm ẩn nếu khoản khoanh được xử lý.',
    formula: 'Σ "Lãi DT chưa đến hạn" trên các khế ước có duNoKhoanh > 0.',
    note: 'Chỉ mang tính tham chiếu — chưa hạch toán lỗ/lãi thực tế.',
  },
  chartKhoanhDvut: {
    title: 'Dư nợ khoanh theo Đơn vị ủy thác',
    definition: 'So sánh quy mô dư nợ khoanh giữa 4 tổ chức uỷ thác.',
    formula: 'Σ "Dư nợ khoanh" theo "Tên ĐVUT", sắp xếp giảm dần.',
  },
  chartKhoanhXa: {
    title: 'Dư nợ khoanh theo Xã',
    definition: 'Xếp hạng xã/phường theo quy mô dư nợ khoanh — phát hiện địa bàn cần xử lý.',
    formula: 'Σ "Dư nợ khoanh" theo "Tên xã", Top 10.',
  },
  chartKhoanhProgram: {
    title: 'Dư nợ khoanh theo Chương trình tín dụng',
    definition: 'Phân bố dư nợ khoanh giữa các chương trình tín dụng chính sách.',
    formula: 'Σ "Dư nợ khoanh" theo "Tên chương trình", Top 10.',
    note: 'Giúp xác định chương trình nào đang có nhiều khoản khoanh nhất (thường liên quan tới nguyên nhân bất khả kháng theo chương trình).',
  },
  chartKhoanhHotspot: {
    title: 'Điểm nóng khoanh theo Xã',
    definition: 'Các xã/phường có tỷ lệ dư nợ khoanh cao nhất so với tổng dư nợ của xã.',
    formula:
      'Tỷ lệ khoanh = Dư nợ khoanh / Tổng dư nợ của xã. Chỉ xét các xã có ≥ 3 khế ước để tránh nhiễu. Top 15.',
    note: 'Tỷ lệ khoanh cao báo hiệu địa bàn từng chịu thiên tai/dịch bệnh hoặc có vấn đề xử lý nợ kéo dài.',
  },
  chartKhoanhTop: {
    title: 'Top 20 khế ước khoanh lớn nhất',
    definition: 'Danh sách 20 khế ước có dư nợ khoanh lớn nhất trong phạm vi lọc.',
    formula: 'Lọc duNoKhoanh > 0, sắp xếp giảm dần, lấy 20 khế ước đầu.',
    note: 'Nhấp một dòng để mở ngăn chi tiết toàn bộ thông tin khế ước.',
  },
};
