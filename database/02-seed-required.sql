/* =====================================================================
   SMART PARKING ITS — 02-seed-required.sql
   Dữ liệu BẮT BUỘC để hệ thống chạy (không phải dữ liệu demo).
   Chạy SAU 01-schema.sql. Có thể chạy lại nhiều lần (không tạo trùng).

   Tài khoản admin đầu tiên KHÔNG tạo ở đây (để không lưu mật khẩu trong file).
   Dùng lệnh:  cd backend  →  npm run create-admin
   ===================================================================== */

USE SmartParking;
GO

-- 1. Loại xe
IF NOT EXISTS (SELECT 1 FROM dbo.VehicleTypes WHERE VehicleTypeId = 1)
    INSERT INTO dbo.VehicleTypes (VehicleTypeId, Code, Name) VALUES (1, 'MOTORBIKE', N'Xe máy');
IF NOT EXISTS (SELECT 1 FROM dbo.VehicleTypes WHERE VehicleTypeId = 2)
    INSERT INTO dbo.VehicleTypes (VehicleTypeId, Code, Name) VALUES (2, 'CAR', N'Ô tô');
GO

-- 2. Bảng giá — đã được nhóm xác nhận ngày 27/10/2026
--    Khung thường 06:00–22:00, khung đêm 22:00–06:00
--    Gửi <= 30 phút: thu 50% phí 1 khung thường
IF NOT EXISTS (SELECT 1 FROM dbo.PricingRules WHERE VehicleTypeId = 1 AND IsActive = 1)
    INSERT INTO dbo.PricingRules (VehicleTypeId, DayStartTime, NightStartTime, DayFee, NightFee, ShortStayMinutes, ShortStayPercent)
    VALUES (1, '06:00', '22:00', 5000, 30000, 30, 50);

IF NOT EXISTS (SELECT 1 FROM dbo.PricingRules WHERE VehicleTypeId = 2 AND IsActive = 1)
    INSERT INTO dbo.PricingRules (VehicleTypeId, DayStartTime, NightStartTime, DayFee, NightFee, ShortStayMinutes, ShortStayPercent)
    VALUES (2, '06:00', '22:00', 30000, 50000, 30, 50);
GO

SELECT v.Name, p.DayStartTime, p.NightStartTime, p.DayFee, p.NightFee, p.ShortStayMinutes, p.ShortStayPercent
FROM dbo.PricingRules p JOIN dbo.VehicleTypes v ON v.VehicleTypeId = p.VehicleTypeId
WHERE p.IsActive = 1;
GO
