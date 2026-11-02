# WORK BREAKDOWN STRUCTURE (WBS)
# DỰ ÁN SMART PARKING MANAGEMENT

## 1. Tổng quan

WBS là cấu trúc phân rã công việc của dự án thành các nhóm nhiệm vụ nhỏ hơn. Nhóm sử dụng WBS để xác định các công việc cần thực hiện, người chịu trách nhiệm và kết quả bàn giao trong quá trình xây dựng website quản lý xe ra vào và tính phí gửi xe.

## 2. Cấu trúc phân rã công việc

### 1.0. Quản lý và chuẩn bị dự án
- 1.1. Xác định tên và mục tiêu đề tài.
- 1.2. Xác định phạm vi thực hiện.
- 1.3. Lập Project Charter.
- 1.4. Lập WBS và kế hoạch tiến độ.
- 1.5. Thiết lập repository GitHub.
- 1.6. Thiết lập môi trường lập trình.

### 2.0. Nghiên cứu và thiết kế dữ liệu
- 2.1. Tìm hiểu quy trình quản lý bãi giữ xe.
- 2.2. Xác định các đối tượng dữ liệu.
- 2.3. Thiết kế sơ đồ ERD.
- 2.4. Xây dựng cơ sở dữ liệu MySQL.
- 2.5. Tạo dữ liệu mẫu.
- 2.6. Xây dựng quy tắc tính phí gửi xe.

### 3.0. Phân tích và xây dựng giao diện
- 3.1. Xác định yêu cầu chức năng.
- 3.2. Thiết kế giao diện Dashboard.
- 3.3. Thiết kế sơ đồ vị trí đỗ xe.
- 3.4. Thiết kế giao diện xe vào.
- 3.5. Thiết kế giao diện xe ra.
- 3.6. Thiết kế giao diện tra cứu lịch sử.
- 3.7. Xây dựng giao diện bằng HTML, CSS và JavaScript.

### 4.0. Xây dựng hệ thống Backend
- 4.1. Khởi tạo dự án Node.js và Express.
- 4.2. Thiết lập kết nối MySQL.
- 4.3. Xây dựng API thống kê Dashboard.
- 4.4. Xây dựng chức năng ghi nhận xe vào.
- 4.5. Xây dựng chức năng ghi nhận xe ra.
- 4.6. Xây dựng chức năng tính phí.
- 4.7. Xây dựng chức năng cập nhật trạng thái vị trí.
- 4.8. Xây dựng API tra cứu lịch sử gửi xe.

### 5.0. Nghiên cứu nhận diện biển số và kiểm thử
- 5.1. Tìm hiểu phương pháp nhận diện biển số.
- 5.2. Thử nghiệm nhận diện biển số từ hình ảnh.
- 5.3. Kiểm tra kết quả nhận diện.
- 5.4. Xây dựng bộ trường hợp kiểm thử.
- 5.5. Kiểm thử chức năng xe vào.
- 5.6. Kiểm thử chức năng xe ra và tính phí.
- 5.7. Kiểm thử tra cứu và thống kê.
- 5.8. Ghi nhận kết quả kiểm thử.

### 6.0. Tích hợp và hoàn thiện
- 6.1. Tích hợp frontend và backend.
- 6.2. Tích hợp backend và cơ sở dữ liệu.
- 6.3. Kiểm tra hoạt động tổng thể.
- 6.4. Sửa lỗi và hoàn thiện giao diện.
- 6.5. Chuẩn bị dữ liệu demo.
- 6.6. Hoàn thiện báo cáo.
- 6.7. Chuẩn bị trình diễn sản phẩm.

## 3. Bảng phân công công việc

| Mã công việc | Nội dung | Người phụ trách | Kết quả bàn giao |
|---|---|---|---|
| 1.0 | Quản lý và chuẩn bị dự án | Thành viên 1 | Project Charter, WBS, Timeline |
| 2.0 | Nghiên cứu và thiết kế dữ liệu | Thành viên 2 | ERD, SQL, dữ liệu mẫu |
| 3.0 | Phân tích và xây dựng giao diện | Thành viên 3 | Wireframe, giao diện website |
| 4.0 | Xây dựng Backend | Thành viên 4 | API và xử lý nghiệp vụ |
| 5.0 | Nhận diện biển số và kiểm thử | Thành viên 5 | Kết quả thử nghiệm, test cases |
| 6.0 | Tích hợp và hoàn thiện | Thành viên 1 phối hợp cả nhóm | Website hoàn chỉnh, báo cáo và demo |

## 4. Kết quả dự kiến

Sau khi hoàn thành các nhóm công việc trong WBS, nhóm dự kiến có một website mô phỏng quản lý bãi giữ xe với các chức năng ghi nhận xe vào, xe ra, quản lý vị trí đỗ xe, tính phí gửi xe, tra cứu lịch sử và thống kê doanh thu.

WBS là cơ sở để nhóm theo dõi tiến độ, kiểm soát công việc và đánh giá kết quả bàn giao của từng thành viên.
