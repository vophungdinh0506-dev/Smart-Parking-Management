/**
 * GET  /api/pricing-rules                       → bảng giá đang áp dụng (mọi nhân viên xem được)
 * GET  /api/pricing-rules/history?vehicleTypeId → các phiên bản giá trước đây
 * POST /api/pricing-rules                       → ADMIN tạo phiên bản giá mới cho 1 loại xe
 * POST /api/pricing-rules/simulate              → thử tính phí (không lưu)
 */
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const pricingRepo = require('../repositories/pricingRepo');
const pricingService = require('../services/pricingService');
const AppError = require('../utils/AppError');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  res.json({ items: await pricingRepo.findAllActive() });
});

router.get('/history', async (req, res) => {
  const vehicleTypeId = Number(req.query.vehicleTypeId);
  if (!Number.isInteger(vehicleTypeId) || vehicleTypeId <= 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Thiếu loại xe', { field: 'vehicleTypeId' });
  }
  res.json({ items: await pricingRepo.listHistory(vehicleTypeId) });
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const rule = await pricingService.createVersion({
    vehicleTypeId: req.body?.vehicleTypeId, body: req.body, userId: req.user.userId, ipAddress: req.ip,
  });
  res.status(201).json({ rule });
});

router.post('/simulate', async (req, res) => {
  const result = await pricingService.simulate({
    vehicleTypeId: req.body?.vehicleTypeId,
    checkInAt: req.body?.checkInAt,
    checkOutAt: req.body?.checkOutAt,
    draftRule: req.body?.rule,
  });
  res.json(result);
});

module.exports = router;
