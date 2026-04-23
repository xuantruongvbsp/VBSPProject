# Hướng dẫn vận hành: chế độ Quản trị viên & Người xem

Tài liệu này mô tả quy trình mới của VSPPRO Webapp sau khi thêm phân quyền:

- **Quản trị viên (chủ sở hữu)** — thường chỉ có **bạn**. Có toàn quyền: nhập tệp, xóa tệp, đổi tệp, nhập hai kỳ, **xuất bản** dữ liệu cho người xem.
- **Người xem** — đồng nghiệp / nhân viên. Mở link và **tự động** thấy dữ liệu bạn vừa xuất bản. Họ chỉ có quyền **đọc, lọc, xuất báo cáo**. Không thấy ô nhập tệp, không thấy danh sách tệp gốc, không thấy nút "Tải tệp khác" / "Đổi cặp tệp".

Cả hai vai dùng **chung một URL** — khác biệt nằm ở vai trò trong trình duyệt của họ.

---

## 1. Khởi động máy chủ cục bộ

Trên máy của **bạn** (quản trị viên):

```bash
cd C:\Users\tinkh\VSPPRO\webapp
npm install          # chỉ cần chạy lần đầu
npx vite --host      # --host để máy khác trong LAN truy cập được
```

Lệnh này sẽ in ra hai địa chỉ:

```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

- **Local** = chỉ máy bạn dùng.
- **Network** = các máy khác trong cùng mạng LAN/Wi-Fi văn phòng có thể vào.

> Để dừng máy chủ: bấm `Ctrl+C` trong cửa sổ terminal đó.

---

## 2. Quy trình của Quản trị viên (bạn)

### 2.1 Mở khóa chế độ quản trị

Mỗi lần mở trang lần đầu trên một trình duyệt mới, bạn sẽ ở vai **Người xem** (mặc định).

1. Truy cập `http://localhost:5173/`
2. Cuộn xuống cuối trang chủ (Lobby), bấm liên kết nhỏ **"Chế độ quản trị"**
3. Nhập mật khẩu quản trị (hash của mật khẩu này được cấu hình trong `src/config/auth.ts` — xem mục 6 để đặt mật khẩu cho lần sử dụng đầu tiên)
4. Bấm **Mở khóa**

Sau khi mở khóa, footer Lobby hiển thị: **"Đang ở chế độ quản trị · Thoát"**.
Vai trò này được lưu trong `localStorage` của trình duyệt — bạn không cần đăng nhập lại trên cùng máy/cùng trình duyệt.

> **Đổi mật khẩu**: xem mục 6 ở cuối tài liệu.

### 2.2 Nhập tệp Báo cáo 31 cho ứng dụng "Phân tích một kỳ"

1. Lobby → bấm thẻ **Phân tích một kỳ**
2. Bấm **Chọn tệp dữ liệu** (hoặc kéo thả) → chọn tệp `.XLSX`
3. Đợi vài giây để hệ thống bóc tách (15.000+ khế ước)
4. Khi vào màn hình chính, sidebar trái sẽ hiển thị:
   - Số khế ước
   - Ngày số liệu
   - Nút **Tải tệp khác** (chỉ bạn thấy)
   - Nút **Xuất bản cho người xem** (chỉ bạn thấy)

### 2.3 Xuất bản dữ liệu cho người xem

1. Khi bộ dữ liệu đã sẵn sàng, sidebar có nút **"Xuất bản cho người xem"**
2. Bấm vào → hệ thống ghi tệp `webapp/public/published.json` (~ 80–100 MB cho 15k khế ước)
3. Khi nút chuyển thành **"Đã xuất bản"** màu xanh là xong

Từ thời điểm này, bất kỳ người xem nào mở (hoặc tải lại) URL **sẽ tự động nhận bộ dữ liệu mới**, không cần bạn gửi tệp Excel hay làm thao tác gì thêm.

> **Cập nhật dữ liệu**: cứ làm lại bước 2.2 → 2.3 với tệp mới. Tệp `published.json` sẽ ghi đè.

### 2.4 Nhập hai tệp cho ứng dụng "So sánh giữa hai kỳ"

1. Lobby → bấm thẻ **So sánh giữa hai kỳ**
2. Kéo tệp **kỳ trước** vào ô bên trái và tệp **kỳ sau** vào ô bên phải
3. Khi vào màn hình chính, sidebar trái có:
   - Hai ngày kỳ
   - Nút **Đổi cặp tệp**
   - Nút **Xuất bản cho người xem**
4. Bấm **Xuất bản cho người xem** → ghi `webapp/public/published-period.json`

Hai bộ xuất bản (`published.json` + `published-period.json`) **độc lập**. Bạn có thể xuất bản chỉ một, cả hai, hoặc cập nhật riêng từng cái.

### 2.5 Quay lại vai Người xem (để kiểm tra hộ người xem nhìn thấy gì)

Lobby → bấm **"Đang ở chế độ quản trị · Thoát"** ở cuối trang.

Trình duyệt sẽ trở về vai Người xem. Khi muốn thao tác lại, lặp bước 2.1.

### 2.6 Quy ước hiển thị dữ liệu trong "Phân tích một kỳ"

Để báo cáo gọn và đúng trọng tâm, ứng dụng áp dụng các quy ước sau:

- **Khế ước đã tất toán bị ẩn hoàn toàn.** Dòng có `Tình trạng món vay = close` không xuất hiện ở bất kỳ KPI, biểu đồ, bộ lọc, bảng Tra cứu chi tiết hay bản xuất Excel/PDF nào. Nếu cần xem, dùng trực tiếp tệp Excel gốc.
- **"Lịch đáo hạn theo tháng" dùng cột "Ngày ĐH theo GDXA".** Chỉ khế ước có giá trị ở cột này mới được đếm vào biểu đồ nhiệt. Khế ước để trống cột GDXA sẽ không xuất hiện trên lịch (kể cả khi còn "Ngày ĐH theo hợp đồng" hoặc "Ngày ĐH theo Gia hạn").
- **Cột "Ngày đến hạn" trong Tra cứu chi tiết là "Ngày ĐH theo GDXA"** — không còn là "Ngày ĐH HĐ" như phiên bản cũ.
- **Tiêu đề cột trong Excel được đối chiếu dung thứ.** Khác biệt nhỏ về chữ hoa/thường, khoảng trắng, hoặc dấu tiếng Việt vẫn được nhận diện. Mỗi lần nhập tệp, ứng dụng in danh sách cột phát hiện vào DevTools Console (`F12 → Console → [parser] Excel columns detected:…`) — tiện để kiểm tra nếu một biểu đồ không có dữ liệu.

> Chế độ "So sánh giữa hai kỳ" **không** áp dụng các quy ước này (dùng kho dữ liệu riêng). Khế ước đã tất toán vẫn được giữ để nhận biết biến động "tất toán giữa hai kỳ".

---

## 3. Quy trình của Người xem

Người xem **không cần làm gì** ngoài việc mở URL bạn gửi.

1. Mở `http://192.168.x.x:5173/` (link Network mà bạn cung cấp)
2. Lobby hiển thị 2 thẻ:
   - **Phân tích một kỳ** — nếu đã xuất bản: badge "Đã có dữ liệu"
   - **So sánh giữa hai kỳ** — tương tự
3. Bấm vào một thẻ → ứng dụng mở ra, đã có sẵn dữ liệu
4. Họ có thể:
   - Xem tất cả KPI, biểu đồ, bảng
   - Lọc theo PGD, xã, hội đoàn thể, tình trạng, v.v.
   - Drill-down vào chi tiết từng khế ước
   - **Xuất báo cáo** ra Excel / PDF (nút "Xuất báo cáo" ở mỗi trang)

Người xem **không thấy**:
- Ô nhập tệp / "Chọn tệp dữ liệu"
- Nút "Tải tệp khác", "Đổi cặp tệp"
- Danh sách "Tệp gần đây"
- Tên tệp gốc
- Liên kết "Chế độ quản trị" có hiển thị nhưng phải biết mật khẩu mới mở khóa được

Nếu bạn chưa xuất bản dữ liệu cho một ứng dụng, người xem khi vào ứng dụng đó sẽ thấy thông báo: **"Quản trị viên chưa xuất bản dữ liệu cho ứng dụng này"**.

---

## 4. Chia sẻ đường dẫn cho người xem

### 4.1 Mạng nội bộ văn phòng (LAN / Wi-Fi cùng nhà)

Đơn giản nhất, không cần internet:

1. Trên máy bạn, chạy `npx vite --host`
2. Ghi nhớ địa chỉ Network (ví dụ `http://192.168.1.42:5173/`)
3. Gửi link đó cho đồng nghiệp qua chat / email
4. Họ mở bằng trình duyệt — xong

> **Lưu ý**: máy bạn phải đang bật và đang chạy `npx vite --host` thì link mới sống.

> **Tường lửa Windows**: lần đầu chạy `--host`, Windows sẽ hỏi cho phép Node.js qua tường lửa — chọn **Allow** cho mạng riêng (Private).

### 4.2 Truy cập từ ngoài văn phòng — Cloudflare Tunnel

Nếu người xem cần truy cập từ nhà / khi đi công tác, dùng `cloudflared` (miễn phí, không cần đăng ký domain):

1. Tải `cloudflared.exe` từ <https://github.com/cloudflare/cloudflared/releases/latest>
2. Đặt vào thư mục bất kỳ (ví dụ `C:\tools\cloudflared.exe`)
3. Mở terminal mới, chạy:
   ```bash
   C:\tools\cloudflared.exe tunnel --url http://localhost:5173
   ```
4. cloudflared sẽ in ra một URL HTTPS công khai dạng:
   ```
   https://something-random-words.trycloudflare.com
   ```
5. Gửi URL đó cho người xem. Đường truyền được mã hóa bằng HTTPS.

> **Lưu ý quan trọng**: URL `trycloudflare.com` ngẫu nhiên này **công khai trên internet**. Bất kỳ ai có URL đều mở được. Vì dữ liệu chứa thông tin khách hàng (tên, CMND, địa chỉ), **chỉ chia sẻ URL trực tiếp với những người được phép, qua kênh bảo mật** (chat công ty, không đăng lên nơi công cộng). Khi không dùng nữa, đóng `cloudflared` (Ctrl+C) → URL chết ngay.

### 4.3 Phương án nhiều bảo mật hơn (tùy chọn)

Nếu muốn thêm lớp đăng nhập trước khi vào trang, có thể đăng ký Cloudflare Access (miễn phí cho ≤ 50 user). Liên hệ tôi nếu cần thiết lập.

---

## 5. Tệp xuất bản nằm ở đâu? Khi nào nên xóa?

- Khi chạy `npx vite` (chế độ dev), tệp được ghi vào:
  - `webapp/public/published.json` (Phân tích một kỳ)
  - `webapp/public/published-period.json` (So sánh hai kỳ)
- Khi chạy `npx vite preview` (sau khi `npm run build`), tệp được ghi vào `webapp/dist/` thay vì `public/`.

**Quan trọng — bảo mật PII**:
Hai tệp này **chứa toàn bộ thông tin khách hàng** (tên, CMND, địa chỉ, số điện thoại, dư nợ…). Chúng:
- **Không bao giờ được commit lên Git** (kể cả repo nội bộ).
- **Không sao chép sang máy khác** trừ khi bạn chủ đích.
- Nên **xóa** khi không còn dùng — chỉ cần xóa thủ công file `webapp/public/published.json`.

Khi bạn muốn ngừng cho người xem xem nữa: xóa hai tệp đó → người xem mở trang sẽ thấy "Quản trị viên chưa xuất bản dữ liệu".

---

## 6. Đổi mật khẩu chế độ quản trị

Hash mật khẩu mẫu trong `src/config/auth.ts` **phải được thay** trước khi triển khai cho người khác sử dụng — nếu không, bất kỳ ai biết hash mẫu cũng có thể đoán ra mật khẩu.

1. Mở trình duyệt bất kỳ → bấm `F12` → tab **Console**
2. Dán đoạn lệnh sau, thay `MAT-KHAU-MOI-CUA-BAN`:
   ```js
   crypto.subtle.digest('SHA-256', new TextEncoder().encode('MAT-KHAU-MOI-CUA-BAN'))
     .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
   ```
3. Nhấn Enter → console in ra một chuỗi hex 64 ký tự
4. Mở tệp `webapp/src/config/auth.ts`
5. Thay giá trị của `OWNER_PASSWORD_SHA256` bằng chuỗi hex vừa tạo
6. Lưu file. Vite sẽ tự reload — lần sau mở khóa cần dùng mật khẩu mới
7. Người xem mở khóa bằng mật khẩu cũ sẽ bị từ chối

> Mã nguồn chỉ chứa **hash SHA-256**, không chứa mật khẩu thô. Người xem có thể xem mã nguồn nhưng không lấy lại được mật khẩu từ hash.

---

## 7. Câu hỏi nhanh

**Q: Người xem có thể bấm "Chế độ quản trị" để thử mật khẩu không?**
A: Có — liên kết hiển thị cho mọi người. Nhưng không có mật khẩu thì không qua được, và lỗi sai chỉ in dòng chữ ngắn. Nếu lo bị thử brute-force, đặt mật khẩu dài + dùng cloudflared kèm Cloudflare Access (mục 4.3).

**Q: Người xem có thể xem mã nguồn JS qua DevTools và thấy dữ liệu thô không?**
A: Có. Đây là ứng dụng trên trình duyệt — toàn bộ dữ liệu được tải về máy người xem để hiển thị. Phân quyền này chặn **giao diện** nhập / xóa / đổi tệp, không phải chặn truy cập ở mức kỹ thuật. Nếu cần cách ly hoàn toàn (ví dụ chỉ cho xem một PGD), cần backend riêng — nói tôi biết để bàn thêm.

**Q: Khi cập nhật tệp mới, người xem có cần làm gì?**
A: Chỉ cần **F5** để nạp lại. Nếu họ đang mở sẵn trang, dữ liệu cũ vẫn hiển thị cho đến khi họ tự refresh (đây là lựa chọn có chủ đích để tránh dữ liệu thay đổi giữa chừng phiên làm việc của họ).

**Q: Có thể có nhiều quản trị viên không?**
A: Có. Cứ chia sẻ mật khẩu cho ai cần và họ tự mở khóa trên trình duyệt của họ. Nhưng chỉ có **một** tệp `published.json` chung — ai bấm Xuất bản sau cùng thì dữ liệu của người đó sẽ "thắng".

**Q: Tôi quên thoát chế độ quản trị trên một máy khách, làm sao đăng xuất từ xa?**
A: Không có cách đăng xuất từ xa (vì không có server lưu phiên). Nếu mất kiểm soát, **đổi mật khẩu** (mục 6) — nhưng ai đã mở khóa rồi vẫn có quyền cho đến khi họ tự xóa `localStorage` hoặc bạn bảo họ vào Lobby bấm "Thoát".

**Q: Tổng dư nợ trong "Phân tích một kỳ" thấp hơn số trên tệp Excel gốc?**
A: Đúng theo thiết kế — ứng dụng đã ẩn tất cả khế ước `Tình trạng món vay = close`. Muốn đối chiếu tổng, lọc cùng điều kiện trong Excel trước khi so sánh. (Xem mục 2.6.)

**Q: "Lịch đáo hạn theo tháng" trống hoặc ít dữ liệu hơn kỳ vọng?**
A: Biểu đồ chỉ đếm khế ước có giá trị ở cột "Ngày ĐH theo GDXA". Mở DevTools Console (F12) → tìm dòng `[parser] Excel columns detected:…` để chắc chắn cột GDXA có trong tệp và tên cột đúng. Nếu cột GDXA tồn tại nhưng để trống cho đa số dòng, đó là lý do biểu đồ ít điểm.

---

## 8. Tóm tắt nhanh — checklist

**Lần đầu setup:**
- [ ] `cd webapp && npm install`
- [ ] Đổi mật khẩu trong `src/config/auth.ts` (mục 6)
- [ ] Cài cloudflared nếu cần truy cập từ xa

**Mỗi lần làm việc:**
- [ ] `npx vite --host` (giữ cửa sổ này mở)
- [ ] Vào Lobby → Chế độ quản trị → đăng nhập
- [ ] Nhập tệp Báo cáo 31 (1 hoặc 2 tệp tùy ứng dụng)
- [ ] Bấm **Xuất bản cho người xem** trên sidebar
- [ ] Gửi link cho đồng nghiệp

**Khi xong việc:**
- [ ] Đóng terminal `vite` (Ctrl+C) → ứng dụng tắt
- [ ] (Tùy chọn) xóa `webapp/public/published.json` để bảo mật PII
