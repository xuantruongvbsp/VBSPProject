# Hướng dẫn vận hành VSPPRO Webapp

Tài liệu này mô tả cách **vận hành** ứng dụng hằng ngày: khởi động, nhập dữ liệu cho cả ba ứng dụng, dựng danh mục, chia sẻ cho người xem và xử lý sự cố.

Chưa cài đặt máy lần nào? Đọc **[SETUP.md](SETUP.md)** trước (cài Git, Node.js, tải mã nguồn). Muốn biết ứng dụng có những gì? Đọc **[README.md](README.md)**.

Hai vai trò dùng **chung một URL**, khác nhau ở vai lưu trong trình duyệt:

| | Quản trị viên (owner) | Người xem (viewer) |
|---|---|---|
| Thường là | chỉ **bạn** | đồng nghiệp, lãnh đạo |
| Nhập / đổi / xóa tệp Excel | ✅ | ❌ (không thấy ô nhập tệp) |
| Sửa danh mục ĐGD, cán bộ, xã, kế hoạch | ✅ | ❌ (chỉ đọc) |
| Xem KPI, biểu đồ, lọc, drill-down | ✅ | ✅ |
| Xuất báo cáo Excel / PDF | ✅ | ✅ |
| Thấy tên tệp gốc, danh sách tệp gần đây | ✅ | ❌ |

---

## 1. Khởi động ứng dụng

Mở **Git Bash** (hoặc PowerShell) tại thư mục dự án và chọn **một** trong ba lệnh:

```bash
cd /c/VBSP/KIETCUIBAP

npm run dev      # chỉ máy bạn dùng  → http://localhost:5173
npm run lan      # máy bạn + LAN + link internet (Cloudflare)
npm run share    # máy bạn + link internet (Cloudflare), không mở LAN
```

- `npm run dev` in ra `Local: http://localhost:5173/`.
- `npm run lan` in thêm `Network: http://192.168.x.x:5173/` cho máy khác trong cùng Wi-Fi/LAN.
- `npm run lan` và `npm run share` đồng thời chạy `cloudflared`, in ra một URL HTTPS công khai dạng `https://vai-tu-ngau-nhien.trycloudflare.com` — xem mục 8.

Dừng: bấm `Ctrl + C` trong cửa sổ đó. Đóng cửa sổ = ứng dụng tắt, mọi link chết theo.

> **Lần đầu chạy `npm run lan`**: Windows hỏi cho phép Node.js qua tường lửa → chọn **Allow** cho mạng **Private**.

---

## 2. Mở khóa chế độ quản trị

Mỗi trình duyệt mới mặc định ở vai **Người xem**.

1. Vào trang chủ (Lobby) `http://localhost:5173/`
2. Bấm **"Mở chế độ quản trị"** ở góc trên bên phải. Nếu đang ở màn hình chưa có dữ liệu, có thể bấm nút này ngay tại màn hình đó.
3. Nhập mật khẩu → **Mở khóa**

Xong, thanh trên cùng hiển thị **"Quản trị viên"** và nút **"Thoát quản trị"**. Vai trò lưu trong `localStorage` — cùng máy, cùng trình duyệt thì không phải đăng nhập lại.

Muốn xem thử người xem nhìn thấy gì: bấm **Thoát** → trình duyệt trở về vai người xem.

> Đổi mật khẩu: mục 10.

---

## 3. Ứng dụng 1 — Phân tích một kỳ

**Nhập dữ liệu** (chỉ quản trị viên):

1. Lobby → thẻ **Phân tích một kỳ**
2. Kéo-thả tệp `.XLSX` Báo cáo 31 vào ô, hoặc bấm **Chọn tệp dữ liệu**
3. Chờ vài giây đến 1 phút (15.000+ khế ước)

**Tệp đã nhập gần đây**: các tệp từng mở được ghi nhớ trong IndexedDB của trình duyệt. Lần sau chỉ cần bấm **"Mở lại tệp …"** — không phải đi tìm file. Bấm **Xóa tất cả** để dọn danh sách (chỉ xóa danh sách trên máy bạn, không đụng file gốc).

**Các trang trong sidebar:**

| Trang | Nội dung |
|---|---|
| Tổng quan | 8 KPI · biểu đồ ĐVUT · chương trình · cơ cấu khách hàng · lịch đáo hạn |
| Báo cáo nợ quá hạn | NPL, phân nhóm nợ, danh sách khế ước quá hạn |
| Báo cáo Dư nợ khoanh | dư nợ khoanh theo xã / chương trình / thời hạn khoanh |
| Báo cáo so sánh | so sánh chéo giữa và trong từng đối tượng |
| Hiệu quả cán bộ | xếp hạng theo cán bộ — **cần danh mục cán bộ + ĐGD** (mục 6) |
| Hiệu quả ĐGD | xếp hạng theo Điểm giao dịch — **cần danh mục ĐGD** (mục 6) |
| Tra cứu chi tiết | bảng 174 trường mỗi khế ước, lọc + drill-down |
| Danh mục cán bộ | quản lý cán bộ ↔ ĐGD (mục 6) |
| Điểm giao dịch | quản lý ĐGD ↔ mã thôn (mục 6) |

---

## 4. Ứng dụng 2 — So sánh giữa hai kỳ

Ứng dụng này nhận **tối đa 3 tệp**, xếp vào 3 ô cố định:

| Ô | Ý nghĩa |
|---|---|
| **Cuối năm trước** | số liệu 31/12 năm trước |
| **Cuối tháng trước** | số liệu cuối tháng liền trước |
| **Hiện tại** | số liệu kỳ đang phân tích |

1. Lobby → thẻ **So sánh giữa hai kỳ**
2. Kéo tệp vào từng ô (nạp ít nhất **2 ô** mới so sánh được)
3. Chọn **cặp kỳ** muốn so (ví dụ Cuối tháng trước ↔ Hiện tại)
4. Muốn thay tệp một ô: bấm nút **Thay tệp** ngay trên ô đó

> Ứng dụng tự chặn nạp hai tệp trùng "Ngày số liệu" vào hai ô khác nhau.

Các trang: Diễn biến · Ma trận chuyển nhóm · Chất lượng tài sản · Top tăng/giảm · Hội đoàn thể & Tổ · So sánh hiệu quả cán bộ · So sánh hiệu quả ĐGD · Bảng khế ước biến động · Outreach & khách hàng.

---

## 5. Ứng dụng 3 — Kế hoạch tín dụng

Thứ tự làm việc theo đúng thứ tự menu:

1. **Quyết định** — nhập số QĐ, ngày QĐ, đính kèm file PDF quyết định
2. **Kế hoạch** — nhập chỉ tiêu dư nợ theo Xã · Chương trình · Nguồn vốn
3. **Thực tế** — nạp Báo cáo 31 để lấy số dư nợ thực tế
4. **Báo cáo** — so sánh Kế hoạch vs Thực tế, tỷ lệ hoàn thành
5. **Báo cáo thực hiện** — hiệu suất theo cán bộ / ĐGD
6. **Danh mục xã** — danh sách xã dùng cho hai bước trên

Dữ liệu ứng dụng này lưu trong trình duyệt (localStorage) và **tự đồng bộ riêng** cho người xem, độc lập với hai ứng dụng kia.

---

## 6. Danh mục Điểm giao dịch & Cán bộ

Báo cáo 31 **không có** cột ĐGD hay cán bộ — hai danh mục này bạn tự dựng, một lần, rồi dùng lại mãi. Không có chúng thì các trang "Hiệu quả ĐGD", "Hiệu quả cán bộ" và bộ lọc theo ĐGD sẽ trống.

Cấu trúc: **Cán bộ → phụ trách nhiều ĐGD → mỗi ĐGD gồm nhiều Mã thôn → mã thôn khớp với khế ước trong Báo cáo 31.**

### 6.1 Dựng danh mục ĐGD bằng Excel (nhanh nhất)

Vào **Điểm giao dịch**:

1. Bấm **File mẫu** → tải về một file Excel đã **liệt kê sẵn toàn bộ Mã thôn** có trong Báo cáo 31 đang mở (kèm Tên thôn / Tên xã / Số khế ước để đối chiếu, và một sheet "Huong dan").
2. Mở file, với mỗi dòng thôn điền 2 cột đầu: **Mã ĐGD** và **Tên ĐGD**.
   - Nhiều thôn cùng một ĐGD → ghi **trùng** Mã ĐGD (Tên ĐGD chỉ cần đúng ở dòng đầu).
   - Thôn chưa thuộc ĐGD nào → để trống 2 cột đó, hệ thống bỏ qua.
   - Có thể gộp nhiều mã thôn vào một ô, ngăn bằng dấu phẩy: `001, 002, 003`.
3. Lưu file → về app bấm **Import Excel** → xem trước → **Import**.

Màn hình xem trước cho biết: đọc được bao nhiêu ĐGD, bao nhiêu mã mới / bị ghi đè, mã thôn nào **không có trong Báo cáo 31** (in đỏ), và cho chọn **Gộp** (trùng mã thì ghi đè) hay **Thay thế toàn bộ**.

Không cần tạo ĐGD trước bằng tay — import sinh ra ĐGD từ chính file.

### 6.2 Dựng danh mục cán bộ

Vào **Danh mục cán bộ** — **làm sau khi đã có danh mục ĐGD**:

1. **File mẫu** → file Excel đã liệt kê sẵn mọi **Mã ĐGD** trong danh mục
2. Điền **Mã NV** / **Tên NV** cho từng dòng ĐGD (một cán bộ phụ trách nhiều ĐGD thì ghi trùng Mã NV)
3. **Import Excel** → xem trước → **Import**

File cán bộ chỉ *tham chiếu* Mã ĐGD; mã nào chưa có trong danh mục ĐGD sẽ bị cảnh báo đỏ chứ hệ thống **không tự tạo ĐGD mới**.

### 6.3 Kiểm soát phủ thôn

Ngay trên trang Điểm giao dịch có bảng đối chiếu:

- **Chưa gán** — thôn có trong Báo cáo 31 nhưng chưa thuộc ĐGD nào (kèm số khế ước, dư nợ bị bỏ sót)
- **Gán trùng** — một thôn bị gán cho từ 2 ĐGD trở lên
- **Mã thôn đã gán nhưng không có trong Báo cáo 31** — gõ sai mã, hoặc thôn đã sáp nhập / đổi mã

Mục tiêu: "Chưa gán" và "Gán trùng" đều về **0**.

### 6.4 Sao lưu & chuyển sang máy khác

- Ở trang chính, khi đang trong chế độ quản trị, bấm **Sao lưu → Xuất bản sao lưu**. Tệp này chứa danh mục cán bộ, điểm giao dịch, danh mục xã, quyết định và kế hoạch tín dụng.
- Trên máy mới, mở chế độ quản trị rồi chọn **Sao lưu → Khôi phục từ tệp**. Kiểm tra thông báo và xác nhận; ứng dụng sẽ tải lại với dữ liệu vừa khôi phục.
- Các tệp Báo cáo 31 và bộ so sánh gần đây có dung lượng lớn nên không nằm trong tệp sao lưu. Hãy copy các tệp Excel gốc sang máy mới và nhập lại khi cần.
- Nút **Export JSON** trong từng trang danh mục vẫn có thể dùng để sao lưu riêng danh mục đó.
- Dữ liệu trình duyệt **không** đi theo `git pull` hoặc khi chỉ copy thư mục ứng dụng; cần dùng tệp sao lưu như trên.

> Sửa từng ĐGD / cán bộ bằng tay vẫn được: dùng nút **Thêm** hoặc biểu tượng bút chì trên từng dòng. Excel chỉ để nhập hàng loạt cho nhanh.

---

## 7. Xuất bản cho người xem — **tự động**

Không còn nút "Xuất bản cho người xem" như bản cũ. Hễ bạn đang ở chế độ quản trị và dữ liệu thay đổi, ứng dụng **tự xuất bản sau ~1,5 giây**.

Trạng thái hiển thị bằng một nhãn nhỏ ở sidebar:

| Nhãn | Nghĩa |
|---|---|
| `Tự động đồng bộ cho người xem` | đang chờ, chưa có gì để gửi |
| `Đang đồng bộ…` | đang gửi |
| `Đã đồng bộ · 2 phút trước` | xong, người xem refresh là thấy |
| `Lỗi đồng bộ` | rê chuột vào để đọc lý do |

Mỗi lần đồng bộ dữ liệu, **danh mục Cán bộ + ĐGD được gửi kèm** (vài KB) nên người xem ở máy khác có cùng hai bộ chọn với bạn. Ứng dụng Kế hoạch tín dụng có nhãn đồng bộ riêng của nó.

Người xem **phải F5** mới thấy bản mới — cố ý như vậy để dữ liệu không đổi giữa chừng phiên làm việc của họ.

Nếu bạn chưa xuất bản gì, người xem vào sẽ thấy: *"Quản trị viên chưa xuất bản dữ liệu cho ứng dụng này."*

---

## 8. Chia sẻ link cho người xem

### 8.1 Trong văn phòng (LAN / cùng Wi-Fi)

1. Chạy `npm run lan`
2. Gửi địa chỉ **Network** (ví dụ `http://192.168.1.42:5173/`)
3. Họ mở bằng trình duyệt — xong

Máy bạn phải đang bật và đang chạy lệnh thì link mới sống.

### 8.2 Từ ngoài văn phòng (Cloudflare Tunnel)

`npm run lan` và `npm run share` đã tự chạy `cloudflared` — chỉ cần lấy URL `https://….trycloudflare.com` trong terminal và gửi đi.

> ⚠️ URL này **công khai trên internet** — ai có link đều mở được, mà dữ liệu chứa tên, CMND, địa chỉ khách hàng. Chỉ gửi trực tiếp cho người được phép, qua kênh nội bộ. Xong việc bấm `Ctrl + C` → URL chết ngay.

Cần thêm lớp đăng nhập trước khi vào trang: dùng Cloudflare Access (miễn phí ≤ 50 user).

---

## 9. Tệp xuất bản nằm ở đâu — và bảo mật PII

Khi chạy `npm run dev`, dữ liệu xuất bản được ghi vào thư mục `public/`:

| Tệp | Nội dung |
|---|---|
| `published.json.gz` | Phân tích một kỳ |
| `published-period.json.gz` | So sánh giữa hai kỳ |
| `published-catalog.json.gz` | Danh mục Cán bộ + ĐGD |
| `published-credit-plan.json.gz` | Kế hoạch tín dụng |
| `decision-attachments/` | PDF quyết định đính kèm |

Các tệp được **nén gzip** trước khi ghi (≈ 49 MB → ≈ 5 MB). Khi chạy `npm run preview` (sau `npm run build`), chúng nằm trong `dist/` thay vì `public/`.

**Bảo mật:**

- Toàn bộ các tệp trên **chứa thông tin cá nhân khách hàng**.
- Đã có trong `.gitignore` → **không bao giờ** bị commit lên GitHub. Đừng gỡ dòng đó ra.
- Không copy sang máy khác trừ khi chủ đích.
- Muốn ngừng chia sẻ: xóa các tệp `public/published*` → người xem sẽ thấy "chưa xuất bản dữ liệu".

---

## 10. Quy ước dữ liệu cần biết

Áp dụng cho ứng dụng **Phân tích một kỳ**:

- **Khế ước đã tất toán bị ẩn hoàn toàn.** Dòng có `Tình trạng món vay = close` không xuất hiện ở bất kỳ KPI, biểu đồ, bộ lọc, bảng Tra cứu chi tiết hay bản xuất Excel/PDF nào.
  - **Ngoại lệ duy nhất:** *Số dư TK 105* (tiền gửi) được tính trên **toàn bộ** khế ước, kể cả đã tất toán — vì số dư tiền gửi của khách thường nằm trên khế ước đã đóng. Tổng TK 105 vì thế có thể cao hơn kỳ vọng nếu bạn chỉ nhìn các khế ước đang hoạt động.
- **"Lịch đáo hạn theo tháng" dùng cột "Ngày ĐH theo GDXA".** Khế ước để trống cột này không lên biểu đồ nhiệt, kể cả khi còn "Ngày ĐH theo hợp đồng" hay "Ngày ĐH theo Gia hạn".
- **Cột "Ngày đến hạn" trong Tra cứu chi tiết cũng là "Ngày ĐH theo GDXA".**
- **Tiêu đề cột Excel được đối chiếu dung thứ** — khác biệt chữ hoa/thường, khoảng trắng, dấu tiếng Việt vẫn nhận diện được. Mỗi lần nhập tệp, danh sách cột phát hiện được in ra DevTools Console (`F12 → Console → [parser] Excel columns detected:…`).

> Ứng dụng **So sánh giữa hai kỳ** không áp dụng các quy ước này (kho dữ liệu riêng) — khế ước tất toán vẫn được giữ để nhận biết biến động "tất toán giữa hai kỳ".

---

## 11. Đổi mật khẩu chế độ quản trị

Mã nguồn chỉ chứa **hash SHA-256**, không chứa mật khẩu thô. Hash mẫu **phải đổi** trước khi giao cho người khác dùng.

1. Mở trình duyệt bất kỳ → `F12` → tab **Console**
2. Dán lệnh sau, thay `MAT-KHAU-MOI-CUA-BAN`:
   ```js
   crypto.subtle.digest('SHA-256', new TextEncoder().encode('MAT-KHAU-MOI-CUA-BAN'))
     .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
   ```
3. Copy chuỗi hex 64 ký tự
4. Mở `src/config/auth.ts`, thay giá trị `OWNER_PASSWORD_SHA256`
5. Lưu file — Vite tự nạp lại, lần sau mở khóa dùng mật khẩu mới

---

## 12. Cập nhật code mới từ GitHub

```bash
cd /c/VBSP/KIETCUIBAP
git status          # nếu có sửa đổi local → git stash
git pull
npm install         # chỉ khi package.json có thay đổi
npm run dev
```

Sau đó bấm `Ctrl + Shift + R` trong trình duyệt để bỏ cache.

Trên máy người khác, kiểm tra một lần: `git remote -v` phải trỏ đúng repo đang dùng, nếu không `git pull` sẽ không lấy được code mới.

`git pull` **chỉ cập nhật code**, không mang theo dữ liệu Báo cáo 31, danh mục ĐGD/cán bộ hay kế hoạch tín dụng — những thứ đó nằm trong trình duyệt của từng máy.

---

## 13. Câu hỏi nhanh

**Q: Tổng dư nợ trong app thấp hơn tệp Excel gốc?**
A: Đúng theo thiết kế — app đã ẩn mọi khế ước `Tình trạng món vay = close`. Muốn đối chiếu, lọc cùng điều kiện trong Excel trước khi so. (Mục 10.)

**Q: Tổng "Số dư TK 105" lại cao hơn tôi tính tay?**
A: Cũng đúng theo thiết kế — TK 105 tính trên cả khế ước đã tất toán. (Mục 10.)

**Q: "Lịch đáo hạn theo tháng" trống hoặc quá ít dữ liệu?**
A: Biểu đồ chỉ đếm khế ước có giá trị ở cột "Ngày ĐH theo GDXA". Mở `F12 → Console`, tìm dòng `[parser] Excel columns detected:…` để chắc cột đó tồn tại và đúng tên. Nếu cột có nhưng đa số dòng để trống thì đó là lý do.

**Q: Trang "Hiệu quả ĐGD" / "Hiệu quả cán bộ" trống?**
A: Chưa dựng danh mục — làm mục 6, và kiểm tra bảng "Kiểm soát phủ thôn" xem còn thôn nào chưa gán không.

**Q: Người xem có cần làm gì khi tôi nạp tệp mới?**
A: Chỉ cần **F5**.

**Q: Người xem có thể bấm "Chế độ quản trị" để thử mật khẩu không?**
A: Có, liên kết hiện với mọi người — nhưng không có mật khẩu thì không qua được. Lo brute-force thì đặt mật khẩu dài và thêm Cloudflare Access.

**Q: Người xem mở DevTools có thấy dữ liệu thô không?**
A: Có. Đây là ứng dụng chạy trên trình duyệt — dữ liệu phải tải về máy họ để hiển thị. Phân quyền này chặn **thao tác** nhập / xóa / đổi tệp, không phải chặn truy cập ở mức kỹ thuật. Muốn cách ly thật (ví dụ mỗi người chỉ xem một PGD) thì cần backend riêng.

**Q: Có thể có nhiều quản trị viên không?**
A: Có, cứ chia sẻ mật khẩu. Nhưng chỉ có **một** bộ tệp xuất bản chung — ai đồng bộ sau cùng thì dữ liệu của người đó thắng.

**Q: Lỡ mở chế độ quản trị trên máy người khác, đăng xuất từ xa được không?**
A: Không (không có server lưu phiên). Bảo họ vào Lobby bấm **Thoát**, hoặc đổi mật khẩu (mục 11) — nhưng người đã mở khóa vẫn giữ quyền cho tới khi tự thoát / xóa localStorage.

**Q: `Port 5173 is already in use`?**
A: App đang chạy ở cửa sổ khác. Tìm cửa sổ đó bấm `Ctrl + C`, hoặc khởi động lại máy.

---

## 14. Checklist

**Lần đầu:**
- [ ] Cài đặt theo [SETUP.md](SETUP.md)
- [ ] Đổi mật khẩu quản trị (mục 11)
- [ ] Nạp Báo cáo 31 → dựng danh mục **ĐGD** rồi tới **cán bộ** (mục 6)
- [ ] Kiểm tra "Chưa gán" và "Gán trùng" đều = 0

**Mỗi lần làm việc:**
- [ ] `npm run dev` (hoặc `npm run lan` nếu cần chia sẻ) — giữ cửa sổ mở
- [ ] Lobby → Chế độ quản trị → mở khóa
- [ ] Nạp tệp Báo cáo 31 (hoặc bấm "Mở lại tệp …")
- [ ] Chờ nhãn **Đã đồng bộ** ở sidebar
- [ ] Gửi link cho đồng nghiệp, nhắc họ F5

**Xong việc:**
- [ ] `Ctrl + C` để tắt server (và link Cloudflare)
- [ ] (Tùy chọn) xóa `public/published*` nếu muốn ngừng chia sẻ hẳn
