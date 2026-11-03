/* =====================================================================
   SMART PARKING ITS — 01-schema.sql
   Tạo database, bảng, khóa, ràng buộc và index.
   Chạy trong SSMS (hoặc sqlcmd) bằng tài khoản có quyền tạo database.

   An toàn: script KHÔNG xóa gì. Nếu database đã có bảng Users,
   script dừng lại để tránh ghi đè dữ liệu.
   Muốn tạo lại từ đầu trên máy dev: tự xóa database SmartParking
   (chuột phải > Delete trong SSMS) rồi chạy lại.

   Quy ước:
   - Thời gian lưu theo UTC (SYSUTCDATETIME). Backend đổi sang giờ VN khi hiển thị/tính phí.
   - Tiền dùng INT, đơn vị VNĐ.
   ===================================================================== */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF DB_ID(N'SmartParking') IS NULL
BEGIN
    CREATE DATABASE SmartParking;
END
GO

USE SmartParking;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
BEGIN
    RAISERROR(N'Database SmartParking đã có bảng. Dừng script để không ghi đè dữ liệu.', 16, 1);
    SET NOEXEC ON;   -- bỏ qua toàn bộ phần còn lại của script
END
GO

/* ---------------------------------------------------------------------
   1. Users — tài khoản nhân viên
   --------------------------------------------------------------------- */
CREATE TABLE dbo.Users (
    UserId        INT IDENTITY(1,1) NOT NULL,
    Username      VARCHAR(50)    NOT NULL,
    PasswordHash  VARCHAR(100)   NOT NULL,      -- chuỗi bcrypt, không bao giờ lưu mật khẩu gốc
    FullName      NVARCHAR(100)  NOT NULL,
    Role          VARCHAR(10)    NOT NULL,
    IsActive      BIT            NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
    CreatedAt     DATETIME2(0)   NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_Users PRIMARY KEY (UserId),
    CONSTRAINT UQ_Users_Username UNIQUE (Username),
    CONSTRAINT CK_Users_Role CHECK (Role IN ('ADMIN', 'STAFF'))
);
GO

/* ---------------------------------------------------------------------
   2. VehicleTypes — danh mục loại xe
   --------------------------------------------------------------------- */
CREATE TABLE dbo.VehicleTypes (
    VehicleTypeId  TINYINT       NOT NULL,
    Code           VARCHAR(20)   NOT NULL,
    Name           NVARCHAR(50)  NOT NULL,
    CONSTRAINT PK_VehicleTypes PRIMARY KEY (VehicleTypeId),
    CONSTRAINT UQ_VehicleTypes_Code UNIQUE (Code)
);
GO

/* ---------------------------------------------------------------------
   3. PricingRules — bảng giá có phiên bản (đổi giá = thêm dòng mới)
   --------------------------------------------------------------------- */
CREATE TABLE dbo.PricingRules (
    PricingRuleId     INT IDENTITY(1,1) NOT NULL,
    VehicleTypeId     TINYINT      NOT NULL,
    DayStartTime      TIME(0)      NOT NULL CONSTRAINT DF_Pricing_DayStart   DEFAULT ('06:00'),
    NightStartTime    TIME(0)      NOT NULL CONSTRAINT DF_Pricing_NightStart DEFAULT ('22:00'),
    DayFee            INT          NOT NULL,   -- phí 1 lượt khung thường
    NightFee          INT          NOT NULL,   -- phí trọn gói 1 khung đêm
    ShortStayMinutes  INT          NOT NULL CONSTRAINT DF_Pricing_ShortMin DEFAULT (30),
    ShortStayPercent  TINYINT      NOT NULL CONSTRAINT DF_Pricing_ShortPct DEFAULT (50),
    IsActive          BIT          NOT NULL CONSTRAINT DF_Pricing_IsActive DEFAULT (1),
    CreatedBy         INT          NULL,       -- NULL = dữ liệu khởi tạo ban đầu
    CreatedAt         DATETIME2(0) NOT NULL CONSTRAINT DF_Pricing_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_PricingRules PRIMARY KEY (PricingRuleId),
    CONSTRAINT FK_Pricing_VehicleType FOREIGN KEY (VehicleTypeId) REFERENCES dbo.VehicleTypes (VehicleTypeId),
    CONSTRAINT FK_Pricing_CreatedBy  FOREIGN KEY (CreatedBy)     REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Pricing_Fees       CHECK (DayFee >= 0 AND NightFee >= 0),
    CONSTRAINT CK_Pricing_ShortStay  CHECK (ShortStayMinutes >= 0 AND ShortStayPercent BETWEEN 0 AND 100),
    CONSTRAINT CK_Pricing_Times      CHECK (DayStartTime < NightStartTime)
);
GO

-- Mỗi loại xe chỉ có đúng 1 bảng giá đang áp dụng
CREATE UNIQUE INDEX UX_Pricing_ActivePerVehicleType
    ON dbo.PricingRules (VehicleTypeId)
    WHERE IsActive = 1;
GO

/* ---------------------------------------------------------------------
   4. ParkingSessions — lượt gửi xe (bảng trung tâm)
   --------------------------------------------------------------------- */
CREATE TABLE dbo.ParkingSessions (
    SessionId            BIGINT IDENTITY(1,1) NOT NULL,
    PlateNumber          NVARCHAR(12)   NOT NULL,   -- đã chuẩn hóa: 51F12345, 59X112345 (NVARCHAR để lưu được chữ Đ, ví dụ biển MĐ)
    VehicleTypeId        TINYINT        NOT NULL,
    PricingRuleId        INT            NOT NULL,   -- giá có hiệu lực lúc xe vào
    Status               VARCHAR(10)    NOT NULL CONSTRAINT DF_Sessions_Status DEFAULT ('OPEN'),

    CheckInAt            DATETIME2(0)   NOT NULL,
    CheckInImagePath     NVARCHAR(260)  NOT NULL,
    CheckInBy            INT            NOT NULL,
    CheckInPlateEdited   BIT            NOT NULL CONSTRAINT DF_Sessions_InEdited DEFAULT (0),

    CheckOutAt           DATETIME2(0)   NULL,
    CheckOutImagePath    NVARCHAR(260)  NULL,
    CheckOutBy           INT            NULL,
    CheckOutPlateEdited  BIT            NULL,
    FeeAmount            INT            NULL,
    FeeBreakdown         NVARCHAR(MAX)  NULL,       -- JSON chi tiết cách tính phí

    CancelledAt          DATETIME2(0)   NULL,
    CancelledBy          INT            NULL,
    CancelReason         NVARCHAR(255)  NULL,

    CONSTRAINT PK_ParkingSessions PRIMARY KEY (SessionId),
    CONSTRAINT FK_Sessions_VehicleType FOREIGN KEY (VehicleTypeId) REFERENCES dbo.VehicleTypes (VehicleTypeId),
    CONSTRAINT FK_Sessions_Pricing     FOREIGN KEY (PricingRuleId) REFERENCES dbo.PricingRules (PricingRuleId),
    CONSTRAINT FK_Sessions_CheckInBy   FOREIGN KEY (CheckInBy)     REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Sessions_CheckOutBy  FOREIGN KEY (CheckOutBy)    REFERENCES dbo.Users (UserId),
    CONSTRAINT FK_Sessions_CancelledBy FOREIGN KEY (CancelledBy)   REFERENCES dbo.Users (UserId),

    CONSTRAINT CK_Sessions_Status   CHECK (Status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    CONSTRAINT CK_Sessions_TimeOrder CHECK (CheckOutAt IS NULL OR CheckOutAt >= CheckInAt),
    CONSTRAINT CK_Sessions_Fee      CHECK (FeeAmount IS NULL OR FeeAmount >= 0),
    -- Dữ liệu phải khớp với trạng thái
    CONSTRAINT CK_Sessions_StateConsistency CHECK (
        (Status = 'OPEN'
            AND CheckOutAt IS NULL AND FeeAmount IS NULL AND CheckOutBy IS NULL
            AND CancelledAt IS NULL)
     OR (Status = 'CLOSED'
            AND CheckOutAt IS NOT NULL AND FeeAmount IS NOT NULL AND CheckOutBy IS NOT NULL
            AND CheckOutImagePath IS NOT NULL AND CancelledAt IS NULL)
     OR (Status = 'CANCELLED'
            AND CancelledAt IS NOT NULL AND CancelledBy IS NOT NULL AND CancelReason IS NOT NULL
            AND CheckOutAt IS NULL AND FeeAmount IS NULL)
    )
);
GO

-- QUAN TRỌNG: một biển số chỉ có tối đa 1 lượt đang mở
CREATE UNIQUE INDEX UX_Sessions_OpenPlate
    ON dbo.ParkingSessions (PlateNumber)
    WHERE Status = 'OPEN';
GO

CREATE INDEX IX_Sessions_Plate      ON dbo.ParkingSessions (PlateNumber, CheckInAt DESC);
CREATE INDEX IX_Sessions_CheckInAt  ON dbo.ParkingSessions (CheckInAt);
CREATE INDEX IX_Sessions_CheckOutAt ON dbo.ParkingSessions (CheckOutAt) WHERE CheckOutAt IS NOT NULL;
GO

/* ---------------------------------------------------------------------
   5. RecognitionLogs — mỗi lần tải ảnh/nhận diện (kể cả thất bại)
   --------------------------------------------------------------------- */
CREATE TABLE dbo.RecognitionLogs (
    RecognitionId    BIGINT IDENTITY(1,1) NOT NULL,
    Direction        VARCHAR(3)     NOT NULL,
    Source           VARCHAR(10)    NOT NULL CONSTRAINT DF_Recog_Source DEFAULT ('UPLOAD'),
    ImagePath        NVARCHAR(260)  NOT NULL,
    CropImagePath    NVARCHAR(260)  NULL,
    RecognizedPlate  NVARCHAR(12)   NULL,
    Candidates       NVARCHAR(MAX)  NULL,          -- JSON khi ảnh có nhiều biển số
    Confidence       DECIMAL(5,4)   NULL,
    Status           VARCHAR(20)    NOT NULL,
    ErrorMessage     NVARCHAR(500)  NULL,          -- lỗi kỹ thuật, chỉ dùng nội bộ
    EngineName       VARCHAR(50)    NULL,
    ProcessingMs     INT            NULL,
    ConfirmedPlate   NVARCHAR(12)   NULL,
    SessionId        BIGINT         NULL,          -- gắn khi ảnh đã được dùng cho xe vào/ra
    CreatedBy        INT            NOT NULL,
    CreatedAt        DATETIME2(0)   NOT NULL CONSTRAINT DF_Recog_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_RecognitionLogs PRIMARY KEY (RecognitionId),
    CONSTRAINT FK_Recog_Session   FOREIGN KEY (SessionId) REFERENCES dbo.ParkingSessions (SessionId),
    CONSTRAINT FK_Recog_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Recog_Direction CHECK (Direction IN ('IN', 'OUT')),
    CONSTRAINT CK_Recog_Source    CHECK (Source IN ('UPLOAD', 'CAMERA')),
    CONSTRAINT CK_Recog_Status    CHECK (Status IN ('SUCCESS', 'LOW_CONFIDENCE', 'NOT_FOUND', 'MULTIPLE', 'ERROR')),
    CONSTRAINT CK_Recog_Confidence CHECK (Confidence IS NULL OR (Confidence >= 0 AND Confidence <= 1))
);
GO

CREATE INDEX IX_Recog_Session   ON dbo.RecognitionLogs (SessionId) WHERE SessionId IS NOT NULL;
CREATE INDEX IX_Recog_CreatedAt ON dbo.RecognitionLogs (CreatedAt);
GO

/* ---------------------------------------------------------------------
   6. Payments — ghi nhận thu tiền tại quầy
   --------------------------------------------------------------------- */
CREATE TABLE dbo.Payments (
    PaymentId   BIGINT IDENTITY(1,1) NOT NULL,
    SessionId   BIGINT        NOT NULL,
    Amount      INT           NOT NULL,
    Method      VARCHAR(10)   NOT NULL CONSTRAINT DF_Payments_Method DEFAULT ('CASH'),
    ReceivedBy  INT           NOT NULL,
    PaidAt      DATETIME2(0)  NOT NULL,
    CONSTRAINT PK_Payments PRIMARY KEY (PaymentId),
    CONSTRAINT UQ_Payments_Session UNIQUE (SessionId),     -- mỗi lượt chỉ thu tiền 1 lần
    CONSTRAINT FK_Payments_Session    FOREIGN KEY (SessionId)  REFERENCES dbo.ParkingSessions (SessionId),
    CONSTRAINT FK_Payments_ReceivedBy FOREIGN KEY (ReceivedBy) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Payments_Amount CHECK (Amount >= 0),
    CONSTRAINT CK_Payments_Method CHECK (Method IN ('CASH'))
);
GO

CREATE INDEX IX_Payments_PaidAt ON dbo.Payments (PaidAt);
GO

/* ---------------------------------------------------------------------
   7. AuditLogs — nhật ký thao tác quan trọng
   --------------------------------------------------------------------- */
CREATE TABLE dbo.AuditLogs (
    AuditId     BIGINT IDENTITY(1,1) NOT NULL,
    UserId      INT            NULL,
    Action      VARCHAR(30)    NOT NULL,
    EntityType  VARCHAR(30)    NULL,
    EntityId    BIGINT         NULL,
    Detail      NVARCHAR(MAX)  NULL,      -- JSON
    IpAddress   VARCHAR(45)    NULL,
    CreatedAt   DATETIME2(0)   NOT NULL CONSTRAINT DF_Audit_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_AuditLogs PRIMARY KEY (AuditId),
    CONSTRAINT FK_Audit_User FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
);
GO

CREATE INDEX IX_Audit_CreatedAt ON dbo.AuditLogs (CreatedAt);
CREATE INDEX IX_Audit_Entity    ON dbo.AuditLogs (EntityType, EntityId);
GO

SET NOEXEC OFF;
GO
PRINT N'Hoàn tất 01-schema.sql';
GO
