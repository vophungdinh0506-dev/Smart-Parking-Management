# Smart Parking ITS

**Đề tài:** Xây dựng ứng dụng quản lý xe ra vào và tính phí gửi xe bằng nhận diện biển số.

| Thành phần | Công nghệ | Thư mục | Cổng |
|---|---|---|---|
| Giao diện | HTML, CSS, JavaScript | `frontend/` | (do backend phục vụ) |
| Backend + API | Node.js 22+ (nhóm dùng v24), Express 5 | `backend/` | 3000 |
| Cơ sở dữ liệu | Microsoft SQL Server | `database/` | 1433 |
| Nhận diện biển số | Python 3.11 + FastAPI | `ai-service/` | 8000 |

Tài liệu thiết kế: [`docs/02-thiet-ke-he-thong.md`](docs/02-thiet-ke-he-thong.md)

## Tình trạng hiện tại (Giai đoạn 4a — đăng nhập + xe vào)

| Phần | Trạng thái |
|---|---|
| Script tạo database (7 bảng, khóa, ràng buộc) | ✅ Đã chạy trên SQL Server 2025 Express |
| Backend khởi động, `GET /api/health` | ✅ Đã chạy thử |
| Hàm tính phí + chuẩn hóa biển số | ✅ 23 bài test đạt |
| Đăng nhập / đăng xuất / phân quyền ADMIN–STAFF | ✅ Đã chạy với SQL Server thật |
| Xe vào bãi: tải ảnh, nhập/sửa biển số, tạo lượt gửi, chặn trùng | ✅ 15 bài test đạt (database + AI giả lập) — cần thử với SQL Server thật |
| Trang Tổng quan (trạng thái hệ thống) | ✅ Đã chạy thử |
| AI service | ⚠️ Mới có khung API. `/recognize` trả lỗi 503 "chưa tích hợp mô hình" — **chưa nhận diện thật** |
| Xe ra + tính phí, các trang còn lại | ⏳ Giai đoạn 4b, 4d |
| Camera thật | ⏳ Chưa làm |

---

## Cài đặt trên Windows 11 (lần đầu)

### Bước 1 — Chuẩn bị SQL Server
1. Mở **SQL Server Configuration Manager** → *SQL Server Network Configuration* → *Protocols for ...* → bật **TCP/IP** (Enabled).
   - Bản **Express** mặc định không dùng cổng 1433: hoặc đặt cổng 1433 trong TCP/IP → tab *IP Addresses* → *IPAll* → `TCP Port = 1433`, hoặc bật dịch vụ **SQL Server Browser** và dùng `DB_INSTANCE=SQLEXPRESS` trong `.env`.
   - Khởi động lại dịch vụ SQL Server sau khi đổi.
2. Mở **SSMS** → chuột phải tên server → *Properties* → *Security* → chọn **SQL Server and Windows Authentication mode** → khởi động lại dịch vụ SQL Server.

### Bước 2 — Tạo database
Trong SSMS, mở và chạy (F5) **theo đúng thứ tự**:
1. `database/01-schema.sql` — tạo database `SmartParking` và 7 bảng
2. `database/02-seed-required.sql` — thêm loại xe và bảng giá đã chốt
3. `database/03-create-app-login.sql` — **đổi mật khẩu trong file trước khi chạy**; tạo tài khoản `parking_app` chỉ có quyền đọc/ghi dữ liệu

### Bước 3 — Backend
Mở PowerShell hoặc terminal trong VS Code:
```powershell
cd backend
copy .env.example .env      # rồi mở .env, điền DB_PASSWORD
npm run gen-secret          # tạo chuỗi ngẫu nhiên → dán vào JWT_SECRET trong .env
npm install
npm test                    # chạy toàn bộ bài kiểm thử
npm run create-admin        # tạo tài khoản ADMIN đầu tiên
npm run dev                 # chạy backend, tự khởi động lại khi sửa code
```
Kết quả mong đợi:
```
Backend đang chạy tại http://localhost:3000
Đã kết nối SQL Server (database: SmartParking)
```

### Bước 4 — AI service (mở terminal thứ 2)
```powershell
cd ai-service
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000 --reload
```
Nếu PowerShell báo lỗi "running scripts is disabled", chạy 1 lần: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Bước 5 — Kiểm tra
Mở trình duyệt: **http://localhost:3000**

| Trang Tổng quan hiển thị | Ý nghĩa |
|---|---|
| Backend "Hoạt động", SQL Server "Hoạt động", AI "Chạy, chưa có mô hình" | ✅ Đúng với Giai đoạn 3 |
| SQL Server "Lỗi" | Xem log ở terminal backend; kiểm tra lại Bước 1 và file `.env` |
| AI "Lỗi" | AI service chưa chạy (Bước 4) — backend vẫn hoạt động bình thường |

Kiểm tra API trực tiếp: mở http://localhost:3000/api/health

---

## Cấu trúc thư mục
```
smart-parking-its/
├─ docs/          tài liệu phân tích, thiết kế
├─ database/      script SQL (chạy theo thứ tự 01 → 02 → 03)
├─ backend/
│  ├─ src/
│  │  ├─ server.js        khởi động server
│  │  ├─ app.js           cấu hình Express
│  │  ├─ config/          đọc .env, kết nối SQL Server
│  │  ├─ middlewares/     xử lý lỗi (sau này thêm: đăng nhập, upload)
│  │  ├─ routes/          các API
│  │  └─ utils/           tính phí, biển số, thời gian
│  ├─ scripts/            create-admin.js
│  ├─ tests/              unit test
│  └─ uploads/            ảnh tải lên (không đưa lên Git)
├─ frontend/      HTML, CSS, JS
└─ ai-service/    Python FastAPI nhận diện biển số
```

## Quy tắc làm việc nhóm với Git
- **Không commit** file `.env`, thư mục `node_modules/`, `uploads/`, `.venv/` (đã có `.gitignore`).
- Mỗi người làm trên nhánh riêng (`feature/check-in`, `feature/ai-yolo`...), tạo Pull Request để nhóm xem trước khi gộp vào `main`.
- Chạy `npm test` trước khi commit phần backend.
