/** Truy cập bảng ParkingSessions (lượt gửi xe). */
const { sql, request } = require('../config/db');

const SELECT_COLUMNS = `
  s.SessionId, s.PlateNumber, s.Status, s.CheckInAt, s.CheckOutAt, s.FeeAmount,
  s.CheckInPlateEdited, s.PricingRuleId,
  v.VehicleTypeId, v.Code AS VehicleTypeCode, v.Name AS VehicleTypeName,
  ui.FullName AS CheckInByName`;
const FROM_JOINS = `
  FROM dbo.ParkingSessions s
  JOIN dbo.VehicleTypes v ON v.VehicleTypeId = s.VehicleTypeId
  JOIN dbo.Users ui ON ui.UserId = s.CheckInBy`;

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
    checkOutAt: r.CheckOutAt,
    feeAmount: r.FeeAmount,
  };
}

/**
 * Tìm lượt ĐANG MỞ của biển số.
 * lock = true (trong transaction): khóa "khoảng" biển số này tới khi transaction kết thúc,
 * nên 2 nhân viên bấm cùng lúc thì người sau phải chờ người trước xong rồi mới kiểm tra.
 */
async function findOpenByPlate(plateNumber, tx, { lock = false } = {}) {
  const req = await request(tx);
  const hint = lock ? 'WITH (UPDLOCK, HOLDLOCK)' : '';
  const result = await req
    .input('plate', sql.NVarChar(12), plateNumber)
    .query(`SELECT ${SELECT_COLUMNS}
            FROM dbo.ParkingSessions s ${hint}
            JOIN dbo.VehicleTypes v ON v.VehicleTypeId = s.VehicleTypeId
            JOIN dbo.Users ui ON ui.UserId = s.CheckInBy
            WHERE s.PlateNumber = @plate AND s.Status = 'OPEN'`);
  return toSession(result.recordset[0]);
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

async function findById(sessionId, tx) {
  const req = await request(tx);
  const result = await req
    .input('id', sql.BigInt, sessionId)
    .query(`SELECT ${SELECT_COLUMNS} ${FROM_JOINS} WHERE s.SessionId = @id`);
  return toSession(result.recordset[0]);
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

/** Danh sách có lọc + phân trang. */
async function list({ status, plate, page = 1, pageSize = 20 }) {
  const req = await request();
  const where = [];
  if (status) { where.push('s.Status = @status'); req.input('status', sql.VarChar(10), status); }
  if (plate) { where.push('s.PlateNumber LIKE @plate'); req.input('plate', sql.NVarChar(14), `%${plate}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  req.input('offset', sql.Int, (page - 1) * pageSize).input('size', sql.Int, pageSize);

  const result = await req.query(`
    SELECT COUNT(*) AS Total FROM dbo.ParkingSessions s ${whereSql};
    SELECT ${SELECT_COLUMNS} ${FROM_JOINS} ${whereSql}
    ORDER BY s.CheckInAt DESC, s.SessionId DESC
    OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;`);
  return { total: result.recordsets[0][0].Total, items: result.recordsets[1].map(toSession) };
}

module.exports = { findOpenByPlate, insertOpen, findById, findImagePaths, list };
