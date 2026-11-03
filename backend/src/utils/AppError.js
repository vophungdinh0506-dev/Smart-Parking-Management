/**
 * Lỗi nghiệp vụ có chủ đích (biết trước), ví dụ "xe đã ở trong bãi".
 * errorHandler sẽ trả nguyên status + code + message này cho frontend.
 * Lỗi KHÔNG phải AppError được coi là lỗi hệ thống → chỉ trả thông báo chung.
 */
class AppError extends Error {
  /**
   * @param {number} status  HTTP status, ví dụ 400, 404, 409
   * @param {string} code    mã lỗi cho frontend xử lý, ví dụ 'PLATE_ALREADY_INSIDE'
   * @param {string} message thông báo tiếng Việt hiển thị cho nhân viên
   * @param {object} [details]
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
