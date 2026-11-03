/* =====================================================================
   SMART PARKING ITS — 03-create-app-login.sql  (chạy SAU 01 và 02)
   Tạo tài khoản SQL riêng cho backend, chỉ có quyền đọc/ghi dữ liệu
   (không được xóa bảng, không được tạo database) — nguyên tắc "quyền tối thiểu".

   TRƯỚC KHI CHẠY: đổi mật khẩu ở dòng CREATE LOGIN, rồi ghi đúng mật khẩu đó
   vào backend/.env (DB_PASSWORD). KHÔNG commit mật khẩu thật lên Git.
   ===================================================================== */

USE master;
GO
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'parking_app')
    CREATE LOGIN parking_app WITH PASSWORD = N'DoiMatKhauNay_123!', CHECK_POLICY = ON;
GO

USE SmartParking;
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'parking_app')
    CREATE USER parking_app FOR LOGIN parking_app;
GO
ALTER ROLE db_datareader ADD MEMBER parking_app;
ALTER ROLE db_datawriter ADD MEMBER parking_app;
GO
PRINT N'Đã tạo login parking_app';
GO
