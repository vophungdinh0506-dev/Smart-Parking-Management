/**
 * NGHIỆP VỤ XE RA BÃI + TÍNH PHÍ
 *
 * Bước A — preview(): tìm lượt ĐANG MỞ theo biển số đã xác nhận, tạm tính phí tới thời điểm hiện tại.
 *   Không tìm thấy → báo lỗi + gợi ý biển gần giống. KHÔNG BAO GIỜ tự tạo lượt gửi mới.
 * Bước B — confirm(): nhân viên xác nhận đã thu tiền. Trong 1 TRANSACTION:
 *   khóa lượt gửi → kiểm tra còn OPEN → TÍNH LẠI phí ở backend → so với số tiền nhân viên đã thấy
 *   → ghi Payments → đóng lượt gửi → gắn ảnh → ghi nhật ký. Lỗi ở bất kỳ bước nào → hủy toàn bộ.
 * Số tiền frontend gửi lên (expectedAmount) CHỈ để so sánh, không bao giờ được lưu.
 */
const { withTransaction, isUniqueViolation } = require('../config/db');
const recognitionRepo = require('../repositories/recognitionRepo');
const sessionRepo = require('../repositories/sessionRepo');
const pricingRepo = require('../repositories/pricingRepo');
const paymentRepo = require('../repositories/paymentRepo');
const auditRepo = require('../repositories/auditRepo');
const AppError = require('../utils/AppError');
const { assertUsableRecognition } = require('./recognitionGuard');
const { calculateFee } = require('../utils/feeCalculator');
const { normalizePlate, isValidPlate, formatPlate } = require('../utils/plate');
const { nowSeconds } = require('../utils/time');

/** Tính phí cho 1 lượt gửi tại thời điểm checkOutAt; báo lỗi rõ ràng nếu dữ liệu thời gian sai. */
async function computeFee(session, checkOutAt, tx) {
  if (!session.checkInAt) {
    throw new AppError(409, 'MISSING_CHECK_IN_TIME', 'Lượt gửi thiếu thời điểm vào, không thể tính phí.');
  }
  if (checkOutAt < new Date(session.checkInAt)) {
    throw new AppError(400, 'INVALID_TIME_RANGE',
      'Thời điểm ra sớm hơn thời điểm vào. Kiểm tra lại đồng hồ máy chủ trước khi tính phí.');
  }
  const rule = await pricingRepo.findById(session.pricingRuleId, tx);
  if (!rule) throw new AppError(409, 'PRICING_NOT_FOUND', 'Không tìm thấy bảng giá áp dụng cho lượt gửi này.');
  return calculateFee(new Date(session.checkInAt), checkOutAt, rule);
}

function notFoundError(plate, suggestions) {
  return new AppError(404, 'SESSION_NOT_FOUND',
    `Không tìm thấy xe đang gửi có biển số ${plate}. Kiểm tra lại biển số trên ảnh; hệ thống không tự tạo lượt gửi.`,
    {
      field: 'plateNumber',
      suggestions: suggestions.map((s) => ({
        plateNumber: s.plateNumber,
        plateDisplay: formatPlate(s.plateNumber, s.vehicleType.code),
        vehicleTypeName: s.vehicleType.name,
        checkInAt: s.checkInAt,
      })),
    });
}

/** Bước A: xem trước. Không ghi gì vào database. */
async function preview({ recognitionId, plateNumber }) {
  const plate = normalizePlate(plateNumber);
  if (!isValidPlate(plate)) {
    throw new AppError(400, 'INVALID_PLATE', `Biển số "${plateNumber}" không đúng định dạng.`, { field: 'plateNumber' });
  }
  const rec = await recognitionRepo.findById(recognitionId);
  assertUsableRecognition(rec, 'OUT');

  const session = await sessionRepo.findOpenByPlate(plate);
  if (!session) throw notFoundError(plate, await sessionRepo.findOpenSimilar(plate));

  const checkOutAt = nowSeconds();
  const fee = await computeFee(session, checkOutAt);
  return { session, checkOutAt, fee, recognition: rec };
}

/** Bước B: xác nhận thu tiền và đóng lượt gửi. */
async function confirm({ sessionId, recognitionId, plateNumber, expectedAmount, userId, ipAddress }) {
  const plate = normalizePlate(plateNumber);
  try {
    return await withTransaction(async (tx) => {
      const session = await sessionRepo.findById(sessionId, tx, { forUpdate: true });
      if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy lượt gửi.');
      if (session.status !== 'OPEN') {
        const label = session.status === 'CLOSED' ? 'đã kết thúc' : 'đã bị hủy';
        throw new AppError(409, 'SESSION_NOT_OPEN', `Lượt gửi này ${label}, không thể thu tiền lần nữa.`);
      }
      if (plate !== session.plateNumber) {
        throw new AppError(400, 'PLATE_MISMATCH',
          `Biển số xác nhận (${plate}) không khớp với lượt gửi (${session.plateNumber}).`, { field: 'plateNumber' });
      }

      const rec = await recognitionRepo.findById(recognitionId, tx, { forUpdate: true });
      assertUsableRecognition(rec, 'OUT');

      const checkOutAt = nowSeconds();
      const fee = await computeFee(session, checkOutAt, tx);

      // Phí thay đổi so với lúc nhân viên xem (ví dụ vừa qua 22:00) → dừng lại, bắt xem lại
      if (fee.totalAmount !== expectedAmount) {
        throw new AppError(409, 'FEE_CHANGED',
          `Phí đã thay đổi thành ${fee.totalAmount.toLocaleString('vi-VN')}đ (trước đó ${expectedAmount.toLocaleString('vi-VN')}đ). Vui lòng kiểm tra lại rồi xác nhận.`,
          { totalAmount: fee.totalAmount });
      }

      const paymentId = await paymentRepo.insert({
        sessionId, amount: fee.totalAmount, method: 'CASH', receivedBy: userId, paidAt: checkOutAt,
      }, tx);

      const closed = await sessionRepo.close({
        sessionId,
        checkOutAt,
        checkOutImagePath: rec.imagePath,
        checkOutBy: userId,
        checkOutPlateEdited: rec.recognizedPlate !== plate,
        feeAmount: fee.totalAmount,
        feeBreakdown: fee,
      }, tx);
      if (!closed) throw new AppError(409, 'SESSION_NOT_OPEN', 'Lượt gửi vừa được kết thúc bởi người khác.');

      const marked = await recognitionRepo.markUsed(rec.recognitionId, sessionId, plate, tx);
      if (!marked) throw new AppError(409, 'RECOGNITION_ALREADY_USED', 'Ảnh này vừa được dùng ở nơi khác. Vui lòng tải ảnh mới.');

      await auditRepo.log({
        userId, action: 'CHECK_OUT', entityType: 'SESSION', entityId: sessionId, ipAddress,
        detail: { plate, paymentId, amount: fee.totalAmount, recognitionId: rec.recognitionId,
                  recognizedPlate: rec.recognizedPlate, recognitionStatus: rec.status },
      }, tx);

      return { sessionId, paymentId };
    }).then(async ({ sessionId: id, paymentId }) => ({ session: await sessionRepo.findById(id), paymentId }));
  } catch (err) {
    // Lớp bảo vệ cuối: UNIQUE(Payments.SessionId) trong database chặn thu tiền 2 lần
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'SESSION_NOT_OPEN', 'Lượt gửi này đã được thu tiền.');
    }
    throw err;
  }
}

module.exports = { preview, confirm };
