/**
 * ADMIN sửa / hủy lượt gửi ĐANG MỞ bị tạo nhầm (nhập sai biển số, chọn sai loại xe, tạo trùng...).
 * Bắt buộc ghi lý do; mọi thay đổi được lưu vào AuditLogs (trước/sau) để đối soát.
 * Lượt đã kết thúc (đã thu tiền) KHÔNG được sửa/hủy ở đây.
 */
const { withTransaction, isUniqueViolation } = require('../config/db');
const sessionRepo = require('../repositories/sessionRepo');
const pricingRepo = require('../repositories/pricingRepo');
const vehicleTypeRepo = require('../repositories/vehicleTypeRepo');
const auditRepo = require('../repositories/auditRepo');
const AppError = require('../utils/AppError');
const { normalizePlate, isValidPlate, formatPlate } = require('../utils/plate');
const { nowSeconds } = require('../utils/time');

async function loadOpenForUpdate(sessionId, tx) {
  const s = await sessionRepo.findById(sessionId, tx, { forUpdate: true });
  if (!s) throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy lượt gửi');
  if (s.status !== 'OPEN') throw new AppError(409, 'SESSION_NOT_OPEN', 'Chỉ sửa/hủy được lượt đang gửi');
  return s;
}

async function update({ sessionId, plateNumber, vehicleTypeId, reason, userId, ipAddress }) {
  try {
    await withTransaction(async (tx) => {
      const s = await loadOpenForUpdate(sessionId, tx);
      const vt = await vehicleTypeRepo.findById(vehicleTypeId ?? s.vehicleType.vehicleTypeId, tx);
      if (!vt) throw new AppError(400, 'VALIDATION_ERROR', 'Loại xe không hợp lệ', { field: 'vehicleTypeId' });
      const plate = plateNumber ? normalizePlate(plateNumber) : s.plateNumber;
      if (!isValidPlate(plate, vt.code)) {
        throw new AppError(400, 'INVALID_PLATE', `Biển số "${plateNumber ?? plate}" không đúng định dạng biển ${vt.name.toLowerCase()}`, { field: 'plateNumber' });
      }
      if (plate === s.plateNumber && vt.vehicleTypeId === s.vehicleType.vehicleTypeId) {
        throw new AppError(400, 'NO_CHANGE', 'Không có thay đổi nào');
      }
      // Đổi loại xe → dùng bảng giá đang áp dụng của loại xe mới; giữ nguyên loại xe → giữ giá lúc vào
      let pricingRuleId = s.pricingRuleId;
      if (vt.vehicleTypeId !== s.vehicleType.vehicleTypeId) {
        const rule = await pricingRepo.findActiveByVehicleType(vt.vehicleTypeId, tx);
        if (!rule) throw new AppError(409, 'NO_ACTIVE_PRICING', `Chưa có bảng giá cho ${vt.name}`);
        pricingRuleId = rule.pricingRuleId;
      }
      if (plate !== s.plateNumber) {
        const other = await sessionRepo.findOpenByPlate(plate, tx, { lock: true });
        if (other) throw new AppError(409, 'PLATE_ALREADY_INSIDE', `Biển số ${formatPlate(plate, vt.code)} đang có lượt gửi khác trong bãi`);
      }
      const ok = await sessionRepo.updateOpen({ sessionId, plateNumber: plate, vehicleTypeId: vt.vehicleTypeId, pricingRuleId }, tx);
      if (!ok) throw new AppError(409, 'SESSION_NOT_OPEN', 'Lượt gửi vừa thay đổi trạng thái');
      await auditRepo.log({
        userId, action: 'SESSION_EDIT', entityType: 'SESSION', entityId: sessionId, ipAddress,
        detail: { reason,
          before: { plate: s.plateNumber, vehicleTypeId: s.vehicleType.vehicleTypeId, pricingRuleId: s.pricingRuleId },
          after: { plate, vehicleTypeId: vt.vehicleTypeId, pricingRuleId } },
      }, tx);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, 'PLATE_ALREADY_INSIDE', 'Biển số này đang có lượt gửi khác trong bãi');
    throw err;
  }
  return sessionRepo.findById(sessionId);
}

async function cancel({ sessionId, reason, userId, ipAddress }) {
  await withTransaction(async (tx) => {
    const s = await loadOpenForUpdate(sessionId, tx);
    const ok = await sessionRepo.cancel({ sessionId, cancelledBy: userId, reason, cancelledAt: nowSeconds() }, tx);
    if (!ok) throw new AppError(409, 'SESSION_NOT_OPEN', 'Lượt gửi vừa thay đổi trạng thái');
    await auditRepo.log({
      userId, action: 'SESSION_CANCEL', entityType: 'SESSION', entityId: sessionId, ipAddress,
      detail: { reason, plate: s.plateNumber, checkInAt: s.checkInAt },
    }, tx);
  });
  return sessionRepo.findById(sessionId);
}

module.exports = { update, cancel };
