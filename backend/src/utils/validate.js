/**
 * Kiểm tra dữ liệu đầu vào ở backend. Không bao giờ tin dữ liệu frontend gửi lên:
 * người dùng có thể sửa request bằng DevTools hoặc Postman.
 */
const AppError = require('./AppError');

function invalid(message, field) {
  return new AppError(400, 'VALIDATION_ERROR', message, field ? { field } : undefined);
}

/** Lấy chuỗi bắt buộc, đã cắt khoảng trắng 2 đầu (trừ khi trim = false). */
function requireString(body, field, { label = field, min = 1, max = 255, trim = true } = {}) {
  const raw = body?.[field];
  if (typeof raw !== 'string') throw invalid(`Thiếu ${label}`, field);
  const value = trim ? raw.trim() : raw;
  if (value.length < min) throw invalid(min <= 1 ? `Thiếu ${label}` : `${label} phải có ít nhất ${min} ký tự`, field);
  if (value.length > max) throw invalid(`${label} tối đa ${max} ký tự`, field);
  return value;
}

module.exports = { requireString, invalid };
