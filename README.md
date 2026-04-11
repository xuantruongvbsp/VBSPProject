# VSPPRO Webapp

Hệ thống phân tích danh mục tín dụng từ tệp **Báo cáo 31 — Hồ sơ tín dụng chi tiết theo ngày** của Ngân hàng Chính sách Xã hội (NHCSXH / VBSP).

Toàn bộ xử lý chạy trên trình duyệt của bạn. Tệp Excel **không bao giờ** được tải lên máy chủ nào.

> Sau khi cài đặt và mở được app, đọc tiếp **[TUTORIAL.md](TUTORIAL.md)** để biết cách sử dụng từng tính năng.

---

## Hướng dẫn cài đặt cho người chưa biết lập trình

Bạn cần làm 4 việc, **một lần duy nhất**:
1. Cài Node.js
2. Tải mã nguồn về máy
3. Cài thư viện
4. Khởi chạy app

Từ ngày thứ hai trở đi, bạn chỉ cần làm bước 4.

---

### Bước 1 — Cài Node.js (5 phút)

Node.js là môi trường để chạy app. Cài một lần là xong, không cần biết nó là gì.

1. Mở trình duyệt → vào trang: **https://nodejs.org/**
2. Bấm nút lớn ghi **"LTS"** (phiên bản ổn định, thường có chữ "Recommended For Most Users")
3. Mở tệp `.msi` vừa tải → bấm **Next** liên tục → bấm **Install** → đợi xong → **Finish**
4. **Đóng tất cả cửa sổ PowerShell / Command Prompt đang mở** (để Windows nạp lại đường dẫn)

**Kiểm tra**: mở **Windows Terminal** hoặc **PowerShell** (gõ `powershell` ở thanh Start), gõ:
```
node --version
```
Nếu thấy dòng dạng `v20.x.x` thì đã cài thành công. Nếu báo lỗi "not recognized", khởi động lại máy rồi thử lại.

---

### Bước 2 — Tải mã nguồn app về máy (2 phút)

Bạn **không cần** cài Git. Cách đơn giản nhất:

1. Mở trang: **https://github.com/chautinkhiem1997-ctrl/KIETCUIBAP**
2. Bấm nút xanh **"Code"** ở góc trên bên phải danh sách tệp
3. Trong menu hiện ra, bấm **"Download ZIP"**
4. Lưu tệp `KIETCUIBAP-main.zip` vào thư mục bạn muốn (ví dụ: `C:\Users\<tên-bạn>\Documents\`)
5. Chuột phải vào tệp ZIP → **Extract All...** → bấm **Extract**
6. Bạn sẽ có thư mục `KIETCUIBAP-main` chứa toàn bộ mã nguồn

> **Mẹo**: đổi tên thư mục thành `VSPPRO` cho ngắn gọn — không bắt buộc, nhưng dễ nhớ hơn.

---

### Bước 3 — Cài thư viện (5–10 phút, một lần duy nhất)

1. Mở thư mục `KIETCUIBAP-main` (hoặc `VSPPRO` nếu đã đổi tên) vừa giải nén
2. **Chuột phải vào khoảng trống trong thư mục** (không phải lên một tệp nào) → chọn **"Open in Terminal"**
   - Nếu Windows 10 không có lựa chọn này: mở PowerShell, gõ `cd "C:\đường\dẫn\đến\KIETCUIBAP-main"` rồi Enter
3. Trong cửa sổ terminal vừa mở, gõ:
   ```
   npm install
   ```
4. Đợi 5–10 phút. Sẽ thấy nhiều dòng chữ chạy qua, kèm thanh tiến trình. **Bình thường**.
5. Khi thấy dòng dạng `added 286 packages in 7m` thì xong.

> Nếu báo lỗi đỏ: chụp màn hình gửi cho người đã chia sẻ app (Châu Tín Khiêm) — đừng tự sửa.

---

### Bước 4 — Khởi chạy app (mỗi khi muốn dùng)

Trong cùng cửa sổ terminal đang ở thư mục `KIETCUIBAP-main`, gõ:
```
npm run dev
```

Đợi 3–5 giây. Bạn sẽ thấy:
```
  VITE v5.x.x  ready in 300 ms

  ➜  Local:   http://localhost:5173/
```

→ Mở trình duyệt (Chrome / Edge / Firefox), gõ vào thanh địa chỉ:
```
http://localhost:5173/
```

App sẽ hiện ra. Đọc tiếp **[TUTORIAL.md](TUTORIAL.md)** mục **2.1** để biết cách đăng nhập chế độ quản trị.

**Để dừng app**: quay lại cửa sổ terminal → nhấn `Ctrl + C` một lần → gõ `Y` rồi Enter (nếu được hỏi).

---

## Lần thứ hai trở đi — chỉ cần 1 lệnh

Bạn không cần làm lại Bước 1, 2, 3. Mỗi khi muốn mở app:

1. Mở thư mục `KIETCUIBAP-main`
2. Chuột phải khoảng trống → **Open in Terminal**
3. Gõ `npm run dev` → Enter
4. Mở `http://localhost:5173/` trên trình duyệt

---

## Đặt mật khẩu quản trị (làm trước khi dùng lần đầu)

Mã nguồn trên GitHub có sẵn một hash mật khẩu mẫu — **bạn phải đổi** trước khi dùng thật. Cách đổi: xem **[TUTORIAL.md](TUTORIAL.md)** mục **6**.

Nếu chỉ dùng một mình trên máy cá nhân (không chia sẻ link cho ai), bạn có thể bỏ qua bước này.

---

## Các lỗi thường gặp

| Lỗi | Cách sửa |
|---|---|
| `'node' is not recognized` | Đóng tất cả cửa sổ PowerShell và mở lại. Nếu vẫn lỗi, khởi động lại máy. |
| `'npm' is not recognized` | Như trên — Windows chưa nạp đường dẫn Node.js. |
| `Port 5173 is in use` | Đã có một cửa sổ app khác đang chạy. Tìm và đóng nó, hoặc khởi động lại máy. |
| App mở ra nhưng trắng tinh | Bấm `F5` để tải lại. Nếu vẫn trắng, mở DevTools (`F12`) → tab **Console** → chụp màn hình lỗi gửi cho người chia sẻ. |
| `npm install` chạy mãi không xong | Mạng yếu. Đợi thêm 10 phút. Nếu quá 30 phút vẫn không xong, nhấn `Ctrl + C` để dừng, rồi chạy lại `npm install`. |

---

## Bảo mật và dữ liệu

- Tệp Báo cáo 31 chứa **thông tin cá nhân** của khách hàng vay (CMND, số điện thoại, địa chỉ). Tuyệt đối **không** đẩy lên GitHub, Google Drive công khai, hay bất kỳ nơi lưu trữ trực tuyến nào.
- App chạy hoàn toàn cục bộ — dữ liệu không rời khỏi máy bạn.
- Mật khẩu quản trị chỉ là một lớp khóa đơn giản, không phải hệ thống xác thực chuyên nghiệp. Đừng mở app này ra Internet công khai mà không có lớp bảo vệ khác.

---

## Cần giúp đỡ?

Liên hệ người đã chia sẻ app này cho bạn.
