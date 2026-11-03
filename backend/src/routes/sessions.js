/**
 * POST /api/sessions/check-in          { recognitionId, plateNumber, vehicleTypeId } → 201 lượt gửi mới
 * POST /api/sessions/check-out/preview { recognitionId, plateNumber } → lượt đang mở + phí tạm tính
 * POST /api/sessions/:id/check-out     { recognitionId, plateNumber, expectedAmount } → đóng lượt, ghi thanh toán
 * PATCH /api/sessions/:id              (ADMIN) { plateNumber?, vehicleTypeId?, reason } → sửa lượt đang mở
 * POST /api/sessions/:id/cancel        (ADMIN) { reason } → hủy lượt đang mở tạo nhầm
 * GET  /api/sessions?status=OPEN&plate=51F&page=1&pageSize=20 → { total, items }
 * GET  /api/sessions/:id
 */
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const checkInService = require('../services/checkInService');
const checkOutService = require('../services/checkOutService');
const sessionAdminService = require('../services/sessionAdminService');
const sessionRepo = require('../repositories/sessionRepo');
const AppError = require('../utils/AppError');
const { requireString } = require('../utils/validate');
const { normalizePlate, formatPlate } = require('../utils/plate');
const { parseVnDate } = require('../utils/time');

const router = express.Router();
router.use(requireAuth);

function positiveInt(value, field, label) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new AppError(400, 'VALIDATION_ERROR', `${label} không hợp lệ`, { field });
  return n;
}

/** Dữ liệu trả về frontend: thêm biển số dạng dễ đọc, link ảnh; bỏ đường dẫn file nội bộ */
function present(s) {
  const { checkInImagePath, checkOutImagePath, ...rest } = s;
  return {
    ...rest,
    plateDisplay: formatPlate(s.plateNumber, s.vehicleType.code),
    checkInImageUrl: `/api/images/sessions/${s.sessionId}/in`,
    checkOutImageUrl: checkOutImagePath ? `/api/images/sessions/${s.sessionId}/out` : null,
  };
}

/** Số nguyên không âm (số tiền) */
function nonNegativeInt(value, field, label) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new AppError(400, 'VALIDATION_ERROR', `${label} không hợp lệ`, { field });
  return n;
}

router.post('/check-out/preview', async (req, res) => {
  const recognitionId = positiveInt(req.body?.recognitionId, 'recognitionId', 'Mã ảnh nhận diện');
  const plateNumber = requireString(req.body, 'plateNumber', { label: 'biển số', max: 20 });
  const { session, checkOutAt, fee, recognition } = await checkOutService.preview({ recognitionId, plateNumber });
  res.json({
    session: present(session),
    checkOutAt,
    checkOutImageUrl: `/api/images/recognitions/${recognition.recognitionId}/original`,
    fee,
  });
});

router.post('/:id/check-out', async (req, res) => {
  const sessionId = positiveInt(req.params.id, 'id', 'Mã lượt gửi');
  const recognitionId = positiveInt(req.body?.recognitionId, 'recognitionId', 'Mã ảnh nhận diện');
  const plateNumber = requireString(req.body, 'plateNumber', { label: 'biển số', max: 20 });
  const expectedAmount = nonNegativeInt(req.body?.expectedAmount, 'expectedAmount', 'Số tiền đã xem');

  const { session, paymentId } = await checkOutService.confirm({
    sessionId, recognitionId, plateNumber, expectedAmount, userId: req.user.userId, ipAddress: req.ip,
  });
  res.json({ session: present(session), paymentId });
});

router.post('/check-in', async (req, res) => {
  const recognitionId = positiveInt(req.body?.recognitionId, 'recognitionId', 'Mã ảnh nhận diện');
  const plateNumber = requireString(req.body, 'plateNumber', { label: 'biển số', max: 20 });
  const vehicleTypeId = positiveInt(req.body?.vehicleTypeId, 'vehicleTypeId', 'Loại xe');

  const session = await checkInService.checkIn({
    recognitionId, plateNumber, vehicleTypeId, userId: req.user.userId, ipAddress: req.ip,
  });
  res.status(201).json({ session: present(session) });
});

router.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const sessionId = positiveInt(req.params.id, 'id', 'Mã lượt gửi');
  const reason = requireString(req.body, 'reason', { label: 'lý do', min: 3, max: 255 });
  const plateNumber = req.body?.plateNumber !== undefined && req.body.plateNumber !== ''
    ? requireString(req.body, 'plateNumber', { label: 'biển số', max: 20 }) : null;
  const vehicleTypeId = req.body?.vehicleTypeId !== undefined && req.body.vehicleTypeId !== ''
    ? positiveInt(req.body.vehicleTypeId, 'vehicleTypeId', 'Loại xe') : null;
  const session = await sessionAdminService.update({
    sessionId, plateNumber, vehicleTypeId, reason, userId: req.user.userId, ipAddress: req.ip,
  });
  res.json({ session: present(session) });
});

router.post('/:id/cancel', requireRole('ADMIN'), async (req, res) => {
  const sessionId = positiveInt(req.params.id, 'id', 'Mã lượt gửi');
  const reason = requireString(req.body, 'reason', { label: 'lý do hủy', min: 3, max: 255 });
  const session = await sessionAdminService.cancel({ sessionId, reason, userId: req.user.userId, ipAddress: req.ip });
  res.json({ session: present(session) });
});

router.get('/', async (req, res) => {
  const status = req.query.status ? String(req.query.status).toUpperCase() : null;
  if (status && !['OPEN', 'CLOSED', 'CANCELLED'].includes(status)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Trạng thái không hợp lệ', { field: 'status' });
  }
  const plate = req.query.plate ? normalizePlate(String(req.query.plate)).slice(0, 12) : null;
  const page = req.query.page ? positiveInt(req.query.page, 'page', 'Trang') : 1;
  const pageSize = Math.min(req.query.pageSize ? positiveInt(req.query.pageSize, 'pageSize', 'Số dòng') : 20, 100);

  const from = req.query.from ? parseVnDate(String(req.query.from), 'from') : null;
  const to = req.query.to ? new Date(parseVnDate(String(req.query.to), 'to').getTime() + 86400000) : null; // hết ngày "to"
  if (from && to && to <= from) throw new AppError(400, 'VALIDATION_ERROR', 'Ngày kết thúc phải sau ngày bắt đầu', { field: 'to' });

  const { total, items } = await sessionRepo.list({ status, plate, from, to, page, pageSize });
  res.json({ total, page, pageSize, items: items.map(present) });
});

router.get('/:id', async (req, res) => {
  const session = await sessionRepo.findById(positiveInt(req.params.id, 'id', 'Mã lượt gửi'));
  if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy lượt gửi');
  res.json({ session: present(session) });
});

module.exports = router;
