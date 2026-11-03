/** Truy cập bảng PricingRules (bảng giá có phiên bản: đổi giá = thêm dòng mới, không sửa đè). */
const { sql, request } = require('../config/db');

/** mssql trả kiểu TIME thành Date (ngày 1970-01-01 UTC) → đổi về chuỗi "HH:mm" cho dễ dùng */
function timeToHHmm(value) {
  if (typeof value === 'string') return value.slice(0, 5);
  const d = new Date(value);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
/** "HH:mm" → Date để truyền vào tham số kiểu TIME */
function hhmmToDate(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m));
}

const COLUMNS = `p.PricingRuleId, p.VehicleTypeId, p.DayStartTime, p.NightStartTime, p.DayFee, p.NightFee,
  p.ShortStayMinutes, p.ShortStayPercent, p.IsActive, p.CreatedAt,
  v.Code AS VehicleTypeCode, v.Name AS VehicleTypeName, u.FullName AS CreatedByName`;
const FROM = `FROM dbo.PricingRules p
  JOIN dbo.VehicleTypes v ON v.VehicleTypeId = p.VehicleTypeId
  LEFT JOIN dbo.Users u ON u.UserId = p.CreatedBy`;

function toRule(r) {
  if (!r) return null;
  return {
    pricingRuleId: r.PricingRuleId,
    vehicleTypeId: r.VehicleTypeId,
    vehicleType: { vehicleTypeId: r.VehicleTypeId, code: r.VehicleTypeCode, name: r.VehicleTypeName },
    dayStartTime: timeToHHmm(r.DayStartTime),
    nightStartTime: timeToHHmm(r.NightStartTime),
    dayFee: r.DayFee,
    nightFee: r.NightFee,
    shortStayMinutes: r.ShortStayMinutes,
    shortStayPercent: r.ShortStayPercent,
    isActive: r.IsActive === true,
    createdAt: r.CreatedAt,
    createdByName: r.CreatedByName ?? null,
  };
}

async function findActiveByVehicleType(vehicleTypeId, tx) {
  const req = await request(tx);
  const result = await req
    .input('vt', sql.TinyInt, vehicleTypeId)
    .query(`SELECT ${COLUMNS} ${FROM} WHERE p.VehicleTypeId = @vt AND p.IsActive = 1`);
  return toRule(result.recordset[0]);
}

async function findById(pricingRuleId, tx) {
  const req = await request(tx);
  const result = await req
    .input('id', sql.Int, pricingRuleId)
    .query(`SELECT ${COLUMNS} ${FROM} WHERE p.PricingRuleId = @id`);
  return toRule(result.recordset[0]);
}

async function findAllActive() {
  const req = await request();
  const result = await req.query(`SELECT ${COLUMNS} ${FROM} WHERE p.IsActive = 1 ORDER BY p.VehicleTypeId`);
  return result.recordset.map(toRule);
}

/** Lịch sử các phiên bản giá (mới nhất trước) */
async function listHistory(vehicleTypeId, limit = 10) {
  const req = await request();
  const result = await req
    .input('vt', sql.TinyInt, vehicleTypeId)
    .input('limit', sql.Int, limit)
    .query(`SELECT TOP (@limit) ${COLUMNS} ${FROM} WHERE p.VehicleTypeId = @vt ORDER BY p.PricingRuleId DESC`);
  return result.recordset.map(toRule);
}

/** Tắt bảng giá đang áp dụng của 1 loại xe (khóa dòng tới hết transaction). */
async function deactivateActive(vehicleTypeId, tx) {
  const req = await request(tx);
  const result = await req
    .input('vt', sql.TinyInt, vehicleTypeId)
    .query(`UPDATE dbo.PricingRules SET IsActive = 0
            OUTPUT DELETED.PricingRuleId
            WHERE VehicleTypeId = @vt AND IsActive = 1`);
  return result.recordset[0]?.PricingRuleId ?? null;
}

async function insertActive(rule, tx) {
  const req = await request(tx);
  const result = await req
    .input('vt', sql.TinyInt, rule.vehicleTypeId)
    .input('dayStart', sql.Time(0), hhmmToDate(rule.dayStartTime))
    .input('nightStart', sql.Time(0), hhmmToDate(rule.nightStartTime))
    .input('dayFee', sql.Int, rule.dayFee)
    .input('nightFee', sql.Int, rule.nightFee)
    .input('shortMin', sql.Int, rule.shortStayMinutes)
    .input('shortPct', sql.TinyInt, rule.shortStayPercent)
    .input('by', sql.Int, rule.createdBy)
    .query(`INSERT INTO dbo.PricingRules
              (VehicleTypeId, DayStartTime, NightStartTime, DayFee, NightFee, ShortStayMinutes, ShortStayPercent, IsActive, CreatedBy)
            OUTPUT INSERTED.PricingRuleId
            VALUES (@vt, @dayStart, @nightStart, @dayFee, @nightFee, @shortMin, @shortPct, 1, @by)`);
  return result.recordset[0].PricingRuleId;
}

module.exports = { findActiveByVehicleType, findById, findAllActive, listHistory, deactivateActive, insertActive };
