/**
 * NGHIỆP VỤ XE VÀO BÃI
 *
 * Điều kiện tạo lượt gửi:
 *  - Có ảnh đã tải lên (recognitionId), ảnh hướng VÀO, chưa dùng, chưa quá 30 phút.
 *  - Biển số do NHÂN VIÊN xác nhận (có thể khác kết quả AI), đúng định dạng theo loại xe.
 *  - Biển số chưa có lượt gửi đang mở.
 * Mọi thao tác ghi nằm trong 1 transaction → không bao giờ lưu dở dang.
 * Thời gian vào do SERVER tạo, không nhận từ frontend.
 */
const { withTransaction, isUniqueViolation } = require('../config/db');
const config = require('../config/env');
const recognitionRepo = require('../repositories/recognitionRepo');
const sessionRepo = require('../repositories/sessionRepo');
const pricingRepo = require('../repositories/pricingRepo');
const vehicleTypeRepo = require('../repositories/vehicleTypeRepo');
const auditRepo = require('../repositories/auditRepo');
const AppError = require('../utils/AppError');
const { normalizePlate, isValidPlate, formatPlate } = require('../utils/plate');
const { nowSeconds, formatVN } = require('../utils/time');

function alreadyInsideError(open) {
  return new AppError(409, 'PLATE_ALREADY_INSIDE',
    `Xe ${formatPlate(open.plateNumber, open.vehicleType.code)} đang ở trong bãi (vào lúc ${formatVN(open.checkInAt)}). Không thể tạo thêm lượt gửi.`,
    { sessionId: open.sessionId, checkInAt: open.checkInAt });
}

/**
 * @param {{recognitionId:number, plateNumber:string, vehicleTypeId:number, userId:number, ipAddress?:string}} input
 */
async function checkIn({ recognitionId, plateNumber, vehicleTypeId, userId, ipAddress }) {
  const plate = normalizePlate(plateNumber);

  try {
    const sessionId = await withTransaction(async (tx) => {
      // 1. Ảnh nhận diện (khóa dòng để 2 người không dùng cùng 1 ảnh)
      const rec = await recognitionRepo.findById(recognitionId, tx, { forUpdate: true });
      if (!rec) throw new AppError(404, 'RECOGNITION_NOT_FOUND', 'Không tìm thấy ảnh đã tải lên. Vui lòng tải ảnh lại.');
      if (rec.direction !== 'IN') throw new AppError(400, 'WRONG_DIRECTION', 'Ảnh này được tải lên cho xe RA, không dùng cho xe vào.');
      if (rec.sessionId !== null) throw new AppError(409, 'RECOGNITION_ALREADY_USED', 'Ảnh này đã được dùng để tạo lượt gửi. Vui lòng tải ảnh mới.');
      const ageMinutes = (Date.now() - new Date(rec.createdAt).getTime()) / 60000;
      if (ageMinutes > config.upload.maxAgeMinutes) {
        throw new AppError(400, 'RECOGNITION_EXPIRED', `Ảnh đã tải lên quá ${config.upload.maxAgeMinutes} phút. Vui lòng chụp/tải ảnh mới.`);
      }

      // 2. Loại xe + định dạng biển số theo loại xe
      const vehicleType = await vehicleTypeRepo.findById(vehicleTypeId, tx);
      if (!vehicleType) throw new AppError(400, 'VALIDATION_ERROR', 'Loại xe không hợp lệ', { field: 'vehicleTypeId' });
      if (!isValidPlate(plate, vehicleType.code)) {
        throw new AppError(400, 'INVALID_PLATE',
          `Biển số "${plateNumber}" không đúng định dạng biển ${vehicleType.name.toLowerCase()}. Ví dụ: ${vehicleType.code === 'CAR' ? '51F-123.45' : '59-X1 123.45'}`,
          { field: 'plateNumber' });
      }

      // 3. Chặn trùng: biển số đã có lượt đang mở?
      const open = await sessionRepo.findOpenByPlate(plate, tx, { lock: true });
      if (open) throw alreadyInsideError(open);

      // 4. Bảng giá đang áp dụng (gắn vào lượt gửi để đổi giá sau này không ảnh hưởng)
      const rule = await pricingRepo.findActiveByVehicleType(vehicleType.vehicleTypeId, tx);
      if (!rule) throw new AppError(409, 'NO_ACTIVE_PRICING', `Chưa có bảng giá đang áp dụng cho ${vehicleType.name}. Liên hệ quản trị viên.`);

      // 5. Ghi dữ liệu
      const newId = await sessionRepo.insertOpen({
        plateNumber: plate,
        vehicleTypeId: vehicleType.vehicleTypeId,
        pricingRuleId: rule.pricingRuleId,
        checkInAt: nowSeconds(),
        checkInImagePath: rec.imagePath,
        checkInBy: userId,
        checkInPlateEdited: rec.recognizedPlate !== plate,
      }, tx);

      const marked = await recognitionRepo.markUsed(rec.recognitionId, newId, plate, tx);
      if (!marked) throw new AppError(409, 'RECOGNITION_ALREADY_USED', 'Ảnh này vừa được dùng ở nơi khác. Vui lòng tải ảnh mới.');

      await auditRepo.log({
        userId, action: 'CHECK_IN', entityType: 'SESSION', entityId: newId, ipAddress,
        detail: { plate, vehicleTypeId: vehicleType.vehicleTypeId, recognitionId: rec.recognitionId,
                  recognizedPlate: rec.recognizedPlate, recognitionStatus: rec.status },
      }, tx);
      return newId;
    });

    return sessionRepo.findById(sessionId);
  } catch (err) {
    // Lớp bảo vệ cuối: UNIQUE index trong database chặn được lượt trùng
    if (isUniqueViolation(err)) {
      const open = await sessionRepo.findOpenByPlate(plate);
      if (open) throw alreadyInsideError(open);
      throw new AppError(409, 'PLATE_ALREADY_INSIDE', 'Xe này đang ở trong bãi.');
    }
    throw err;
  }
}

module.exports = { checkIn };
