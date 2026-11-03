/**
 * Xem ảnh — BẮT BUỘC đăng nhập (ảnh có biển số là dữ liệu cần bảo vệ, không để public).
 * GET /api/images/recognitions/:id/original|crop
 * GET /api/images/sessions/:id/in|out
 * Đường dẫn file lấy từ database (không lấy từ URL) → không thể đọc file ngoài thư mục uploads.
 */
const express = require('express');
const config = require('../config/env');
const { requireAuth } = require('../middlewares/auth');
const recognitionRepo = require('../repositories/recognitionRepo');
const sessionRepo = require('../repositories/sessionRepo');
const AppError = require('../utils/AppError');

const router = express.Router();
router.use(requireAuth);

function parseId(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new AppError(404, 'IMAGE_NOT_FOUND', 'Không tìm thấy ảnh');
  return n;
}

function sendImage(res, relativePath) {
  if (!relativePath) throw new AppError(404, 'IMAGE_NOT_FOUND', 'Không tìm thấy ảnh');
  res.set('Cache-Control', 'private, max-age=3600');
  return new Promise((resolve, reject) => {
    res.sendFile(relativePath, { root: config.uploadDir, dotfiles: 'deny' }, (err) => {
      if (!err) return resolve();
      if (err.status === 404 || err.code === 'ENOENT') return reject(new AppError(404, 'IMAGE_NOT_FOUND', 'File ảnh không còn trên máy chủ'));
      return reject(err);
    });
  });
}

router.get('/recognitions/:id/:kind', async (req, res) => {
  const { kind } = req.params;
  if (kind !== 'original' && kind !== 'crop') throw new AppError(404, 'IMAGE_NOT_FOUND', 'Không tìm thấy ảnh');
  const rec = await recognitionRepo.findById(parseId(req.params.id));
  if (!rec) throw new AppError(404, 'IMAGE_NOT_FOUND', 'Không tìm thấy ảnh');
  await sendImage(res, kind === 'original' ? rec.imagePath : rec.cropImagePath);
});

router.get('/sessions/:id/:kind', async (req, res) => {
  const { kind } = req.params;
  if (kind !== 'in' && kind !== 'out') throw new AppError(404, 'IMAGE_NOT_FOUND', 'Không tìm thấy ảnh');
  const paths = await sessionRepo.findImagePaths(parseId(req.params.id));
  if (!paths) throw new AppError(404, 'IMAGE_NOT_FOUND', 'Không tìm thấy ảnh');
  await sendImage(res, paths[kind]);
});

module.exports = router;
