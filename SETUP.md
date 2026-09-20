# Hướng dẫn cài đặt từng bước (dành cho người mới)

Tài liệu này hướng dẫn bạn cài đặt và chạy dự án **VSPPRO Dashboard** trên **máy tính Windows** từ con số 0. Không cần kinh nghiệm lập trình — chỉ cần làm theo đúng thứ tự.

Toàn bộ quá trình mất khoảng **15–20 phút** (tuỳ tốc độ mạng).

---

## Nếu bạn nhận được bản portable

Nếu người chia sẻ gửi cho bạn một thư mục tên **VSPPRO** đã đóng gói sẵn, bạn không cần cài Git, Node.js hay chạy lệnh nào.

1. Copy nguyên thư mục **VSPPRO** vào máy.
2. Mở thư mục đó.
3. Bấm đúp file **Mo VSPPRO.bat**.
4. Giữ cửa sổ đen đang mở trong lúc dùng app.

Nếu trình duyệt không tự mở, nhìn trong cửa sổ đen sẽ có dòng địa chỉ dạng:

```text
http://127.0.0.1:4173/
```

Copy địa chỉ đó vào Chrome hoặc Edge.

---

## Bước 1 — Cài Git (công cụ tải mã nguồn)

1. Mở trình duyệt, truy cập: https://git-scm.com/download/win
2. Trang sẽ tự động tải file cài đặt (ví dụ `Git-2.xx.x-64-bit.exe`).
3. Mở file vừa tải, bấm **Next** liên tục cho đến khi xong (tất cả tuỳ chọn mặc định đều ổn).
4. Sau khi cài xong, mở **Start Menu** → gõ `Git Bash` → mở ứng dụng **Git Bash**.
5. Trong cửa sổ Git Bash, gõ:

   ```bash
   git --version
   ```

   Nếu hiện ra dòng kiểu `git version 2.xx.x` → **OK, cài Git thành công**.

> Từ đây trở đi, **mọi lệnh trong hướng dẫn này đều gõ vào Git Bash** (không dùng Command Prompt thông thường).

---

## Bước 2 — Cài Node.js (môi trường chạy app)

1. Truy cập: https://nodejs.org/en/download
2. Tải bản **LTS** (bên trái, có nhãn "Recommended For Most Users") — phiên bản Windows Installer (.msi) 64-bit.
3. Mở file `.msi` vừa tải, bấm **Next** liên tục. Ở bước có checkbox **"Automatically install the necessary tools..."** → **không cần tick** (bỏ qua cũng được).
4. Bấm **Install**, chờ xong, bấm **Finish**.
5. **Đóng tất cả cửa sổ Git Bash đang mở**, rồi mở lại một cửa sổ Git Bash mới (để nó nhận Node mới cài).
6. Gõ hai lệnh sau:

   ```bash
   node --version
   npm --version
   ```

   - `node --version` phải ra dạng `v20.xx.x` hoặc cao hơn.
   - `npm --version` phải ra dạng `10.x.x` hoặc cao hơn.

   Nếu cả hai đều hiển thị số phiên bản → **OK, Node.js sẵn sàng**.

---

## Bước 3 — Chọn thư mục để chứa dự án

Dự án sẽ được tải về thành một thư mục tên `KIETCUIBAP`. Bạn nên đặt nó ở nơi dễ tìm, ví dụ `C:\VBSP\`.

Trong Git Bash, gõ:

```bash
cd /c/
mkdir -p VBSP
cd VBSP
```

> Giải thích: `/c/` trong Git Bash = ổ `C:\` trong Windows. Lệnh trên tạo thư mục `C:\VBSP` và di chuyển vào đó.

Kiểm tra bạn đang ở đúng chỗ:

```bash
pwd
```

Kết quả phải là `/c/VBSP`.

---

## Bước 4 — Tải mã nguồn về máy (clone)

Vẫn trong Git Bash, gõ:

```bash
git clone https://github.com/chautinkhiem1997-ctrl/KIETCUIBAP.git
```

Chờ Git tải xong (khoảng 30 giây – 2 phút tuỳ mạng).

Sau khi xong, đi vào thư mục dự án:

```bash
cd KIETCUIBAP
```

Kiểm tra:

```bash
ls
```

Bạn sẽ thấy các file như `package.json`, `src`, `README.md`, `TUTORIAL.md`… → **OK, đã tải mã nguồn thành công**.

---

## Bước 5 — Cài thư viện (dependencies)

Dự án cần khoảng 200MB thư viện. Gõ:

```bash
npm install
```

Lệnh này mất **2–5 phút**. Trong quá trình chạy:

- Bạn sẽ thấy rất nhiều dòng chữ cuộn qua — **đừng lo, đó là bình thường**.
- Có thể có vài cảnh báo màu vàng (`warning`, `deprecated`) — **cứ bỏ qua**.
- Khi xong, dòng cuối sẽ hiện kiểu: `added 450 packages in 2m` (số có thể khác).

**Nếu bị lỗi đỏ** (ví dụ `ERESOLVE`, `peer dependency`), thử lệnh này thay thế:

```bash
npm install --legacy-peer-deps
```

---

## Bước 6 — Khởi động app

Gõ:

```bash
npm run dev
```

Sau vài giây, bạn sẽ thấy:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

→ **App đang chạy!**

Mở trình duyệt (Chrome / Edge), nhập vào thanh địa chỉ:

```
http://localhost:5173
```

Bạn sẽ thấy trang chủ của VSPPRO Dashboard.

> **Để dừng app**: quay lại cửa sổ Git Bash, bấm `Ctrl + C`.
>
> **Để chạy lại lần sau**: chỉ cần mở Git Bash, gõ `cd /c/VBSP/KIETCUIBAP` rồi `npm run dev`. Không cần cài lại thư viện.

---

## Bước 7 — Nhập dữ liệu (Báo cáo 31)

Khi app vừa mở, nó **không có sẵn dữ liệu** (vì file Excel chứa thông tin cá nhân khách hàng nên không được lưu trên GitHub).

Bạn cần **xin file Excel Báo cáo 31 / SK_GQVL** từ người chia sẻ dự án, rồi:

1. Trên trang chủ app (Lobby), kéo-thả file `.xlsx` vào ô nhập tệp.
2. Chờ app xử lý (vài giây đến 1 phút tuỳ kích cỡ file).
3. App sẽ tự chuyển sang trang Tổng quan (Overview).

> ⚠️ **Quan trọng — bảo mật dữ liệu**:
> - File Excel chứa CMND, SĐT, địa chỉ khách hàng.
> - **Không bao giờ** upload file này lên GitHub / Google Drive / email công cộng.
> - Toàn bộ xử lý chạy trong trình duyệt trên máy bạn, không gửi đi đâu.

---

## Các vấn đề thường gặp

### ❌ `git: command not found`
→ Bước 1 chưa xong, hoặc bạn đang dùng cửa sổ Git Bash cũ mở trước khi cài. **Đóng, mở lại Git Bash**.

### ❌ `node: command not found` hoặc `npm: command not found`
→ Bước 2 chưa xong, hoặc cửa sổ Git Bash mở trước khi cài Node. **Đóng, mở lại Git Bash**.

### ❌ `npm install` treo / chạy rất lâu > 10 phút
→ Mạng yếu hoặc bị chặn. Thử:
```bash
npm install --registry=https://registry.npmmirror.com
```

### ❌ `Port 5173 is already in use`
→ App đã chạy ở cửa sổ khác. Tìm cửa sổ Git Bash đó, bấm `Ctrl+C`. Hoặc restart máy.

### ❌ Trình duyệt báo `This site can't be reached`
→ App chưa khởi động xong. Chờ đến khi Git Bash hiện dòng `Local: http://localhost:5173/`.

### ❌ Trang hiện ra nhưng trắng toát
→ Bấm `Ctrl + Shift + R` trong trình duyệt để load lại không dùng cache.

---

## Cập nhật code mới từ GitHub (lần sau)

Khi người chia sẻ đẩy code mới lên, bạn kéo về bằng:

```bash
cd /c/VBSP/KIETCUIBAP
git pull
npm install          # chỉ cần nếu package.json thay đổi
npm run dev
```

---

## Tóm tắt 6 lệnh cốt lõi

Nếu đã cài Git và Node, bạn chỉ cần 6 dòng này để chạy dự án:

```bash
cd /c/
mkdir -p VBSP && cd VBSP
git clone https://github.com/chautinkhiem1997-ctrl/KIETCUIBAP.git
cd KIETCUIBAP
npm install
npm run dev
```

→ Mở http://localhost:5173

---

## Cần hỗ trợ?

- Xem thêm `TUTORIAL.md` để biết cách phân quyền Quản trị viên / Người xem.
- Xem `README.md` để biết thêm về tính năng dự án.
- Nếu kẹt ở bước nào, **chụp màn hình toàn bộ cửa sổ Git Bash** và gửi cho người chia sẻ dự án — dòng báo lỗi ở đó sẽ giúp chẩn đoán nhanh.
