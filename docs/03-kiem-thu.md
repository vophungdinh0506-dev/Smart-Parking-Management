# Giai đoạn 5 — Kiểm thử và đánh giá

Tài liệu này đối chiếu **10 ca kiểm thử (TC01–TC10) trong đề cương** với kiểm thử tự động và kiểm thử thủ công.

- **Kiểm thử tự động:** `cd backend` → `npm test`. Chạy với database và AI giả lập trong bộ nhớ, nên không cần SQL Server.
- **Kiểm thử thủ công:** chạy trên SQL Server thật, theo hướng dẫn ở cột "Cách làm". Nhóm ghi kết quả vào cột **Kết quả thực tế**.

> ⚠️ **Nguyên tắc trung thực:** chỉ ghi "Đạt" khi đã **tự chạy và thấy đúng**. Mọi số liệu về độ chính xác AI phải đo trên **ảnh thật** của nhóm (mục 3), không lấy số trên ảnh mô phỏng.

## 1. Bảng đối chiếu TC01–TC10

| Mã | Trường hợp (đề cương) | Kết quả mong đợi | Kiểm thử tự động (file → tên test) | Cách làm thủ công | Kết quả thực tế |
|---|---|---|---|---|---|
| TC01 | Nhận diện ảnh biển số rõ nét | Hiển thị biển số dự đoán để xác nhận | `checkin.api` → *AI đọc tốt → SUCCESS…*; `recognitionInterpret` | Xe vào bãi → tải ảnh rõ → thấy biển số + khung xanh + ảnh cắt | |
| TC02 | Ảnh không có biển số hoặc quá mờ | Báo không nhận diện được, không tạo lượt gửi | `checkin.api` → *Các trường hợp AI…* (NOT_FOUND, LOW_CONFIDENCE, ERROR) | Tải ảnh không có xe → khung vàng "Không phát hiện biển số"; kiểm tra `ParkingSessions` không thêm dòng | |
| TC03 | Xác nhận xe vào với biển số mới | Lưu đúng biển số và thời điểm vào | `checkin.api` → *Xác nhận xe vào…→ 201* | Nhập biển mới → Xác nhận → xem `ParkingSessions` có dòng `OPEN` | |
| TC04 | Xe vào với biển số đã có lượt đang mở | Từ chối tạo lượt trùng | `checkin.api` → *Biển số đang ở trong bãi → 409*, *2 nhân viên xác nhận CÙNG LÚC…* | Cho cùng biển vào lần 2 → thông báo "đang ở trong bãi" | |
| TC05 | Xe ra với biển số có lượt hợp lệ | Tìm đúng lượt, ghi nhận thời điểm ra | `checkout.api` → *TC05 + TC07 + TC10…* | Xe ra bãi → nhập biển đang gửi → thấy 2 ảnh, giờ vào/ra | |
| TC06 | Xe ra nhưng không tìm thấy lượt gửi | Báo lỗi, không tính/đóng lượt tự động | `checkout.api` → *TC06…* | Xe ra với biển không có trong bãi → thông báo đỏ + gợi ý biển gần giống; DB không đổi | |
| TC07 | Tính phí với thời gian gửi hợp lệ | Số tiền khớp biểu phí | `feeCalculator` (12 ví dụ + 7 ca biên); `pricing.api` → *TC07…* | Trang Biểu phí → Thử tính phí với các ví dụ ở mục 2 | |
| TC08 | Thời điểm ra sớm hơn thời điểm vào | Từ chối dữ liệu | `feeCalculator` → *Giờ ra sớm hơn…*; `checkout.api` → *TC08…*; `pricing.api` → *TC08…* | Thử tính phí với giờ ra < giờ vào → báo lỗi | |
| TC09 | Nhân viên chỉnh sửa biển số nhận diện sai | Lưu và xử lý theo biển số đã xác nhận | `checkin.api` (sửa tay khi vào); `checkout.api` → *TC09…* | Sửa biển AI đọc sai rồi xác nhận → danh sách hiện "sửa tay"; `RecognitionLogs` có cả `RecognizedPlate` và `ConfirmedPlate` | |
| TC10 | Hoàn tất quy trình xe ra | Lưu thời gian ra, phí, trạng thái hoàn tất | `checkout.api` → *TC05 + TC07 + TC10…*, *Lượt đã kết thúc → không thu tiền lần 2*, *2 nhân viên bấm "Đã thu tiền" CÙNG LÚC…* | Xác nhận thu tiền → `ParkingSessions.Status = CLOSED`, có dòng `Payments` | |

### Kiểm thử bổ sung (ngoài đề cương)
| Nhóm | Nội dung | File test |
|---|---|---|
| Bảo mật | Đăng nhập sai không lộ tài khoản có tồn tại, chặn sau 5 lần sai/phút, cookie httpOnly, STAFF không gọi được API của ADMIN, tài khoản bị khóa mất phiên ngay | `auth.api`, `admin.api` |
| Upload | File giả mạo ảnh bị chặn, xem ảnh phải đăng nhập, không đọc được file ngoài thư mục uploads | `checkin.api` |
| Toàn vẹn dữ liệu | Không tin số tiền từ trình duyệt (FEE_CHANGED), không thu tiền 2 lần, không dùng lại 1 ảnh 2 lần, ảnh xe RA không dùng cho xe VÀO | `checkout.api`, `checkin.api` |
| Quản trị | Sửa/hủy lượt tạo nhầm (bắt buộc lý do, ghi nhật ký), đổi biểu phí không ảnh hưởng xe đang gửi, không khóa được admin cuối cùng | `admin.api`, `pricing.api` |
| Mở rộng | Lịch sử lọc theo ngày giờ VN, doanh thu theo ngày/loại xe | `reports.api` |

**Kết quả lần chạy gần nhất (03/11/2026, môi trường giả lập):** `npm test` → **78/78 bài đạt**.

## 2. Ví dụ tính phí dùng cho TC07 (biểu phí đã chốt 27/10/2026)

Xe máy 5.000đ/khung thường, 30.000đ/khung đêm · Ô tô 30.000đ/khung thường, 50.000đ/khung đêm · Khung thường 06:00–22:00 · Gửi ≤ 30 phút thu 50% phí khung thường.

| # | Xe | Vào → Ra | Phí đúng | Kết quả hệ thống |
|---|---|---|---|---|
| 1 | Xe máy | 08:00 → 08:20 | 2.500đ | |
| 2 | Xe máy | 08:00 → 08:31 | 5.000đ | |
| 3 | Xe máy | 21:00 → 23:00 | 35.000đ | |
| 4 | Xe máy | 20:00 → 07:00 hôm sau | 40.000đ | |
| 5 | Ô tô | 09:00 → 09:25 | 15.000đ | |
| 6 | Ô tô | 08:00 → 22:00 đúng | 30.000đ | |
| 7 | Ô tô | 20:00 → 07:00 hôm sau | 110.000đ | |
| 8 | Ô tô | Thứ 2 10:00 → Thứ 4 09:00 | 190.000đ | |

## 3. Đo độ chính xác nhận diện (mục 5.3 đề cương)

1. Chuẩn bị ít nhất **50 ảnh thật**, gồm 25 xe máy (biển 2 dòng) và 25 ô tô. Nên có cả ảnh ban đêm, mờ, nghiêng, bị che một phần, và vài ảnh không có biển số.
2. Đặt ảnh vào `ai-service/dataset/`. Đặt tên file bằng biển số đúng (ví dụ `51F12345.jpg`), hoặc ghi biển số vào `labels.csv`.
3. Chạy `python evaluate.py dataset`, rồi ghi kết quả vào bảng dưới.

| Chỉ số | Kết quả |
|---|---|
| Số ảnh (có biển / không biển) | |
| Tỷ lệ đọc đúng toàn bộ biển số | |
| Đọc sai nhưng hệ thống đã cảnh báo (độ tin cậy thấp) | |
| Đọc sai mà **không** cảnh báo (rủi ro, phải nêu trong báo cáo) | |
| Ảnh không biển → báo "không thấy" | |
| Thời gian xử lý trung bình / ảnh | |

**Đã kiểm tra trên ảnh mô phỏng (KHÔNG dùng làm số liệu báo cáo):** 4 ảnh tạo bằng máy (biển ô tô 1 dòng, biển xe máy 2 dòng, ảnh không có biển) đều được xử lý đúng, khoảng 55 ms/ảnh trên CPU. Lần chạy này chỉ để chứng minh luồng xử lý hoạt động; độ chính xác thật phải đo trên ảnh chụp.

## 4. Kiểm thử sự cố kết nối

| Tình huống | Cách làm | Mong đợi | Kết quả |
|---|---|---|---|
| AI service tắt | Tắt cửa sổ `uvicorn`, rồi tải ảnh ở trang Xe vào | Khung đỏ "Không sử dụng được module nhận diện"; nhân viên vẫn nhập tay và tạo lượt được | |
| SQL Server tắt | `Stop-Service 'MSSQL$SQLEXPRESS'` (quyền Admin) | Trang Tổng quan báo cơ sở dữ liệu lỗi; thao tác báo "Lỗi hệ thống, mã lỗi …", không treo, không lộ chi tiết kỹ thuật | |
| Backend tắt | Ctrl + C ở terminal backend | Trang báo "Không kết nối được máy chủ" | |
