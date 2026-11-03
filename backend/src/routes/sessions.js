/**
 * POST /api/sessions/check-in   { recognitionId, plateNumber, vehicleTypeId } → 201 lượt gửi mới
 * GET  /api/sessions?status=OPEN&plate=51F&page=1&pageSize=20 → { total, items }
 * GET  /api/sessions/:id
 */
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const checkInService = require('../services/checkInService');
const sessionRepo = require('../repositories/sessionRepo');
const AppError = require('../utils/AppError');
const { requireString } = require('../utils/validate');
const { normalizePlate, formatPlate } = require('../utils/plate');

const router = express.Router();
router.use(requireAuth);

function positiveInt(value, field, label) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new AppError(400, 'VALIDATION_ERROR', `${label} không hợp lệ`, { field });
  return n;
}

/** Dữ liệu trả về frontend: thêm biển số dạng dễ đọc và link ảnh */
function present(s) {
  return {
    ...s,
    plateDisplay: formatPlate(s.plateNumber, s.vehicleType.code),
    checkInImageUrl: `/api/images/sessions/${s.sessionId}/in`,
  };
}

router.post('/check-in', async (req, res) => {
  const recognitionId = positiveInt(req.body?.recognitionId, 'recognitionId', 'Mã ảnh nhận diện');
  const plateNumber = requireString(req.body, 'plateNumber', { label: 'biển số', max: 20 });
  const vehicleTypeId = positiveInt(req.body?.vehicleTypeId, 'vehicleTypeId', 'Loại xe');

  const session = await checkInService.checkIn({
    recognitionId, plateNumber, vehicleTypeId, userId: req.user.userId, ipAddress: req.ip,
  });
  res.status(201).json({ session: present(session) });
});

router.get('/', async (req, res) => {
  const status = req.query.status ? String(req.query.status).toUpperCase() : null;
  if (status && !['OPEN', 'CLOSED', 'CANCELLED'].includes(status)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Trạng thái không hợp lệ', { field: 'status' });
  }
  const plate = req.query.plate ? normalizePlate(String(req.query.plate)).slice(0, 12) : null;
  const page = req.query.page ? positiveInt(req.query.page, 'page', 'Trang') : 1;
  const pageSize = Math.min(req.query.pageSize ? positiveInt(req.query.pageSize, 'pageSize', 'Số dòng') : 20, 100);

  const { total, items } = await sessionRepo.list({ status, plate, page, pageSize });
  res.json({ total, page, pageSize, items: items.map(present) });
});

router.get('/:id', async (req, res) => {
  const session = await sessionRepo.findById(positiveInt(req.params.id, 'id', 'Mã lượt gửi'));
  if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy lượt gửi');
  res.json({ session: present(session) });
});

module.exports = router;
