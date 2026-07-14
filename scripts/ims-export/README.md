# IMS_REPORTS – Tự động xuất "Sao kê chi tiết KTKSNB – Kỳ ngày / 31"

Tự đăng nhập IMS_REPORTS, tạo báo cáo **"31 - Tạo hồ sơ tín dụng chi tiết theo ngày"**
với **Ngày báo cáo = hôm qua** (Mã đơn vị & Tổng hợp = mặc định), tải file `.xlsx` về
`C:\Users\Administrator\Desktop\Schedule_report`. Chạy hằng ngày lúc **07:45** (Task Scheduler).

## File
| File | Vai trò |
|------|---------|
| `config.json` | username + thiết lập + `passwordEnc` (mật khẩu **đã mã hoá DPAPI**) |
| `set-password.ps1` | Mã hoá mật khẩu rồi lưu vào `config.json` |
| `export-kt740.mjs` | Playwright: đăng nhập → chọn báo cáo → tải xlsx |
| `run-export.ps1` | Giải mã mật khẩu → chạy exporter → ghi log (`logs/`) |
| `setup.ps1` | Đăng ký Task Scheduler theo `scheduleTime` |

## Cài đặt (chạy 1 lần)
```powershell
# 1) Lưu mật khẩu (mã hoá DPAPI, chỉ user Windows này giải mã được)
powershell -ExecutionPolicy Bypass -File set-password.ps1 -Password 'MẬT_KHẨU'

# 2) Chạy thử ngay (mất ~7-8 phút vì báo cáo nặng)
powershell -ExecutionPolicy Bypass -File run-export.ps1

# 3) Đăng ký lịch 07:45 hằng ngày
powershell -ExecutionPolicy Bypass -File setup.ps1
```

## Ghi chú
- **Bảo mật:** `passwordEnc` là chuỗi mã hoá DPAPI (gắn với tài khoản Windows + máy này).
  Không bao giờ ghi mật khẩu thường vào `config.json`.
- **Task chạy khi user đã đăng nhập Windows** (LogonType Interactive). Nếu muốn chạy cả khi
  chưa đăng nhập (cần lưu mật khẩu Windows), sửa `setup.ps1`.
- Server tạo báo cáo khá lâu (~7 phút) → timeout đặt 15 phút.
- Đổi tham số? Sửa `config.json` (`report.posCd`, `report.tongHop`, `outDir`, `scheduleTime`...).
- Log mỗi ngày: `logs/export_YYYY-MM-DD.log`.
- Đổi ngày báo cáo khi chạy tay: `set IMS_DATE=15/06/2026` rồi `run-export.ps1`.
