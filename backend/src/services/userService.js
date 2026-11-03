/**
 * Quản lý tài khoản nhân viên (chỉ ADMIN).
 * - Không xóa tài khoản (để giữ lịch sử ai đã làm gì) → dùng "khóa" (IsActive = 0).
 * - Không cho tự khóa / tự hạ quyền chính mình, không cho khóa admin cuối cùng.
 */
const bcrypt = require('bcryptjs');
const { withTransaction, isUniqueViolation } = require('../config/db');
const userRepo = require('../repositories/userRepo');
const auditRepo = require('../repositories/auditRepo');
const AppError = require('../utils/AppError');
const { requireString } = require('../utils/validate');

const ROLES = ['ADMIN', 'STAFF'];
const publicUser = ({ passwordHash, ...u }) => u;

function parseRole(value) {
  const role = String(value ?? '').toUpperCase();
  if (!ROLES.includes(role)) throw new AppError(400, 'VALIDATION_ERROR', 'Quyền không hợp lệ (ADMIN hoặc STAFF)', { field: 'role' });
  return role;
}
function parsePassword(body) {
  return requireString(body, 'password', { label: 'mật khẩu', min: 8, max: 200, trim: false });
}

async function create(body, actor) {
  const username = requireString(body, 'username', { label: 'tên đăng nhập', min: 3, max: 50 });
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Tên đăng nhập chỉ gồm chữ không dấu, số và . _ -', { field: 'username' });
  }
  const fullName = requireString(body, 'fullName', { label: 'họ tên', max: 100 });
  const role = parseRole(body?.role);
  const passwordHash = await bcrypt.hash(parsePassword(body), 12);
  try {
    const id = await withTransaction(async (tx) => {
      const newId = await userRepo.insert({ username, passwordHash, fullName, role }, tx);
      await auditRepo.log({ userId: actor.userId, action: 'USER_CREATE', entityType: 'USER', entityId: newId,
        ipAddress: actor.ip, detail: { username, role } }, tx);
      return newId;
    });
    return publicUser(await userRepo.findById(id));
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError(409, 'USERNAME_TAKEN', `Tên đăng nhập "${username}" đã tồn tại`, { field: 'username' });
    throw err;
  }
}

async function update(userId, body, actor) {
  return withTransaction(async (tx) => {
    const user = await userRepo.findById(userId, tx);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
    if (body?.isActive !== undefined && typeof body.isActive !== 'boolean') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Trạng thái hoạt động không hợp lệ', { field: 'isActive' });
    }
    const next = {
      fullName: body?.fullName !== undefined ? requireString(body, 'fullName', { label: 'họ tên', max: 100 }) : user.fullName,
      role: body?.role !== undefined ? parseRole(body.role) : user.role,
      isActive: body?.isActive !== undefined ? body.isActive === true : user.isActive,
    };
    if (userId === actor.userId && (next.role !== user.role || !next.isActive)) {
      throw new AppError(400, 'CANNOT_CHANGE_SELF', 'Không thể tự khóa hoặc tự đổi quyền tài khoản đang đăng nhập');
    }
    const losingAdmin = user.role === 'ADMIN' && user.isActive && (next.role !== 'ADMIN' || !next.isActive);
    if (losingAdmin && (await userRepo.countActiveAdmins(tx)) <= 1) {
      throw new AppError(409, 'LAST_ADMIN', 'Phải còn ít nhất 1 tài khoản quản trị đang hoạt động');
    }
    await userRepo.update(userId, next, tx);
    await auditRepo.log({
      userId: actor.userId, action: next.isActive === user.isActive ? 'USER_UPDATE' : (next.isActive ? 'USER_UNLOCK' : 'USER_LOCK'),
      entityType: 'USER', entityId: userId, ipAddress: actor.ip,
      detail: { before: { fullName: user.fullName, role: user.role, isActive: user.isActive }, after: next },
    }, tx);
    return publicUser(await userRepo.findById(userId, tx));
  });
}

async function resetPassword(userId, body, actor) {
  const passwordHash = await bcrypt.hash(parsePassword(body), 12);
  await withTransaction(async (tx) => {
    const user = await userRepo.findById(userId, tx);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản');
    await userRepo.setPassword(userId, passwordHash, tx);
    await auditRepo.log({ userId: actor.userId, action: 'PASSWORD_RESET', entityType: 'USER', entityId: userId,
      ipAddress: actor.ip, detail: { by: 'admin' } }, tx);
  });
}

async function list() {
  return (await userRepo.list()).map(publicUser);
}

module.exports = { create, update, resetPassword, list };
