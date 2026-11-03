/**
 * POST /api/recognitions  (multipart: image, direction=IN|OUT) → 201 kết quả nhận diện
 * Luôn trả recognitionId (kể cả khi AI lỗi) để nhân viên nhập tay và xác nhận tiếp.
 */
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { receiveImage } = require('../middlewares/upload');
const recognitionService = require('../services/recognitionService');
const AppError = require('../utils/AppError');

const router = express.Router();

router.post('/', requireAuth, receiveImage, async (req, res) => {
  const direction = String(req.body?.direction ?? '').toUpperCase();
  if (direction !== 'IN' && direction !== 'OUT') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Thiếu hướng xe (IN = vào, OUT = ra)', { field: 'direction' });
  }
  const result = await recognitionService.recognize({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    direction,
    userId: req.user.userId,
  });
  res.status(201).json(result);
});

module.exports = router;
