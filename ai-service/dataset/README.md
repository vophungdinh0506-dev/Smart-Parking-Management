# Bộ ảnh kiểm thử nhận diện (Thành viên 1 chuẩn bị)

Đặt ảnh vào thư mục này. Đặt tên file = biển số đúng, ví dụ `51F12345.jpg`, `59X112345_dem.jpg`
(phần sau dấu `_` để ghi chú: dem = ban đêm, mo = mờ, nghieng = chụp nghiêng...).
Hoặc tạo `labels.csv` với 2 cột `filename,plate` (ảnh không có biển: để trống cột plate).

Gợi ý tối thiểu 50 ảnh: 25 xe máy (biển 2 dòng) + 25 ô tô; có ảnh ban ngày, ban đêm, mờ, nghiêng, bị che.
Ảnh chụp xe thật có thể chứa thông tin cá nhân → chỉ dùng trong nhóm, không đưa ảnh lên Git công khai.

Chạy đo: `python evaluate.py dataset`
