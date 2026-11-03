/** Truy cập bảng PricingRules (bảng giá có phiên bản). */
const { sql, request } = require('../config/db');

function toRule(r) {
  if (!r) return null;
  return {
    pricingRuleId: r.PricingRuleId,
    vehicleTypeId: r.VehicleTypeId,
    dayStartTime: r.DayStartTime,     // mssql trả kiểu TIME thành Date (ngày 1970-01-01 UTC)
    nightStartTime: r.NightStartTime,
    dayFee: r.DayFee,
    nightFee: r.NightFee,
    shortStayMinutes: r.ShortStayMinutes,
    shortStayPercent: r.ShortStayPercent,
    isActive: r.IsActive === true,
  };
}

async function findActiveByVehicleType(vehicleTypeId, tx) {
  const req = await request(tx);
  const result = await req
    .input('vt', sql.TinyInt, vehicleTypeId)
    .query('SELECT * FROM dbo.PricingRules WHERE VehicleTypeId = @vt AND IsActive = 1');
  return toRule(result.recordset[0]);
}

async function findById(pricingRuleId, tx) {
  const req = await request(tx);
  const result = await req
    .input('id', sql.Int, pricingRuleId)
    .query('SELECT * FROM dbo.PricingRules WHERE PricingRuleId = @id');
  return toRule(result.recordset[0]);
}

module.exports = { findActiveByVehicleType, findById };
