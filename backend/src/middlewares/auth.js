const config = require('../config/env');
const authService = require('../services/authService');
const AppError = require('../utils/AppError');

const COOKIE_NAME = 'sp_session';

function cookieOptions() {
  return {
    httpOnly: true,                   // JavaScript trên trang không đọc được → khó bị đánh cắp qua XSS
    sameSite: 'strict',               // trang web khác không gửi kèm cookie này được → chống CSRF
    secure: config.isProduction,      // production chạy HTTPS thì chỉ gửi qua HTTPS
    path: '/',
  };
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: config.auth.sessionHours * 3600 * 1000 });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

/** Bắt buộc đăng nhập. Thành công → req.user = { userId, username, fullName, role } */
async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const user = token ? await authService.verifyToken(token) : null;
  if (!user) {
    if (token) clearSessionCookie(res);
    throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập');
  }
  req.user = user;
  next();
}

/** Bắt buộc có 1 trong các quyền. Dùng SAU requireAuth. Ví dụ: requireRole('ADMIN') */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, setSessionCookie, clearSessionCookie, COOKIE_NAME };
