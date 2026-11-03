const crypto = require('node:crypto');
const AppError = require('../utils/AppError');

/** API không tồn tại → 404 dạng JSON (không trả trang HTML). */
function apiNotFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy API' } });
}

/**
 * Xử lý lỗi tập trung. Express 5 tự chuyển lỗi của hàm async vào đây.
 * Không bao giờ gửi stack trace / câu SQL / thông tin máy chủ ra frontend.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'Ảnh vượt quá dung lượng cho phép' } });
    }
    return res.status(400).json({ error: { code: 'UPLOAD_ERROR', message: 'Tải ảnh lên không hợp lệ (chỉ gửi 1 ảnh, trường "image")' } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Dữ liệu gửi lên không đúng định dạng JSON' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Dữ liệu gửi lên quá lớn' } });
  }

  const errorId = crypto.randomUUID().slice(0, 8);
  console.error(`[error ${errorId}] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: `Lỗi hệ thống, vui lòng thử lại. Mã lỗi: ${errorId}` },
  });
}

module.exports = { apiNotFound, errorHandler };
