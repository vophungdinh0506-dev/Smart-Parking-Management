/** Truy cập bảng ParkingSessions (lượt gửi xe). Chỉ chứa câu SQL có tham số. */
const { sql, request } = require('../config/db');

const SELECT_COLUMNS = `
  s.SessionId, s.PlateNumber, s.Status, s.PricingRuleId,
  s.CheckInAt, s.CheckInPlateEdited, s.CheckInImagePath,
  s.CheckOutAt, s.CheckOutPlateEdited, s.CheckOutImagePath, s.FeeAmount, s.FeeBreakdown,
  s.CancelledAt, s.CancelReason,
  v.VehicleTypeId, v.Code AS VehicleTypeCode, v.Name AS VehicleTypeName,
  ui.FullName AS CheckInByName, uo.FullName AS CheckOutByName, uc.FullName AS CancelledByName`;

/** FROM + JOIN; tableHint dùng để khóa dòng khi cần (WITH (UPDLOCK, ROWLOCK)...) */
const fromJoins = (tableHint = '') => `
  FROM dbo.ParkingSessions s ${tableHint}
  JOIN dbo.VehicleTypes v ON v.VehicleTypeId = s.VehicleTypeId
  JOIN dbo.Users ui ON ui.UserId = s.CheckInBy
  LEFT JOIN dbo.Users uo ON uo.UserId = s.CheckOutBy
  LEFT JOIN dbo.Users uc ON uc.UserId = s.CancelledBy`;

function toSession(r) {
  if (!r) return null;
  return {
    sessionId: Number(r.SessionId),
    plateNumber: r.PlateNumber,
    status: r.Status,
    vehicleType: { vehicleTypeId: r.VehicleTypeId, code: r.VehicleTypeCode, name: r.VehicleTypeName },
    pricingRuleId: r.PricingRuleId,
    checkInAt: r.CheckInAt,
    checkInByName: r.CheckInByName,
    checkInPlateEdited: r.CheckInPlateEdited === true,
    checkInImagePath: r.CheckInImagePath,
    checkOutAt: r.CheckOutAt,
    checkOutByName: r.CheckOutByName ?? null,
    checkOutPlateEdited: r.CheckOutPlateEdited === true,
    checkOutImagePath: r.CheckOutImagePath,
    feeAmount: r.FeeAmount,
    feeBreakdown: r.FeeBreakdown ? JSON.parse(r.FeeBreakdown) : null,
    cancelledAt: r.CancelledAt ?? null,
    cancelledByName: r.CancelledByName ?? null,
    cancelReason: r.CancelReason ?? null,
  };
}

/**
 * Tìm lượt ĐANG MỞ của biển số.
 * lock = true (trong transaction): khóa "khoảng" biển số này tới khi transaction kết thúc,
 * nên 2 nhân viên bấm cùng lúc thì người sau phải chờ người trước xong rồi mới kiểm tra.
 */
async function findOpenByPlate(plateNumber, tx, { lock = false } = {}) {
  const req = await request(tx);
  const result = await req
    .input('plate', sql.NVarChar(12), plateNumber)
    .query(`SELECT ${SELECT_COLUMNS} ${fromJoins(lock ? 'WITH (UPDLOCK, HOLDLOCK)' : '')}
            WHERE s.PlateNumber = @plate AND s.Status = 'OPEN'`);
  return toSession(result.recordset[0]);
}

/**
 * Gợi ý khi không tìm thấy biển số lúc xe ra (AI/nhân viên có thể đọc sai 1–2 ký tự):
 * các xe ĐANG GỬI có cùng 4 số cuối.
 */
async function findOpenSimilar(plateNumber, limit = 5) {
  const lastDigits = (plateNumber.match(/[0-9]{4}$/) || [])[0];
  if (!lastDigits) return [];
  const req = await request();
  const result = await req
    .input('suffix', sql.NVarChar(12), `%${lastDigits}`)
    .input('limit', sql.Int, limit)
    .query(`SELECT TOP (@limit) ${SELECT_COLUMNS} ${fromJoins()}
            WHERE s.Status = 'OPEN' AND s.PlateNumber LIKE @suffix
            ORDER BY s.CheckInAt DESC`);
  return result.recordset.map(toSession);
}

async function insertOpen(s, tx) {
  const req = await request(tx);
  const result = await req
    .input('plate', sql.NVarChar(12), s.plateNumber)
    .input('vt', sql.TinyInt, s.vehicleTypeId)
    .input('rule', sql.Int, s.pricingRuleId)
    .input('checkInAt', sql.DateTime2(0), s.checkInAt)
    .input('image', sql.NVarChar(260), s.checkInImagePath)
    .input('by', sql.Int, s.checkInBy)
    .input('edited', sql.Bit, s.checkInPlateEdited)
    .query(`INSERT INTO dbo.ParkingSessions
              (PlateNumber, VehicleTypeId, PricingRuleId, Status, CheckInAt, CheckInImagePath, CheckInBy, CheckInPlateEdited)
            OUTPUT INSERTED.SessionId
            VALUES (@plate, @vt, @rule, 'OPEN', @checkInAt, @image, @by, @edited)`);
  return Number(result.recordset[0].SessionId);
}

/** Đọc 1 lượt gửi. forUpdate = true: khóa dòng tới hết transaction (chống 2 người đóng cùng lúc). */
async function findById(sessionId, tx, { forUpdate = false } = {}) {
  const req = await request(tx);
  const result = await req
    .input('id', sql.BigInt, sessionId)
    .query(`SELECT ${SELECT_COLUMNS} ${fromJoins(forUpdate ? 'WITH (UPDLOCK, ROWLOCK)' : '')}
            WHERE s.SessionId = @id`);
  return toSession(result.recordset[0]);
}

/**
 * Đóng lượt gửi. Điều kiện "AND Status = 'OPEN'" đảm bảo không đóng 1 lượt 2 lần.
 * @returns {Promise<boolean>} true nếu đóng thành công
 */
async function close(c, tx) {
  const req = await request(tx);
  const result = await req
    .input('id', sql.BigInt, c.sessionId)
    .input('checkOutAt', sql.DateTime2(0), c.checkOutAt)
    .input('image', sql.NVarChar(260), c.checkOutImagePath)
    .input('by', sql.Int, c.checkOutBy)
    .input('edited', sql.Bit, c.checkOutPlateEdited)
    .input('fee', sql.Int, c.feeAmount)
    .input('breakdown', sql.NVarChar(sql.MAX), JSON.stringify(c.feeBreakdown))
    .query(`UPDATE dbo.ParkingSessions
            SET Status = 'CLOSED', CheckOutAt = @checkOutAt, CheckOutImagePath = @image, CheckOutBy = @by,
                CheckOutPlateEdited = @edited, FeeAmount = @fee, FeeBreakdown = @breakdown
            WHERE SessionId = @id AND Status = 'OPEN'`);
  return result.rowsAffected[0] === 1;
}

/** Admin hủy lượt tạo nhầm. @returns {Promise<boolean>} */
async function cancel({ sessionId, cancelledBy, reason, cancelledAt }, tx) {
  const req = await request(tx);
  const result = await req
    .input('id', sql.BigInt, sessionId)
    .input('by', sql.Int, cancelledBy)
    .input('reason', sql.NVarChar(255), reason)
    .input('at', sql.DateTime2(0), cancelledAt)
    .query(`UPDATE dbo.ParkingSessions
            SET Status = 'CANCELLED', CancelledAt = @at, CancelledBy = @by, CancelReason = @reason
            WHERE SessionId = @id AND Status = 'OPEN'`);
  return result.rowsAffected[0] === 1;
}

/** Admin sửa biển số / loại xe của lượt đang mở. @returns {Promise<boolean>} */
async function updateOpen({ sessionId, plateNumber, vehicleTypeId, pricingRuleId }, tx) {
  const req = await request(tx);
  const result = await req
    .input('id', sql.BigInt, sessionId)
    .input('plate', sql.NVarChar(12), plateNumber)
    .input('vt', sql.TinyInt, vehicleTypeId)
    .input('rule', sql.Int, pricingRuleId)
    .query(`UPDATE dbo.ParkingSessions
            SET PlateNumber = @plate, VehicleTypeId = @vt, PricingRuleId = @rule, CheckInPlateEdited = 1
            WHERE SessionId = @id AND Status = 'OPEN'`);
  return result.rowsAffected[0] === 1;
}

/** Đường dẫn ảnh của lượt gửi (dùng cho API xem ảnh). */
async function findImagePaths(sessionId) {
  const req = await request();
  const result = await req
    .input('id', sql.BigInt, sessionId)
    .query('SELECT CheckInImagePath, CheckOutImagePath FROM dbo.ParkingSessions WHERE SessionId = @id');
  const r = result.recordset[0];
  return r ? { in: r.CheckInImagePath, out: r.CheckOutImagePath } : null;
}

/** Danh sách có lọc + phân trang. from/to: lọc theo giờ VÀO (Date, giờ UTC). */
async function list({ status, plate, from, to, page = 1, pageSize = 20 }) {
  const req = await request();
  const where = [];
  if (status) { where.push('s.Status = @status'); req.input('status', sql.VarChar(10), status); }
  if (plate) { where.push('s.PlateNumber LIKE @plate'); req.input('plate', sql.NVarChar(14), `%${plate}%`); }
  if (from) { where.push('s.CheckInAt >= @from'); req.input('from', sql.DateTime2(0), from); }
  if (to) { where.push('s.CheckInAt < @to'); req.input('to', sql.DateTime2(0), to); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  req.input('offset', sql.Int, (page - 1) * pageSize).input('size', sql.Int, pageSize);

  const result = await req.query(`
    SELECT COUNT(*) AS Total FROM dbo.ParkingSessions s ${whereSql};
    SELECT ${SELECT_COLUMNS} ${fromJoins()} ${whereSql}
    ORDER BY s.CheckInAt DESC, s.SessionId DESC
    OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;`);
  return { total: result.recordsets[0][0].Total, items: result.recordsets[1].map(toSession) };
}

module.exports = {
  findOpenByPlate, findOpenSimilar, insertOpen, findById, close, cancel, updateOpen, findImagePaths, list,
};
