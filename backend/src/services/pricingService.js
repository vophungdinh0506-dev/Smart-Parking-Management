/**
 * Quản lý biểu phí.
 * Đổi giá = tắt phiên bản cũ + thêm phiên bản mới (trong 1 transaction).
 * Xe ĐANG GỬI vẫn tính theo giá lúc vào (ParkingSessions.PricingRuleId), chỉ xe vào SAU mới dùng giá mới.
 */
const { withTransaction } = require('../config/db');
const pricingRepo = require('../repositories/pricingRepo');
const vehicleTypeRepo = require('../repositories/vehicleTypeRepo');
const auditRepo = require('../repositories/auditRepo');
const AppError = require('../utils/AppError');
const { calculateFee } = require('../utils/feeCalculator');

const MAX_FEE = 10_000_000;

const invalid = (message, field) => new AppError(400, 'VALIDATION_ERROR', message, { field });

function hhmm(value, field, label) {
  const s = String(value ?? '').trim();
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) throw invalid(`${label} phải có dạng giờ:phút, ví dụ 06:00`, field);
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}
function intInRange(value, field, label, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw invalid(`${label} phải là số nguyên từ ${min.toLocaleString('vi-VN')} đến ${max.toLocaleString('vi-VN')}`, field);
  return n;
}

/** Kiểm tra và chuẩn hóa dữ liệu biểu phí từ người dùng */
function parseRuleInput(body) {
  const rule = {
    dayStartTime: hhmm(body?.dayStartTime, 'dayStartTime', 'Giờ bắt đầu khung thường'),
    nightStartTime: hhmm(body?.nightStartTime, 'nightStartTime', 'Giờ bắt đầu khung đêm'),
    dayFee: intInRange(body?.dayFee, 'dayFee', 'Phí khung thường', 0, MAX_FEE),
    nightFee: intInRange(body?.nightFee, 'nightFee', 'Phí khung đêm', 0, MAX_FEE),
    shortStayMinutes: intInRange(body?.shortStayMinutes, 'shortStayMinutes', 'Số phút gửi ngắn', 0, 1440),
    shortStayPercent: intInRange(body?.shortStayPercent, 'shortStayPercent', 'Phần trăm gửi ngắn', 0, 100),
  };
  if (rule.dayStartTime >= rule.nightStartTime) {
    throw invalid('Giờ bắt đầu khung thường phải sớm hơn giờ bắt đầu khung đêm', 'nightStartTime');
  }
  return rule;
}

async function getVehicleType(vehicleTypeId) {
  const vt = await vehicleTypeRepo.findById(intInRange(vehicleTypeId, 'vehicleTypeId', 'Loại xe', 1, 255));
  if (!vt) throw invalid('Loại xe không hợp lệ', 'vehicleTypeId');
  return vt;
}

async function createVersion({ vehicleTypeId, body, userId, ipAddress }) {
  const vt = await getVehicleType(vehicleTypeId);
  const rule = parseRuleInput(body);
  const newId = await withTransaction(async (tx) => {
    const oldId = await pricingRepo.deactivateActive(vt.vehicleTypeId, tx);
    const id = await pricingRepo.insertActive({ ...rule, vehicleTypeId: vt.vehicleTypeId, createdBy: userId }, tx);
    await auditRepo.log({
      userId, action: 'PRICE_CHANGE', entityType: 'PRICING_RULE', entityId: id, ipAddress,
      detail: { vehicleTypeId: vt.vehicleTypeId, previousRuleId: oldId, newRule: rule },
    }, tx);
    return id;
  });
  return pricingRepo.findById(newId);
}

/**
 * Thử tính phí (không lưu gì): dùng biểu phí đang áp dụng, hoặc biểu phí nháp nếu có body.rule
 * — để admin thử trước khi lưu, và để kiểm thử TC07.
 */
async function simulate({ vehicleTypeId, checkInAt, checkOutAt, draftRule }) {
  const vt = await getVehicleType(vehicleTypeId);
  const from = new Date(checkInAt);
  const to = new Date(checkOutAt);
  if (Number.isNaN(from.getTime())) throw invalid('Giờ vào không hợp lệ', 'checkInAt');
  if (Number.isNaN(to.getTime())) throw invalid('Giờ ra không hợp lệ', 'checkOutAt');
  if (to < from) throw new AppError(400, 'INVALID_TIME_RANGE', 'Giờ ra không được sớm hơn giờ vào', { field: 'checkOutAt' });
  if (to - from > 366 * 24 * 3600 * 1000) throw invalid('Khoảng thời gian thử tính tối đa 1 năm', 'checkOutAt');

  const rule = draftRule ? parseRuleInput(draftRule) : await pricingRepo.findActiveByVehicleType(vt.vehicleTypeId);
  if (!rule) throw new AppError(409, 'NO_ACTIVE_PRICING', `Chưa có bảng giá cho ${vt.name}`);
  return { vehicleType: vt, fee: calculateFee(from, to, rule) };
}

module.exports = { createVersion, simulate, parseRuleInput };
