/**
 * Quản lý tài khoản — CHỈ ADMIN.
 * GET   /api/users
 * POST  /api/users                     { username, fullName, role, password }
 * PATCH /api/users/:id                 { fullName?, role?, isActive? }
 * POST  /api/users/:id/reset-password  { password }
 */
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const userService = require('../services/userService');
const AppError = require('../utils/AppError');

const router = express.Router();
router.use(requireAuth, requireRole('ADMIN'));

const actor = (req) => ({ userId: req.user.userId, ip: req.ip });
function userId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
  return n;
}

router.get('/', async (req, res) => res.json({ items: await userService.list() }));
router.post('/', async (req, res) => res.status(201).json({ user: await userService.create(req.body, actor(req)) }));
router.patch('/:id', async (req, res) => res.json({ user: await userService.update(userId(req.params.id), req.body, actor(req)) }));
router.post('/:id/reset-password', async (req, res) => {
  await userService.resetPassword(userId(req.params.id), req.body, actor(req));
  res.status(204).end();
});

module.exports = router;
