# Kịch bản demo (khoảng 10–12 phút)

## Chuẩn bị trước buổi demo (làm trước 1 ngày)
1. Bật SQL Server, chạy backend (`npm run dev`) và AI service (`uvicorn main:app --port 8000`).
2. Mở http://localhost:3000. Trang **Tổng quan** phải hiện **3 thành phần "Hoạt động"**.
3. Tạo sẵn tài khoản: `admin` (Quản trị viên) và `nv01` (Nhân viên). Ghi mật khẩu ra giấy.
4. Chuẩn bị thư mục ảnh demo:
   - 2 ảnh **cùng 1 ô tô** (1 lúc vào, 1 lúc ra), biển rõ nét.
   - 2 ảnh **cùng 1 xe máy** (biển 2 dòng).
   - 1 ảnh mờ hoặc không có biển số (để demo trường hợp nhận diện thất bại).
5. Chạy trước 2–3 lượt gửi để danh sách "Xe đang trong bãi" có sẵn dữ liệu.
6. Mở sẵn SSMS với câu lệnh: `SELECT TOP 5 * FROM dbo.ParkingSessions ORDER BY SessionId DESC;`

## Trình tự demo

| Phút | Người trình bày | Thao tác | Điểm cần nói |
|---|---|---|---|
| 0–1 | Thành viên 5 | Giới thiệu đề tài, kiến trúc (frontend – backend – SQL Server – AI service) | 3 chức năng chính theo đề cương |
| 1–2 | Thành viên 4 | Đăng nhập bằng `nv01`; trang Tổng quan | Mật khẩu được băm, có phân quyền; kiểm tra trạng thái 3 thành phần |
| 2–4 | Thành viên 1 | **Xe vào**: tải ảnh ô tô → AI nhận diện → xác nhận | Phát hiện vùng biển số rồi mới đọc ký tự (2 bước); nhân viên luôn được kiểm tra trước khi lưu (**TC01, TC03**) |
| 4–5 | Thành viên 1 | Xe vào bằng **ảnh mờ** → AI không đọc được → nhập tay | Không tự bịa biển số, có phương án dự phòng (**TC02, TC09**) |
| 5–6 | Thành viên 4 | Cho **cùng biển ô tô vào lần 2** | Bị từ chối, vì database có ràng buộc UNIQUE cho lượt đang mở (**TC04**) |
| 6–8 | Thành viên 4 | **Xe ra**: tải ảnh lúc ra → so sánh 2 ảnh → xem chi tiết phí → "Đã thu tiền" | Phí tính ở backend, không tin số tiền trình duyệt gửi lên; lưu trong 1 transaction (**TC05, TC07, TC10**) |
| 8–9 | Thành viên 4 | Xe ra với **biển không có trong bãi** | Báo lỗi, gợi ý biển gần giống, không tự tạo lượt (**TC06**) |
| 9–10 | Thành viên 2 | Mở SSMS: `ParkingSessions`, `Payments`, `RecognitionLogs`, `AuditLogs` | Dữ liệu thật trong database, có nhật ký để đối soát |
| 10–11 | Thành viên 3 | Đăng nhập `admin`: Biểu phí (thử tính phí 20:00 → 07:00 ô tô = 110.000đ), Lịch sử, Doanh thu | Biểu phí có phiên bản; phần mở rộng làm thêm sau khi xong 3 chức năng chính |
| 11–12 | Thành viên 5 | Kết quả kiểm thử (`npm test` 78/78, bảng TC01–TC10, độ chính xác AI trên ảnh thật), hạn chế, hướng phát triển | Trung thực về giới hạn |

## Câu hỏi giảng viên hay hỏi — gợi ý trả lời
- **"Nếu AI đọc sai mà nhân viên không để ý thì sao?"** Có 3 lớp bảo vệ:
  1. Hệ thống cảnh báo màu vàng khi độ tin cậy thấp.
  2. Khi xe ra, hệ thống hiện ảnh lúc vào cạnh ảnh lúc ra để nhân viên so sánh.
  3. Mọi lần sửa tay đều được lưu lại (`CheckInPlateEdited`, `RecognitionLogs`).

  Đây vẫn là **rủi ro còn lại**, nhóm đã nêu trong phần hạn chế.
- **"Hai nhân viên bấm cùng lúc thì sao?"** Database có ràng buộc UNIQUE cho lượt đang mở và cho `Payments.SessionId`, cộng với khóa dòng `UPDLOCK`. Đã có bài test mô phỏng 2 nhân viên bấm cùng lúc.
- **"Sao không tính phí ở JavaScript cho nhanh?"** Vì người dùng có thể sửa code JavaScript trong trình duyệt. Backend tính lại phí khi xác nhận, và nếu số tiền khác với số đã hiển thị thì từ chối (`FEE_CHANGED`).
- **"Đổi giá thì xe đang gửi tính theo giá nào?"** Theo giá lúc xe vào: mỗi lượt gửi lưu `PricingRuleId`, và biểu phí cũ không bị ghi đè.

## Hạn chế cần nêu trong báo cáo
- Độ chính xác AI phụ thuộc chất lượng ảnh. Mô hình OCR "global" không được huấn luyện riêng cho biển Việt Nam.
- Chưa tích hợp camera thật; demo dùng ảnh tải lên.
- Chỉ đối chiếu theo biển số, không có thẻ/vé, nên không chống được trường hợp biển số giả.
- Chạy cục bộ bằng HTTP. Khi triển khai thật cần HTTPS và sao lưu thư mục ảnh.
