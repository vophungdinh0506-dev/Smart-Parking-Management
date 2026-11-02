# PROJECT CHARTER
# DỰ ÁN SMART PARKING MANAGEMENT

## 1. THÔNG TIN DỰ ÁN

- Tên dự án: Smart Parking Management
- Tên đề tài: Xây dựng website quản lý xe ra vào và tính phí gửi xe bằng nhận diện biển số.
- Lĩnh vực: Công nghệ thông tin – Hệ thống thông tin.
- Loại dự án: Dự án học tập và xây dựng sản phẩm thử nghiệm.
- Quy mô nhóm: 5 thành viên.
- Nền tảng: Website.

## 2. BỐI CẢNH VÀ LÝ DO THỰC HIỆN

Hiện nay, nhu cầu sử dụng phương tiện cá nhân ngày càng
tăng, đặc biệt tại các trung tâm thương mại, trường học
và khu vực công cộng. Việc quản lý xe ra vào bằng phương
pháp thủ công có thể gây mất thời gian, khó kiểm soát
thông tin phương tiện và dễ xảy ra sai sót khi tính phí
gửi xe.

Vì vậy, nhóm lựa chọn đề tài xây dựng website quản lý
xe ra vào và tính phí gửi xe bằng nhận diện biển số.
Hệ thống hướng đến việc hỗ trợ nhân viên quản lý phương
tiện, vị trí đỗ xe, thời gian gửi xe và doanh thu.

## 3. MỤC ĐÍCH DỰ ÁN

Xây dựng một website mô phỏng quy trình quản lý bãi giữ
xe, hỗ trợ theo dõi xe vào, xe ra, quản lý vị trí đỗ xe,
tính phí gửi xe và tra cứu lịch sử gửi xe.

## 4. MỤC TIÊU DỰ ÁN

### 4.1. Mục tiêu tổng quát

Xây dựng website có các chức năng cơ bản phục vụ việc
quản lý hoạt động gửi xe tại bãi đỗ xe.

### 4.2. Mục tiêu cụ thể

- Hiển thị tổng số chỗ đỗ xe.
- Theo dõi số lượng chỗ trống và chỗ đang sử dụng.
- Tiếp nhận thông tin phương tiện khi vào bãi.
- Lưu biển số xe và thời gian vào bãi.
- Quản lý vị trí đỗ xe.
- Ghi nhận thời gian xe ra khỏi bãi.
- Tự động tính phí gửi xe dựa trên thời gian gửi.
- Cập nhật trạng thái vị trí sau khi xe ra.
- Tra cứu lịch sử gửi xe theo biển số.
- Thống kê số lượt xe và doanh thu.

## 5. PHẠM VI DỰ ÁN

### 5.1. Phạm vi thực hiện

Dự án tập trung xây dựng website mô phỏng hoạt động
quản lý bãi giữ xe với các chức năng:

- Quản lý thông tin phương tiện.
- Quản lý vị trí đỗ xe.
- Ghi nhận xe vào và xe ra.
- Tính phí gửi xe tự động.
- Tra cứu lịch sử gửi xe.
- Hiển thị thống kê và doanh thu.
- Thử nghiệm chức năng nhận diện biển số từ hình ảnh
  nếu điều kiện triển khai cho phép.

Đối với chức năng nhận diện biển số, kết quả nhận diện
cần được người vận hành kiểm tra và xác nhận trước khi
lưu thông tin.

### 5.2. Phạm vi không thực hiện

Do giới hạn thời gian và nguồn lực của dự án học tập,
nhóm không triển khai:

- Kết nối camera giám sát thực tế.
- Kết nối cảm biến tại từng vị trí đỗ xe.
- Điều khiển barie tự động.
- Thanh toán trực tuyến.
- Triển khai hệ thống trên quy mô thương mại thực tế.

## 6. CÔNG NGHỆ VÀ CÔNG CỤ DỰ KIẾN

- HTML: Xây dựng cấu trúc trang web.
- CSS: Thiết kế giao diện.
- JavaScript: Xử lý tương tác trên giao diện.
- Node.js: Môi trường chạy JavaScript phía máy chủ.
- Express.js: Xây dựng API và xử lý yêu cầu.
- MySQL: Quản lý và lưu trữ dữ liệu.
- Git và GitHub: Quản lý mã nguồn, theo dõi đóng góp.
- Visual Studio Code: Môi trường lập trình.

## 7. THÀNH VIÊN VÀ PHÂN CÔNG NHIỆM VỤ

- Thành viên 1: Quản lý dự án, lập kế hoạch, viết
  Chương 1, thiết lập môi trường và tích hợp hệ thống.
- Thành viên 2: Nghiên cứu cơ sở dữ liệu, thiết kế ERD,
  xây dựng cơ sở dữ liệu và các chức năng tính phí.
- Thành viên 3: Phân tích yêu cầu, thiết kế giao diện
  và xây dựng các trang frontend.
- Thành viên 4: Xây dựng backend, API và xử lý nghiệp vụ.
- Thành viên 5: Nghiên cứu nhận diện biển số, kiểm thử
  và đánh giá hệ thống.

## 8. RỦI RO DỰ ÁN

| Rủi ro | Biện pháp xử lý |
|---|---|
| Thành viên chậm tiến độ | Theo dõi tiến độ và nhắc nhở định kỳ |
| Xung đột mã nguồn | Sử dụng nhánh riêng và Pull Request |
| Lỗi kết nối cơ sở dữ liệu | Kiểm tra cấu hình và thử nghiệm kết nối |
| Chức năng không tương thích | Thống nhất cấu trúc dữ liệu và API |
| Nhận diện biển số không chính xác | Cho phép kiểm tra và chỉnh sửa kết quả |

## 9. TIÊU CHÍ HOÀN THÀNH

Dự án được xem là hoàn thành khi:

- Website có giao diện hoạt động.
- Hiển thị được tình trạng các vị trí đỗ xe.
- Ghi nhận được thông tin xe vào và xe ra.
- Tính được phí gửi xe theo quy tắc đã thống nhất.
- Cập nhật được trạng thái vị trí đỗ xe.
- Tra cứu được lịch sử gửi xe.
- Hiển thị được thống kê cơ bản.
- Các chức năng chính được kiểm thử.
- Hoàn thành báo cáo và demo sản phẩm.
