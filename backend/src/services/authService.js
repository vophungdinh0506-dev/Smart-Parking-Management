/**
 * Nghiệp vụ đăng nhập.
 * - So mật khẩu bằng bcrypt (database chỉ có chuỗi băm, không có mật khẩu gốc).
 * - Thành công → tạo JWT (một "vé" có chữ ký, backend kiểm tra được vé thật hay giả).
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userRepo = require('../repositories/userRepo');
const auditRepo = require('../repositories/auditRepo');
const AppError = require('../utils/AppError');

// Chuỗi băm giả: khi tên đăng nhập không tồn tại vẫn chạy bcrypt.compare
// để thời gian phản hồi giống nhau → kẻ gian không đoán được tên nào có thật.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

/** Thông tin người dùng được phép trả về frontend (không có PasswordHash). */
function publicUser(user) {
  return { userId: user.userId, username: user.username, fullName: user.fullName, role: user.role };
}

async function login(username, password, ipAddress) {
  const user = await userRepo.findByUsername(username);
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  if (!user || !passwordOk) {
    await auditRepo.logSafe({
      userId: user ? user.userId : null,
      action: 'LOGIN_FAILED',
      entityType: 'USER',
      entityId: user ? user.userId : null,
      detail: { username },
      ipAddress,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Sai tên đăng nhập hoặc mật khẩu');
  }
  if (!user.isActive) {
    await auditRepo.logSafe({ userId: user.userId, action: 'LOGIN_FAILED', entityType: 'USER',
      entityId: user.userId, detail: { username, reason: 'ACCOUNT_LOCKED' }, ipAddress });
    throw new AppError(403, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa. Liên hệ quản trị viên.');
  }

  const token = jwt.sign(
    { sub: String(user.userId), role: user.role },
    config.auth.jwtSecret,
    { expiresIn: `${config.auth.sessionHours}h`, algorithm: 'HS256' },
  );
  await auditRepo.logSafe({ userId: user.userId, action: 'LOGIN_SUCCESS', entityType: 'USER',
    entityId: user.userId, ipAddress });

  return { token, user: publicUser(user) };
}

/**
 * Kiểm tra vé đăng nhập. Ngoài chữ ký còn đọc lại DB để
 * tài khoản vừa bị khóa (hoặc đổi quyền) có hiệu lực ngay, không phải chờ vé hết hạn.
 * @returns {Promise<object|null>} người dùng, hoặc null nếu vé không hợp lệ
 */
async function verifyToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.auth.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null; // hết hạn, bị sửa, sai chữ ký...
  }
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) return null;

  const user = await userRepo.findById(userId);
  if (!user || !user.isActive) return null;
  return publicUser(user);
}

module.exports = { login, verifyToken, publicUser };
