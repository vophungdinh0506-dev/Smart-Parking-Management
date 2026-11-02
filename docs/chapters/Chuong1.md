# CHƯƠNG 1: TỔNG QUAN ĐỀ TÀI

## 1.1. Lý do chọn đề tài

Hiện nay, cùng với sự phát triển của các trung tâm thương mại, siêu thị, trường học và các khu vực công cộng, nhu cầu sử dụng dịch vụ trông giữ phương tiện ngày càng tăng. Việc quản lý xe ra vào bằng phương pháp thủ công vẫn còn tồn tại một số hạn chế như mất thời gian ghi nhận thông tin, khó kiểm soát số lượng phương tiện, dễ xảy ra sai sót trong quá trình tính phí và tra cứu lịch sử gửi xe.

Bên cạnh đó, sự phát triển của công nghệ thông tin và các kỹ thuật xử lý hình ảnh đã tạo điều kiện thuận lợi cho việc ứng dụng công nghệ vào hoạt động quản lý bãi đỗ xe. Trong đó, nhận diện biển số xe là một hướng tiếp cận có thể hỗ trợ quá trình ghi nhận thông tin phương tiện và nâng cao hiệu quả quản lý.

Xuất phát từ những vấn đề trên, nhóm lựa chọn đề tài **“Xây dựng website quản lý xe ra vào và tính phí gửi xe bằng nhận diện biển số”** nhằm nghiên cứu và xây dựng một hệ thống mô phỏng hỗ trợ quản lý hoạt động gửi xe, góp phần giảm bớt thao tác thủ công và nâng cao tính chính xác trong quá trình quản lý.

## 1.2. Mục tiêu đề tài

### 1.2.1. Mục tiêu tổng quát

Xây dựng website mô phỏng hệ thống quản lý bãi giữ xe, hỗ trợ quản lý thông tin phương tiện ra vào, vị trí đỗ xe, thời gian gửi xe và tự động tính phí gửi xe dựa trên thời gian sử dụng dịch vụ.

### 1.2.2. Mục tiêu cụ thể

- Xây dựng giao diện quản lý tổng quan tình trạng bãi giữ xe.
- Hiển thị tổng số vị trí, số vị trí còn trống và số vị trí đang sử dụng.
- Ghi nhận thông tin phương tiện khi vào bãi.
- Lưu biển số xe, thời gian vào và vị trí đỗ xe.
- Ghi nhận thông tin phương tiện khi ra khỏi bãi.
- Tính phí gửi xe dựa trên thời gian gửi và mức phí được thiết lập.
- Tự động cập nhật trạng thái vị trí đỗ xe sau khi xe ra.
- Hỗ trợ tra cứu lịch sử gửi xe theo biển số.
- Thống kê số lượt xe và doanh thu.
- Nghiên cứu thử nghiệm chức năng nhận diện biển số từ hình ảnh nếu điều kiện triển khai cho phép.

## 1.3. Đối tượng và phạm vi nghiên cứu

### 1.3.1. Đối tượng nghiên cứu

Đề tài tập trung nghiên cứu các đối tượng sau:

- Quy trình quản lý phương tiện khi vào và ra khỏi bãi giữ xe.
- Phương pháp quản lý thông tin biển số phương tiện.
- Phương pháp quản lý vị trí đỗ xe và trạng thái sử dụng.
- Phương pháp tính phí gửi xe dựa trên thời gian.
- Công nghệ xây dựng website và quản lý cơ sở dữ liệu.
- Phương pháp nhận diện biển số xe từ hình ảnh.

### 1.3.2. Phạm vi nghiên cứu

**Phạm vi chức năng:**

Hệ thống tập trung vào các chức năng chính:

- Quản lý thông tin xe vào và xe ra.
- Quản lý vị trí đỗ xe.
- Tính phí gửi xe.
- Tra cứu lịch sử gửi xe.
- Thống kê số lượt xe và doanh thu.
- Thử nghiệm nhận diện biển số từ hình ảnh.

**Phạm vi triển khai:**

Đề tài được xây dựng dưới dạng website mô phỏng phục vụ mục đích học tập. Nhóm sử dụng dữ liệu thử nghiệm để mô phỏng hoạt động của bãi giữ xe, không yêu cầu triển khai hệ thống camera, cảm biến hoặc barie thực tế.

Đối với chức năng nhận diện biển số, nhóm nghiên cứu và thử nghiệm trên hình ảnh mẫu. Kết quả nhận diện có thể được người vận hành kiểm tra và xác nhận trước khi lưu vào hệ thống.

## 1.4. Phương pháp nghiên cứu

Nhóm sử dụng các phương pháp nghiên cứu và triển khai sau:

**Phương pháp nghiên cứu tài liệu:**

Tìm hiểu các tài liệu liên quan đến quản lý bãi giữ xe, nhận diện biển số, xây dựng website và quản lý cơ sở dữ liệu.

**Phương pháp phân tích và thiết kế hệ thống:**

Phân tích quy trình xe vào, xe ra; xác định yêu cầu chức năng và thiết kế cơ sở dữ liệu, giao diện phù hợp với phạm vi đề tài.

**Phương pháp xây dựng và thử nghiệm:**

Sử dụng các công nghệ lập trình web để xây dựng hệ thống, sau đó thử nghiệm các chức năng bằng dữ liệu mẫu.

**Phương pháp kiểm thử và đánh giá:**

Kiểm tra hoạt động của từng chức năng, ghi nhận kết quả và đánh giá mức độ đáp ứng các mục tiêu đã đề ra.

## 1.5. Ý nghĩa thực tiễn của đề tài

Đề tài giúp nhóm vận dụng kiến thức về lập trình web, cơ sở dữ liệu, phân tích thiết kế hệ thống và xử lý hình ảnh vào một bài toán thực tế.

Sản phẩm mô phỏng có thể hỗ trợ người quản lý theo dõi tình trạng vị trí đỗ xe, ghi nhận phương tiện ra vào, tính phí gửi xe và tra cứu lịch sử thuận tiện hơn so với việc quản lý hoàn toàn bằng phương pháp thủ công.

Ngoài ra, quá trình thực hiện đề tài giúp các thành viên rèn luyện kỹ năng làm việc nhóm, quản lý mã nguồn bằng GitHub và phối hợp xây dựng một sản phẩm phần mềm.

## 1.6. Bố cục báo cáo

Báo cáo được chia thành các chương chính:

- **Chương 1: Tổng quan đề tài.** Trình bày lý do chọn đề tài, mục tiêu, đối tượng, phạm vi và phương pháp nghiên cứu.
- **Chương 2: Cơ sở lý thuyết và thiết kế cơ sở dữ liệu.** Trình bày các kiến thức liên quan và thiết kế dữ liệu cho hệ thống.
- **Chương 3: Phân tích yêu cầu và thiết kế giao diện.** Phân tích các chức năng và trình bày thiết kế giao diện website.
- **Chương 4: Xây dựng hệ thống.** Trình bày quá trình xây dựng backend, kết nối cơ sở dữ liệu và triển khai các chức năng.
- **Chương 5: Nhận diện biển số, kiểm thử và đánh giá.** Trình bày phương pháp thử nghiệm nhận diện biển số, các trường hợp kiểm thử và kết quả đánh giá.
- **Chương 6: Kết luận và hướng phát triển.** Tổng kết kết quả đạt được, hạn chế và đề xuất hướng phát triển trong tương lai.
