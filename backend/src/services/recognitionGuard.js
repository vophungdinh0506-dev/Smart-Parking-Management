/**
 * Kiểm tra 1 ảnh nhận diện có được phép dùng để xác nhận xe vào/ra không.
 * Dùng chung cho checkInService và checkOutService.
 */
const config = require('../config/env');
const AppError = require('../utils/AppError');

const DIRECTION_LABEL = { IN: 'xe VÀO', OUT: 'xe RA' };

function assertUsableRecognition(rec, expectedDirection) {
  if (!rec) throw new AppError(404, 'RECOGNITION_NOT_FOUND', 'Không tìm thấy ảnh đã tải lên. Vui lòng tải ảnh lại.');
  if (rec.direction !== expectedDirection) {
    throw new AppError(400, 'WRONG_DIRECTION',
      `Ảnh này được tải lên cho ${DIRECTION_LABEL[rec.direction]}, không dùng cho ${DIRECTION_LABEL[expectedDirection]}.`);
  }
  if (rec.sessionId !== null) {
    throw new AppError(409, 'RECOGNITION_ALREADY_USED', 'Ảnh này đã được sử dụng. Vui lòng tải ảnh mới.');
  }
  const ageMinutes = (Date.now() - new Date(rec.createdAt).getTime()) / 60000;
  if (ageMinutes > config.upload.maxAgeMinutes) {
    throw new AppError(400, 'RECOGNITION_EXPIRED', `Ảnh đã tải lên quá ${config.upload.maxAgeMinutes} phút. Vui lòng chụp/tải ảnh mới.`);
  }
}

module.exports = { assertUsableRecognition };
