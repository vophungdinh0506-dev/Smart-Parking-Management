/* =====================================================================
   SMART PARKING ITS — 04-kiem-tra-du-lieu.sql
   ===================================================================== */
USE SmartParking;
GO

/* ---------- PHẦN A: XEM DỮ LIỆU ---------- */

-- A1. 10 lượt gửi gần nhất
SELECT TOP 10
    s.SessionId                         AS [Mã],
    s.PlateNumber                       AS [Biển số],
    v.Name                              AS [Loại xe],
    s.Status                            AS [Trạng thái],
    DATEADD(HOUR, 7, s.CheckInAt)       AS [Giờ vào VN],
    DATEADD(HOUR, 7, s.CheckOutAt)      AS [Giờ ra VN],
    DATEDIFF(MINUTE, s.CheckInAt, s.CheckOutAt) AS [Số phút gửi],
    s.FeeAmount                         AS [Phí],
    s.CheckInPlateEdited                AS [Sửa tay lúc vào],
    s.CheckOutPlateEdited               AS [Sửa tay lúc ra],
    s.CancelReason                      AS [Lý do hủy]
FROM dbo.ParkingSessions s
JOIN dbo.VehicleTypes v ON v.VehicleTypeId = s.VehicleTypeId
ORDER BY s.SessionId DESC;

-- A2. Thanh toán (mỗi lượt đã ra phải có đúng 1 dòng)
SELECT p.PaymentId AS [Mã TT], p.SessionId AS [Mã lượt], s.PlateNumber AS [Biển số],
       p.Amount AS [Số tiền], p.Method AS [Hình thức], u.FullName AS [Người thu],
       DATEADD(HOUR, 7, p.PaidAt) AS [Thời gian thu VN]
FROM dbo.Payments p
JOIN dbo.ParkingSessions s ON s.SessionId = p.SessionId
JOIN dbo.Users u ON u.UserId = p.ReceivedBy
ORDER BY p.PaymentId DESC;

-- A3. Kết quả nhận diện: AI đọc gì, nhân viên xác nhận gì
SELECT TOP 20
    r.RecognitionId     AS [Mã ảnh],
    r.Direction         AS [Hướng],
    r.Status            AS [Kết quả AI],
    r.RecognizedPlate   AS [AI đọc được],
    r.ConfirmedPlate    AS [Nhân viên xác nhận],
    CASE WHEN r.ConfirmedPlate IS NULL THEN N'(chưa dùng)'
         WHEN r.RecognizedPlate = r.ConfirmedPlate THEN N'Đúng'
         ELSE N'AI SAI / nhập tay' END AS [Đánh giá],
    r.Confidence        AS [Độ tin cậy],
    r.ProcessingMs      AS [ms],
    r.SessionId         AS [Mã lượt],
    r.ErrorMessage      AS [Lỗi]
FROM dbo.RecognitionLogs r
ORDER BY r.RecognitionId DESC;

-- A4. Tỷ lệ AI đọc đúng trên các ảnh ĐÃ được nhân viên xác nhận (số liệu tham khảo cho báo cáo)
SELECT
    COUNT(*)                                                         AS [Số ảnh đã xác nhận],
    SUM(CASE WHEN RecognizedPlate = ConfirmedPlate THEN 1 ELSE 0 END) AS [AI đọc đúng],
    CAST(100.0 * SUM(CASE WHEN RecognizedPlate = ConfirmedPlate THEN 1 ELSE 0 END)
         / NULLIF(COUNT(*), 0) AS DECIMAL(5,1))                      AS [Tỷ lệ đúng %],
    AVG(ProcessingMs)                                                AS [Thời gian TB (ms)]
FROM dbo.RecognitionLogs
WHERE ConfirmedPlate IS NOT NULL AND Status <> 'ERROR';

-- A5. Biểu phí đang áp dụng
SELECT v.Name AS [Loại xe], p.DayStartTime AS [Khung thường từ], p.NightStartTime AS [Khung đêm từ],
       p.DayFee AS [Phí thường], p.NightFee AS [Phí đêm], p.ShortStayMinutes AS [Gửi ngắn ≤ phút],
       p.ShortStayPercent AS [% gửi ngắn]
FROM dbo.PricingRules p JOIN dbo.VehicleTypes v ON v.VehicleTypeId = p.VehicleTypeId
WHERE p.IsActive = 1;

-- A6. Nhật ký thao tác gần nhất
SELECT TOP 20 a.AuditId, a.Action AS [Thao tác], u.Username AS [Người làm],
       a.EntityType, a.EntityId, a.Detail AS [Chi tiết], DATEADD(HOUR, 7, a.CreatedAt) AS [Lúc VN]
FROM dbo.AuditLogs a LEFT JOIN dbo.Users u ON u.UserId = a.UserId
ORDER BY a.AuditId DESC;

/* ---------- PHẦN B: KIỂM TRA TOÀN VẸN DỮ LIỆU ---------- */

-- B1. Một biển số có nhiều hơn 1 lượt đang mở (TC04)
SELECT N'B1 - Biển số mở trùng' AS [Lỗi], PlateNumber, COUNT(*) AS [Số lượt mở]
FROM dbo.ParkingSessions WHERE Status = 'OPEN'
GROUP BY PlateNumber HAVING COUNT(*) > 1;

-- B2. Giờ ra sớm hơn giờ vào (TC08)
SELECT N'B2 - Giờ ra < giờ vào' AS [Lỗi], SessionId, CheckInAt, CheckOutAt
FROM dbo.ParkingSessions WHERE CheckOutAt < CheckInAt;

-- B3. Lượt đã ra nhưng không có thanh toán, hoặc có thanh toán nhưng lượt chưa đóng (TC10)
SELECT N'B3 - Đã ra nhưng thiếu thanh toán' AS [Lỗi], s.SessionId, s.PlateNumber
FROM dbo.ParkingSessions s LEFT JOIN dbo.Payments p ON p.SessionId = s.SessionId
WHERE s.Status = 'CLOSED' AND p.PaymentId IS NULL
UNION ALL
SELECT N'B3 - Có thanh toán nhưng lượt không ở trạng thái CLOSED', s.SessionId, s.PlateNumber
FROM dbo.Payments p JOIN dbo.ParkingSessions s ON s.SessionId = p.SessionId
WHERE s.Status <> 'CLOSED';

-- B4. Số tiền thu khác phí của lượt gửi
SELECT N'B4 - Tiền thu ≠ phí' AS [Lỗi], s.SessionId, s.FeeAmount, p.Amount
FROM dbo.Payments p JOIN dbo.ParkingSessions s ON s.SessionId = p.SessionId
WHERE p.Amount <> s.FeeAmount;

-- B5. Mỗi loại xe phải có đúng 1 bảng giá đang áp dụng
SELECT N'B5 - Bảng giá đang áp dụng không đúng 1' AS [Lỗi], v.Name, COUNT(p.PricingRuleId) AS [Số bảng giá]
FROM dbo.VehicleTypes v LEFT JOIN dbo.PricingRules p ON p.VehicleTypeId = v.VehicleTypeId AND p.IsActive = 1
GROUP BY v.Name HAVING COUNT(p.PricingRuleId) <> 1;

-- B6. Lượt gửi không có ảnh xe vào
SELECT N'B6 - Thiếu ảnh xe vào' AS [Lỗi], SessionId FROM dbo.ParkingSessions
WHERE CheckInImagePath IS NULL OR CheckInImagePath = '';
GO
