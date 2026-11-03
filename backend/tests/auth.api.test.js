/**
 * Kiểm thử API đăng nhập với database giả lập.
 * Chạy: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { mockModule, startServer } = require('./helpers/testApp');

// ---- Database giả lập ----
const users = [
  { userId: 1, username: 'admin', passwordHash: bcrypt.hashSync('Admin@123', 4), fullName: 'Quản trị', role: 'ADMIN', isActive: true },
  { userId: 2, username: 'nv01', passwordHash: bcrypt.hashSync('Staff@123', 4), fullName: 'Nhân viên 1', role: 'STAFF', isActive: true },
  { userId: 3, username: 'khoa', passwordHash: bcrypt.hashSync('Lock@1234', 4), fullName: 'Bị khóa', role: 'STAFF', isActive: false },
];
const audits = [];
mockModule('src/repositories/userRepo.js', {
  findByUsername: async (u) => users.find((x) => x.username === u) ?? null,
  findById: async (id) => users.find((x) => x.userId === id) ?? null,
});
mockModule('src/repositories/auditRepo.js', {
  log: async (e) => { audits.push(e); },
  logSafe: async (e) => { audits.push(e); },
});

const { createApp } = require('../src/app');
const { requireAuth, requireRole } = require('../src/middlewares/auth');
const { errorHandler } = require('../src/middlewares/errorHandler');

/** Lấy phần "sp_session=..." từ header Set-Cookie */
const sessionCookie = (setCookie) => setCookie.find((c) => c.startsWith('sp_session='))?.split(';')[0];

let api;
test.before(async () => {
  // Thêm 1 route chỉ ADMIN dùng được để test phân quyền
  api = await startServer(() => {
    const app = createApp();
    const express = require('express');
    const r = express.Router();
    r.get('/admin-only', requireAuth, requireRole('ADMIN'), (req, res) => res.json({ ok: true }));
    app.use('/test', r);
    app.use(errorHandler); // route thêm sau errorHandler gốc nên cần gắn lại để lỗi trả về JSON
    return app;
  });
});
test.after(() => api.close());

test('Đăng nhập đúng → 200, có cookie httpOnly + SameSite=Strict, không lộ PasswordHash', async () => {
  const res = await api.call('POST', '/api/auth/login', { body: { username: 'admin', password: 'Admin@123' } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.user, { userId: 1, username: 'admin', fullName: 'Quản trị', role: 'ADMIN' });
  const raw = res.setCookie.find((c) => c.startsWith('sp_session='));
  assert.match(raw, /HttpOnly/i);
  assert.match(raw, /SameSite=Strict/i);
  assert.ok(audits.some((a) => a.action === 'LOGIN_SUCCESS' && a.userId === 1));
});

test('Sai mật khẩu và sai tên đăng nhập → cùng 1 thông báo 401 (không lộ tài khoản có tồn tại không)', async () => {
  const a = await api.call('POST', '/api/auth/login', { body: { username: 'admin', password: 'sai' } });
  const b = await api.call('POST', '/api/auth/login', { body: { username: 'khongco', password: 'sai' } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.deepEqual(a.json, b.json);
  assert.ok(audits.some((x) => x.action === 'LOGIN_FAILED' && x.detail.username === 'khongco'));
});

test('Tài khoản bị khóa → 403 ACCOUNT_LOCKED', async () => {
  const res = await api.call('POST', '/api/auth/login', { body: { username: 'khoa', password: 'Lock@1234' } });
  assert.equal(res.status, 403);
  assert.equal(res.json.error.code, 'ACCOUNT_LOCKED');
});

test('Thiếu dữ liệu / sai kiểu → 400', async () => {
  const a = await api.call('POST', '/api/auth/login', { body: { username: 'admin' } });
  const b = await api.call('POST', '/api/auth/login', { body: { username: ['admin'], password: 'x' } });
  assert.equal(a.status, 400);
  assert.equal(b.status, 400);
});

test('/me: có cookie → trả user; không cookie hoặc cookie giả → 401', async () => {
  const login = await api.call('POST', '/api/auth/login', { body: { username: 'nv01', password: 'Staff@123' } });
  const cookie = sessionCookie(login.setCookie);
  const ok = await api.call('GET', '/api/auth/me', { cookie });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.username, 'nv01');

  assert.equal((await api.call('GET', '/api/auth/me')).status, 401);
  const forged = cookie.slice(0, -3) + 'abc';
  assert.equal((await api.call('GET', '/api/auth/me', { cookie: forged })).status, 401);
});

test('Tài khoản bị khóa SAU khi đăng nhập → vé cũ hết hiệu lực ngay', async () => {
  const login = await api.call('POST', '/api/auth/login', { body: { username: 'nv01', password: 'Staff@123' } });
  const cookie = sessionCookie(login.setCookie);
  users[1].isActive = false;
  try {
    assert.equal((await api.call('GET', '/api/auth/me', { cookie })).status, 401);
  } finally {
    users[1].isActive = true;
  }
});

test('Phân quyền: STAFF gọi API của ADMIN → 403, ADMIN → 200', async () => {
  const staff = sessionCookie((await api.call('POST', '/api/auth/login', { body: { username: 'nv01', password: 'Staff@123' } })).setCookie);
  const admin = sessionCookie((await api.call('POST', '/api/auth/login', { body: { username: 'admin', password: 'Admin@123' } })).setCookie);
  assert.equal((await api.call('GET', '/test/admin-only', { cookie: staff })).status, 403);
  assert.equal((await api.call('GET', '/test/admin-only', { cookie: admin })).status, 200);
});

test('Đăng xuất → 204 và xóa cookie', async () => {
  const res = await api.call('POST', '/api/auth/logout');
  assert.equal(res.status, 204);
  assert.match(res.setCookie.find((c) => c.startsWith('sp_session=')), /Expires=Thu, 01 Jan 1970/);
});

test('Sai mật khẩu quá 5 lần/phút → 429 (chạy cuối vì chặn theo IP)', async () => {
  let last;
  for (let i = 0; i < 6; i += 1) {
    last = await api.call('POST', '/api/auth/login', { body: { username: 'admin', password: 'sai' + i } });
  }
  assert.equal(last.status, 429);
  assert.equal(last.json.error.code, 'TOO_MANY_ATTEMPTS');
});
