# Smart Parking ITS

**Đề tài:** Xây dựng website quản lý xe ra vào và tính phí gửi xe bằng nhận diện biển số.

| Thành phần | Công nghệ | Thư mục | Cổng |
|---|---|---|---|
| Giao diện | HTML, CSS, JavaScript thuần | `frontend/` | (do backend phục vụ) |
| Backend + REST API | Node.js 22+ (nhóm dùng v24), Express 5 | `backend/` | 3000 |
| Cơ sở dữ liệu | Microsoft SQL Server (Express 2022/2025) | `database/` | 1433 |
| Nhận diện biển số | Python 3.10–3.13 + FastAPI + fast-alpr (YOLOv9 + OCR) | `ai-service/` | 8000 |

Tài liệu: [Thiết kế](docs/02-thiet-ke-he-thong.md) · [Kiểm thử TC01–TC10](docs/03-kiem-thu.md) · [Kịch bản demo](docs/04-kich-ban-demo.md)

## Tình trạng

| Chức năng | Phạm vi | Tình trạng |
|---|---|---|
| Đăng nhập, phân quyền ADMIN / STAFF | Nhóm bổ sung | ✅ Đã chạy với SQL Server thật |
| **1. Nhận diện biển số** (tải ảnh → phát hiện vùng biển → đọc ký tự → nhân viên kiểm tra/sửa) | Bắt buộc | ✅ Chạy với mô hình thật. ⚠️ Độ chính xác trên ảnh thật **chưa đo** (`ai-service/evaluate.py`) |
| **2. Xe vào / xe ra** (chặn lượt trùng, tìm lượt đang mở, so sánh ảnh vào/ra) | Bắt buộc | ✅ Xe vào đã chạy với SQL Server thật · Xe ra: test tự động đạt, **cần chạy thử với SQL Server** |
| **3. Tính phí** (khung 06–22h / 22–06h, gửi ngắn 50%, tính ở backend) | Bắt buộc | ✅ 19 bài test tính phí đạt |
| Thiết lập biểu phí (có phiên bản, thử tính phí) | Đề cương mục 3.7 | ✅ |
| Xe đang gửi, admin sửa/hủy lượt tạo nhầm | Nhóm bổ sung | ✅ |
| Tài khoản nhân viên | Nhóm bổ sung | ✅ |
| Lịch sử gửi xe, Doanh thu | **Mở rộng** (đề cương xếp ngoài phạm vi chính) | ✅ |
| Camera thật | Hướng phát triển | ❌ Chưa làm — hiện tải ảnh lên |

Kiểm thử tự động: `cd backend` → `npm test` → **78/78 đạt**, chạy với database và AI giả lập.

---

## Cài đặt trên Windows 11 (lần đầu)

### Bước 1 — SQL Server
1. Cài **SQL Server Express** và **SSMS**.
2. Mở `SQLServerManager16.msc` → *SQL Server Network Configuration* → *Protocols for SQLEXPRESS* → bật **TCP/IP** → *Properties* → *IP Addresses* → *IPAll*: xóa trống *TCP Dynamic Ports*, đặt *TCP Port* = `1433` → Restart dịch vụ.
3. SSMS → chuột phải tên server → *Properties* → *Security* → **SQL Server and Windows Authentication mode** → Restart.
4. Chạy lần lượt `database/01-schema.sql`, `02-seed-required.sql`, `03-create-app-login.sql`. Nhớ **đổi mật khẩu trong file 03** trước khi chạy.

### Bước 2 — Backend
```powershell
cd backend
copy .env.example .env      # mở .env: điền DB_PASSWORD; JWT_SECRET lấy từ lệnh bên dưới
npm run gen-secret          # tạo chuỗi ngẫu nhiên → dán vào JWT_SECRET
npm install
npm test                    # 78 bài kiểm thử
npm run create-admin        # tạo tài khoản ADMIN đầu tiên
npm run dev                 # chạy backend → http://localhost:3000
```

### Bước 3 — AI service (mở terminal thứ 2)
```powershell
cd ai-service
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```
Lần chạy đầu tiên, máy tự tải mô hình (khoảng 11 MB) nên cần Internet. Khi thấy dòng `Đã nạp mô hình: fast-alpr ...` là dịch vụ đã sẵn sàng.
Nếu PowerShell báo lỗi *running scripts is disabled*, chạy lệnh sau 1 lần: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Bước 4 — Kiểm tra
Mở http://localhost:3000 và đăng nhập. Trang **Tổng quan** phải báo cả 3 thành phần **Hoạt động**.

## Mỗi lần mở máy làm tiếp
1. Kiểm tra SQL Server: `Get-Service 'MSSQL$SQLEXPRESS'` phải ra *Running*. Nếu chưa chạy: mở PowerShell **quyền Admin** → `Start-Service 'MSSQL$SQLEXPRESS'`.
2. Terminal 1: `cd backend` → `npm run dev`.
3. Terminal 2: `cd ai-service` → `.venv\Scripts\activate` → `uvicorn main:app --port 8000`.

## Lệnh hữu ích (trong `backend/`)
| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy backend, tự khởi động lại khi sửa code |
| `npm test` | Chạy toàn bộ kiểm thử tự động |
| `npm run create-admin` | Tạo thêm tài khoản ADMIN |
| `npm run reset-password` | Đặt lại mật khẩu khi quên (mật khẩu không xem lại được vì đã được băm) |
| `npm run gen-secret` | Tạo chuỗi bí mật cho `JWT_SECRET` |

Trong `ai-service/`: `python evaluate.py dataset` dùng để đo độ chính xác nhận diện trên bộ ảnh có nhãn (xem `ai-service/dataset/README.md`).

## Cấu trúc thư mục
```
smart-parking-its/
├─ docs/            02 thiết kế · 03 kiểm thử · 04 kịch bản demo
├─ database/        01 schema · 02 dữ liệu bắt buộc · 03 tài khoản backend
├─ backend/
│  ├─ src/
│  │  ├─ routes/        nhận request, kiểm tra dữ liệu (auth, recognitions, sessions, pricing, users, reports, images)
│  │  ├─ services/      nghiệp vụ (checkIn, checkOut, pricing, sessionAdmin, user, recognition)
│  │  ├─ repositories/  câu SQL có tham số
│  │  ├─ middlewares/   đăng nhập/phân quyền, nhận ảnh, xử lý lỗi
│  │  └─ utils/         feeCalculator (tính phí), plate (biển số), time
│  ├─ tests/            kiểm thử tự động (database giả lập trong tests/helpers)
│  └─ scripts/          create-admin, reset-password
├─ frontend/        login · index · check-in · check-out · sessions · pricing · history · reports · users
└─ ai-service/      main.py (API) · recognizer.py (mô hình) · evaluate.py (đo độ chính xác)
```

## Làm việc nhóm với Git
- **Không commit** các file/thư mục: `.env`, `node_modules/`, `uploads/`, `.venv/`, `ai-service/dataset/` (đã có trong `.gitignore`).
- Mỗi người làm trên nhánh riêng và tạo Pull Request để nhóm xem trước khi gộp vào `main`.
- Chạy `npm test` trước khi commit phần backend.
