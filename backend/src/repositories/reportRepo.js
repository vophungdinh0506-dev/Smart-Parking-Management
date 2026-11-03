/**
 * Truy vấn báo cáo doanh thu (CHỨC NĂNG MỞ RỘNG — ngoài phạm vi chính của đề cương).
 * Doanh thu lấy từ bảng Payments (tiền thực thu), nhóm theo NGÀY GIỜ VIỆT NAM.
 */
const { sql, request } = require('../config/db');

/** @param {Date} from @param {Date} to  (UTC, to không bao gồm) */
async function revenue(from, to) {
  const req = await request();
  req.input('from', sql.DateTime2(0), from).input('to', sql.DateTime2(0), to);
  const result = await req.query(`
    SELECT CONVERT(char(10), CAST(DATEADD(HOUR, 7, p.PaidAt) AS date), 23) AS Day,
           s.VehicleTypeId, v.Name AS VehicleTypeName,
           SUM(p.Amount) AS Amount, COUNT(*) AS Count
    FROM dbo.Payments p
    JOIN dbo.ParkingSessions s ON s.SessionId = p.SessionId
    JOIN dbo.VehicleTypes v ON v.VehicleTypeId = s.VehicleTypeId
    WHERE p.PaidAt >= @from AND p.PaidAt < @to
    GROUP BY CAST(DATEADD(HOUR, 7, p.PaidAt) AS date), s.VehicleTypeId, v.Name
    ORDER BY Day, s.VehicleTypeId;

    SELECT COUNT(*) AS Cancelled FROM dbo.ParkingSessions
    WHERE Status = 'CANCELLED' AND CancelledAt >= @from AND CancelledAt < @to;`);
  return {
    rows: result.recordsets[0].map((r) => ({
      day: r.Day, vehicleTypeId: r.VehicleTypeId, vehicleTypeName: r.VehicleTypeName, amount: r.Amount, count: r.Count,
    })),
    cancelledCount: result.recordsets[1][0].Cancelled,
  };
}

module.exports = { revenue };
