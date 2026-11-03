/**
 * Kiểm thử chức năng quản trị: sửa/hủy lượt gửi tạo nhầm, quản lý tài khoản, phân quyền.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

let db; let api; let admin; let staff;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 7)]);

async function login(u, p) {
  const r = await api.call('POST', '/api/auth/login', { body: { username: u, password: p } });
  return r.status === 200 ? r.setCookie.find((c) => c.startsWith('sp_session=')).split(';')[0] : null;
}
async function park(plate, vehicleTypeId) {
  const form = new FormData();
  form.append('direction', 'IN'); form.append('image', new Blob([JPEG], { type: 'image/jpeg' }), 'x.jpg');
  const rec = await (await fetch(`${api.base}/api/recognitions`, { method: 'POST', body: form, headers: { Cookie: staff } })).json();
  const r = await api.call('POST', '/api/sessions/check-in', { cookie: staff, body: { recognitionId: rec.recognitionId, plateNumber: plate, vehicleTypeId } });
  assert.equal(r.status, 201);
  return r.json.session.sessionId;
}

test.before(async () => {
  const helpers = require('./helpers/testApp');
  db = require('./helpers/fakeDb').installFakeDb();
  api = await helpers.startServer(require('../src/app').createApp);
  admin = await login('admin', 'Admin@123');
  staff = await login('nv01', 'Staff@123');
});
test.after(() => api.close());

// ---------- Sửa / hủy lượt gửi ----------
test('Nhân viên không được sửa/hủy lượt gửi (403)', async () => {
  const sid = await park('51F11111', 2);
  assert.equal((await api.call('PATCH', `/api/sessions/${sid}`, { cookie: staff, body: { plateNumber: '51F11112', reason: 'nhap sai' } })).status, 403);
  assert.equal((await api.call('POST', `/api/sessions/${sid}/cancel`, { cookie: staff, body: { reason: 'tao nham' } })).status, 403);
});

test('Admin sửa biển số nhập sai → cập nhật + ghi nhật ký trước/sau', async () => {
  const sid = db.sessions.find((s) => s.plateNumber === '51F11111').sessionId;
  const r = await api.call('PATCH', `/api/sessions/${sid}`, { cookie: admin, body: { plateNumber: '51F-111.12', reason: 'Nhân viên gõ sai số cuối' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.session.plateNumber, '51F11112');
  const log = db.audits.find((a) => a.action === 'SESSION_EDIT');
  assert.equal(log.detail.before.plate, '51F11111');
  assert.equal(log.detail.after.plate, '51F11112');
});

test('Sửa sang biển số đang có lượt khác / thiếu lý do / sai định dạng → bị từ chối', async () => {
  await park('30A22222', 2);
  const sid = db.sessions.find((s) => s.plateNumber === '51F11112').sessionId;
  assert.equal((await api.call('PATCH', `/api/sessions/${sid}`, { cookie: admin, body: { plateNumber: '30A22222', reason: 'thu' } })).json.error.code, 'PLATE_ALREADY_INSIDE');
  assert.equal((await api.call('PATCH', `/api/sessions/${sid}`, { cookie: admin, body: { plateNumber: '51F11113' } })).status, 400);
  assert.equal((await api.call('PATCH', `/api/sessions/${sid}`, { cookie: admin, body: { plateNumber: 'ABC', reason: 'thu sai' } })).json.error.code, 'INVALID_PLATE');
});

test('Đổi loại xe → áp bảng giá của loại xe mới', async () => {
  const sid = await park('59X133333', 1);
  // biển xe máy chuyển sang Ô tô là sai định dạng → bị từ chối
  assert.equal((await api.call('PATCH', `/api/sessions/${sid}`, { cookie: admin, body: { vehicleTypeId: 2, reason: 'chon sai' } })).json.error.code, 'INVALID_PLATE');
  const sid2 = await park('51D44444', 1); // biển ô tô nhưng chọn nhầm Xe máy (định dạng hợp lệ cho cả 2)
  const r = await api.call('PATCH', `/api/sessions/${sid2}`, { cookie: admin, body: { vehicleTypeId: 2, reason: 'Chọn nhầm loại xe' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.session.vehicleType.code, 'CAR');
  assert.equal(r.json.session.pricingRuleId, 2);
});

test('Admin hủy lượt tạo nhầm → CANCELLED, xe đó vào lại được; không hủy được lần 2', async () => {
  const sid = db.sessions.find((s) => s.plateNumber === '30A22222').sessionId;
  const r = await api.call('POST', `/api/sessions/${sid}/cancel`, { cookie: admin, body: { reason: 'Tạo trùng do bấm nhầm' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.session.status, 'CANCELLED');
  assert.equal(r.json.session.cancelReason, 'Tạo trùng do bấm nhầm');
  assert.ok(db.audits.some((a) => a.action === 'SESSION_CANCEL'));
  assert.equal((await api.call('POST', `/api/sessions/${sid}/cancel`, { cookie: admin, body: { reason: 'lan hai' } })).json.error.code, 'SESSION_NOT_OPEN');
  await park('30A22222', 2); // vào lại được
});

// ---------- Tài khoản ----------
test('Nhân viên không xem/tạo được tài khoản (403); không lộ PasswordHash', async () => {
  assert.equal((await api.call('GET', '/api/users', { cookie: staff })).status, 403);
  const r = await api.call('GET', '/api/users', { cookie: admin });
  assert.equal(r.status, 200);
  assert.ok(r.json.items.every((u) => !('passwordHash' in u)));
});

test('Admin tạo nhân viên → đăng nhập được; trùng tên → 409; mật khẩu ngắn → 400', async () => {
  const r = await api.call('POST', '/api/users', { cookie: admin, body: { username: 'nv02', fullName: 'Nhân viên 2', role: 'STAFF', password: 'Matkhau@2' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.user.role, 'STAFF');
  assert.ok(await login('nv02', 'Matkhau@2'));
  assert.equal((await api.call('POST', '/api/users', { cookie: admin, body: { username: 'nv02', fullName: 'X', role: 'STAFF', password: 'Matkhau@2' } })).status, 409);
  assert.equal((await api.call('POST', '/api/users', { cookie: admin, body: { username: 'nv03', fullName: 'X', role: 'STAFF', password: '123' } })).status, 400);
  assert.equal((await api.call('POST', '/api/users', { cookie: admin, body: { username: 'nv 03', fullName: 'X', role: 'STAFF', password: 'Matkhau@3' } })).status, 400);
});

test('Khóa tài khoản → không đăng nhập được, phiên cũ mất hiệu lực; mở khóa lại được', async () => {
  const nv02 = db.users.find((u) => u.username === 'nv02');
  const session = await login('nv02', 'Matkhau@2');
  assert.equal((await api.call('PATCH', `/api/users/${nv02.userId}`, { cookie: admin, body: { isActive: false } })).status, 200);
  assert.equal((await api.call('GET', '/api/auth/me', { cookie: session })).status, 401);
  assert.equal(await login('nv02', 'Matkhau@2'), null);
  assert.equal((await api.call('PATCH', `/api/users/${nv02.userId}`, { cookie: admin, body: { isActive: 'yes' } })).status, 400);
  assert.equal((await api.call('PATCH', `/api/users/${nv02.userId}`, { cookie: admin, body: { isActive: true } })).status, 200);
  assert.ok(await login('nv02', 'Matkhau@2'));
});

test('Admin đặt lại mật khẩu cho nhân viên', async () => {
  const nv02 = db.users.find((u) => u.username === 'nv02');
  assert.equal((await api.call('POST', `/api/users/${nv02.userId}/reset-password`, { cookie: admin, body: { password: 'MoiDoi@123' } })).status, 204);
  assert.equal(await login('nv02', 'Matkhau@2'), null);
  assert.ok(await login('nv02', 'MoiDoi@123'));
});

test('Không tự khóa / tự hạ quyền; không khóa admin cuối cùng', async () => {
  assert.equal((await api.call('PATCH', '/api/users/1', { cookie: admin, body: { isActive: false } })).json.error.code, 'CANNOT_CHANGE_SELF');
  assert.equal((await api.call('PATCH', '/api/users/1', { cookie: admin, body: { role: 'STAFF' } })).json.error.code, 'CANNOT_CHANGE_SELF');
  // tạo admin thứ 2, admin 2 thử khóa admin 1 → được (vẫn còn admin 2); rồi admin 1 không khóa được admin 2 nữa vì đã bị khóa
  await api.call('POST', '/api/users', { cookie: admin, body: { username: 'admin2', fullName: 'QT 2', role: 'ADMIN', password: 'Admin2@123' } });
  const admin2 = await login('admin2', 'Admin2@123');
  const a2 = db.users.find((u) => u.username === 'admin2');
  // admin2 hạ quyền admin1 → còn 1 admin (admin2) → hợp lệ
  assert.equal((await api.call('PATCH', '/api/users/1', { cookie: admin2, body: { role: 'STAFF' } })).status, 200);
  // admin2 bây giờ là admin cuối cùng → không ai khóa được (tự khóa bị chặn trước)
  assert.equal((await api.call('PATCH', `/api/users/${a2.userId}`, { cookie: admin2, body: { isActive: false } })).json.error.code, 'CANNOT_CHANGE_SELF');
  // khôi phục
  assert.equal((await api.call('PATCH', '/api/users/1', { cookie: admin2, body: { role: 'ADMIN' } })).status, 200);
});
