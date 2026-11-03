/**
 * POST /api/auth/login   { username, password } → 200 { user } + cookie phiên đăng nhập
 * POST /api/auth/logout  → 204, xóa cookie
 * GET  /api/auth/me      → 200 { user } | 401
 */
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const config = require('../config/env');
const authService = require('../services/authService');
const { requireAuth, setSessionCookie, clearSessionCookie } = require('../middlewares/auth');
const { requireString } = require('../utils/validate');

const router = express.Router();

// Chống dò mật khẩu: tối đa N lần đăng nhập SAI mỗi phút cho mỗi địa chỉ IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.auth.loginMaxAttemptsPerMinute,
  // Chỉ đếm lần đăng nhập SAI (401 sai mật khẩu, 403 tài khoản khóa); thiếu dữ liệu (400) không tính
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 401 && res.statusCode !== 403,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: { code: 'TOO_MANY_ATTEMPTS', message: 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 1 phút.' },
    });
  },
});

router.post('/login', loginLimiter, async (req, res) => {
  const username = requireString(req.body, 'username', { label: 'tên đăng nhập', max: 50 });
  const password = requireString(req.body, 'password', { label: 'mật khẩu', max: 200, trim: false });

  const { token, user } = await authService.login(username, password, req.ip);
  setSessionCookie(res, token);
  res.json({ user });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
