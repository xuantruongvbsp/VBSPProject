# VSPPRO Webapp

Hệ thống phân tích danh mục tín dụng từ tệp **Báo cáo 31 — Hồ sơ tín dụng chi tiết theo ngày** của Ngân hàng Chính sách Xã hội (NHCSXH / VBSP).

Toàn bộ xử lý chạy trên trình duyệt của bạn. Tệp Excel **không bao giờ** được tải lên máy chủ nào.

> Sau khi cài đặt và mở được app, đọc tiếp **[TUTORIAL.md](TUTORIAL.md)** để biết cách sử dụng từng tính năng.

---

## Ứng dụng có gì?

App gồm **3 ứng dụng độc lập** — dữ liệu và bộ lọc của mỗi ứng dụng được giữ riêng biệt:

| Ứng dụng | Nhập vào | Cho ra |
|---|---|---|
| **1. Phân tích một kỳ** | 1 tệp Báo cáo 31 | 8 KPI tổng quan · biểu đồ ĐVUT / chương trình / cơ cấu khách hàng · báo cáo so sánh giữa và trong từng đối tượng · lịch đáo hạn · nợ quá hạn (NPL) · khoanh nợ · tra cứu chi tiết 174 trường mỗi khế ước |
| **2. So sánh giữa hai kỳ** | 2–3 tệp Báo cáo 31 (Cuối năm trước · Cuối tháng trước · Hiện tại), chọn 2 để so | Diễn biến KPI · roll rate · cure rate · vào/ra khách hàng · ma trận chuyển nhóm · Top tăng/giảm theo PGD/Xã/ĐVUT · chất lượng tài sản · PAR30/90/180 · so sánh điểm giao dịch (ĐGD) |
| **3. Kế hoạch tín dụng** | Kế hoạch dư nợ theo quyết định (nhập tay) + thực tế từ Báo cáo 31 | So sánh kế hoạch vs thực tế theo xã / chương trình / nguồn vốn · tỷ lệ hoàn thành · báo cáo hiệu suất cán bộ & ĐGD · quản lý danh mục xã |

Cả ba đều: chạy hoàn toàn trên trình duyệt, hỗ trợ **giao diện tối/sáng**, **xuất báo cáo ra Excel / PDF**, và cơ chế **Quản trị viên / Người xem** (quản trị nhập & xuất bản dữ liệu, người xem mở link là thấy — chi tiết trong TUTORIAL.md).

---

## Chạy kiểu portable: copy sang máy khác là mở được

Cách này dành cho người chia sẻ app cho máy khác dùng, không bắt người nhận cài Node.js hay chạy `npm install`.

Trên máy dùng để đóng gói, làm một lần:

1. Cài Node.js LTS nếu máy đóng gói chưa có.
2. Mở thư mục dự án.
3. Chạy file:
   ```
   build-portable.bat
   ```
4. Sau khi xong, copy nguyên thư mục:
   ```
   portable\VSPPRO
   ```
   sang máy Windows khác.
5. Trên máy nhận, mở:
   ```
   VSPPRO.bat
   ```
   rồi chọn **1** để khởi động server (đây là menu chính). `Mo VSPPRO.bat` vẫn chạy server trực tiếp nếu bạn thích.

App sẽ tự mở trong trình duyệt ở địa chỉ nội bộ dạng `http://127.0.0.1:4173/`. Khi dùng xong, đóng cửa sổ đen hoặc nhấn `Ctrl + C`.

> Thư mục `portable\VSPPRO` đã chứa bản build, server cục bộ và `node.exe` tối thiểu để chạy app. Đừng xóa các thư mục `app`, `runtime` hoặc file `server.mjs` bên trong đó.

### Chia sẻ cho đồng nghiệp cùng mạng LAN

Sau khi server chạy, cửa sổ đen sẽ in danh sách địa chỉ LAN (dạng `http://192.168.x.x:4173/`). Đồng nghiệp mở một địa chỉ đó trên trình duyệt của họ là xem được dữ liệu.

- Nếu đồng nghiệp không truy cập được, chạy **`Them Firewall Rule.bat`** (chuột phải → **Run as administrator**) một lần để mở cổng qua Windows Firewall.
- **Bảo mật:** chỉ máy chủ (`localhost`) mới **xuất bản** được dữ liệu; đồng nghiệp chỉ xem. File `config.json` (chứa hash mật khẩu) không được gửi ra LAN.

### Cập nhật phiên bản mới (giữ dữ liệu)

Cách cập nhật **một chạm** từ một thư mục chia sẻ trên mạng LAN:

1. Trên **máy dev**: chạy `build-portable.bat` để tạo `portable\VSPPRO` mới (kèm file `app\version.json`).
2. Copy thư mục `portable\VSPPRO` vừa build vào thư mục chia sẻ, ví dụ `\\FILESERVER\Share\VSPPRO`.
3. Trên **máy chủ**: mở `VSPPRO.bat` → chọn **`5. Kiem tra cap nhat`**. Nếu thấy bản mới, gõ `Y` để cập nhật.

Để bước 3 hoạt động, máy chủ cần chỉnh file **`update-source.txt`** nằm cạnh `VSPPRO.bat` — ghi đúng một dòng là đường dẫn thư mục chia sẻ chứa bản mới (không bỏ dấu ngoặc kép):

```text
\\FILESERVER\Share\VSPPRO
```

hoặc một ổ đĩa cục bộ:

```text
D:\Builds\VSPPRO
```

Script tự dừng server nếu đang chạy, giữ nguyên dữ liệu đã xuất bản, mật khẩu quản trị và chính file `update-source.txt`.

- **Người xem (viewer):** khi máy chủ đã cập nhật, tab đang mở sẽ tự hiện banner **"Chủ máy đã cập nhật bản mới"** — chỉ cần bấm **"Tải lại"**, không phải làm gì thêm.
- **Xem phiên bản đang chạy:** nhìn dòng `v... · ...` ở cuối thanh bên trái của app, hoặc dòng `Version: ...` trong cửa sổ đen của server.

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

1. Mở trang: **https://github.com/maituankiet97/VBSPProject**
2. Bấm nút xanh **"Code"** ở góc trên bên phải danh sách tệp
3. Trong menu hiện ra, bấm **"Download ZIP"**
4. Lưu tệp `VBSPProject-main.zip` vào thư mục bạn muốn (ví dụ: `C:\Users\<tên-bạn>\Documents\`)
5. Chuột phải vào tệp ZIP → **Extract All...** → bấm **Extract**
6. Bạn sẽ có thư mục `VBSPProject-main` chứa toàn bộ mã nguồn

> **Mẹo**: đổi tên thư mục thành `VSPPRO` cho ngắn gọn — không bắt buộc, nhưng dễ nhớ hơn.

---

### Bước 3 — Cài thư viện (5–10 phút, một lần duy nhất)

1. Mở thư mục `VBSPProject-main` (hoặc `VSPPRO` nếu đã đổi tên) vừa giải nén
2. **Chuột phải vào khoảng trống trong thư mục** (không phải lên một tệp nào) → chọn **"Open in Terminal"**
   - Nếu Windows 10 không có lựa chọn này: mở PowerShell, gõ `cd "C:\đường\dẫn\đến\VBSPProject-main"` rồi Enter
3. Trong cửa sổ terminal vừa mở, gõ:
   ```
   npm install
   ```
4. Đợi 5–10 phút. Sẽ thấy nhiều dòng chữ chạy qua, kèm thanh tiến trình. **Bình thường**.
5. Khi thấy dòng dạng `added 286 packages in 7m` thì xong.

> Nếu báo lỗi đỏ: chụp màn hình gửi cho người đã chia sẻ app (Mai Tuấn Kiệt) — đừng tự sửa.

---

### Bước 4 — Khởi chạy app (mỗi khi muốn dùng)

Trong cùng cửa sổ terminal đang ở thư mục `VBSPProject-main`, gõ:
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

1. Mở thư mục `VBSPProject-main`
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

Liên hệ **Mai Tuấn Kiệt** — người đã chia sẻ app này cho bạn.
