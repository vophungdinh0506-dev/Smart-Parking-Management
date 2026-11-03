/**
 * Kiểm thử luồng XE RA + TÍNH PHÍ (database giả lập, AI tắt → nhân viên nhập tay).
 * Ánh xạ ca kiểm thử trong đề cương: TC05, TC06, TC07, TC08, TC09, TC10.
 * Chạy: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');

let db;
let api;
let cookie;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 7)]);

test.before(async () => {
  const helpers = require('./helpers/testApp');
  db = require('./helpers/fakeDb').installFakeDb();
  const { createApp } = require('../src/app');
  api = await helpers.startServer(createApp);
  const login = await api.call('POST', '/api/auth/login', { body: { username: 'nv01', password: 'Staff@123' } });
  cookie = login.setCookie.find((c) => c.startsWith('sp_session=')).split(';')[0];
});
test.after(() => api.close());

async function upload(direction) {
  const form = new FormData();
  form.append('direction', direction);
  form.append('image', new Blob([JPEG], { type: 'image/jpeg' }), 'xe.jpg');
  const res = await fetch(`${api.base}/api/recognitions`, { method: 'POST', body: form, headers: { Cookie: cookie } });
  return (await res.json()).recognitionId;
}
const post = (url, body) => api.call('POST', url, { body, cookie });

/** Tạo sẵn 1 xe trong bãi, rồi lùi giờ vào cho giống xe đã gửi một lúc */
async function parkCar(plate, vehicleTypeId, minutesAgo) {
  const r = await post('/api/sessions/check-in', { recognitionId: await upload('IN'), plateNumber: plate, vehicleTypeId });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const s = db.sessions.find((x) => x.sessionId === r.json.session.sessionId);
  s.checkInAt = new Date(Date.now() - minutesAgo * 60000);
  return s.sessionId;
}

test('TC06: xe ra nhưng không có lượt gửi → 404, KHÔNG tạo lượt mới, có gợi ý biển gần giống', async () => {
  await parkCar('51F12345', 2, 90);
  const before = db.sessions.length;
  const r = await post('/api/sessions/check-out/preview', { recognitionId: await upload('OUT'), plateNumber: '51E12345' }); // đọc sai F→E
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, 'SESSION_NOT_FOUND');
  assert.equal(db.sessions.length, before);
  assert.deepEqual(r.json.error.details.suggestions.map((s) => s.plateNumber), ['51F12345']);
});

test('TC05 + TC07 + TC10: tìm đúng lượt, phí khớp biểu phí, xác nhận → đóng lượt + ghi thanh toán', async () => {
  const outRec = await upload('OUT');
  const p = await post('/api/sessions/check-out/preview', { recognitionId: outRec, plateNumber: '51F-123.45' });
  assert.equal(p.status, 200);
  assert.equal(p.json.session.plateNumber, '51F12345');
  assert.ok(p.json.checkOutImageUrl);
  assert.ok(p.json.fee.totalAmount > 0);
  assert.equal(p.json.fee.items.reduce((s, i) => s + i.amount, 0), p.json.fee.totalAmount, 'tổng = cộng các dòng chi tiết');
  assert.equal(db.sessions.find((s) => s.plateNumber === '51F12345').status, 'OPEN', 'xem trước không được đóng lượt');

  const c = await post(`/api/sessions/${p.json.session.sessionId}/check-out`,
    { recognitionId: outRec, plateNumber: '51F12345', expectedAmount: p.json.fee.totalAmount });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  assert.equal(c.json.session.status, 'CLOSED');
  assert.equal(c.json.session.feeAmount, p.json.fee.totalAmount);
  assert.ok(new Date(c.json.session.checkOutAt) >= new Date(c.json.session.checkInAt));
  assert.ok(c.json.session.checkOutImageUrl);
  assert.equal(db.payments.length, 1);
  assert.equal(db.payments[0].amount, p.json.fee.totalAmount);
  assert.ok(db.audits.some((a) => a.action === 'CHECK_OUT'));
});

test('Lượt đã kết thúc → không thu tiền lần 2; xe ra lại không tìm thấy lượt', async () => {
  const sid = db.sessions.find((s) => s.plateNumber === '51F12345').sessionId;
  const again = await post(`/api/sessions/${sid}/check-out`, { recognitionId: await upload('OUT'), plateNumber: '51F12345', expectedAmount: 0 });
  assert.equal(again.status, 409);
  assert.equal(again.json.error.code, 'SESSION_NOT_OPEN');
  assert.equal(db.payments.length, 1);
  const p = await post('/api/sessions/check-out/preview', { recognitionId: await upload('OUT'), plateNumber: '51F12345' });
  assert.equal(p.status, 404);
});

test('Không tin số tiền từ frontend: expectedAmount sai → 409 FEE_CHANGED, lượt vẫn mở', async () => {
  const sid = await parkCar('30A99999', 2, 200);
  const r = await post(`/api/sessions/${sid}/check-out`, { recognitionId: await upload('OUT'), plateNumber: '30A99999', expectedAmount: 1000 });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, 'FEE_CHANGED');
  assert.ok(r.json.error.details.totalAmount > 1000);
  assert.equal(db.sessions.find((s) => s.sessionId === sid).status, 'OPEN');
  assert.equal(db.payments.filter((x) => x.sessionId === sid).length, 0);
});

test('2 nhân viên bấm "Đã thu tiền" CÙNG LÚC → chỉ 1 thanh toán', async () => {
  const sid = db.sessions.find((s) => s.plateNumber === '30A99999').sessionId;
  const p = await post('/api/sessions/check-out/preview', { recognitionId: await upload('OUT'), plateNumber: '30A99999' });
  const body = (rec) => ({ recognitionId: rec, plateNumber: '30A99999', expectedAmount: p.json.fee.totalAmount });
  const [a, b] = await Promise.all([
    post(`/api/sessions/${sid}/check-out`, body(await upload('OUT'))),
    post(`/api/sessions/${sid}/check-out`, body(await upload('OUT'))),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(db.payments.filter((x) => x.sessionId === sid).length, 1);
});

test('TC08: thời điểm ra sớm hơn thời điểm vào → từ chối, không đóng lượt', async () => {
  const sid = await parkCar('59X112345', 1, 10);
  db.sessions.find((s) => s.sessionId === sid).checkInAt = new Date(Date.now() + 3600000); // giờ vào ở tương lai (dữ liệu sai)
  const r = await post('/api/sessions/check-out/preview', { recognitionId: await upload('OUT'), plateNumber: '59X112345' });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'INVALID_TIME_RANGE');
  db.sessions.find((s) => s.sessionId === sid).checkInAt = new Date(Date.now() - 20 * 60000); // trả lại cho test sau
});

test('TC09: nhân viên sửa biển số AI đọc sai → xử lý theo biển đã xác nhận, đánh dấu sửa tay', async () => {
  const outRec = await upload('OUT'); // AI tắt → RecognizedPlate = null ≠ biển nhân viên nhập
  const p = await post('/api/sessions/check-out/preview', { recognitionId: outRec, plateNumber: '59-X1 123.45' });
  assert.equal(p.status, 200);
  assert.equal(p.json.fee.isShortStay, true, '20 phút → gửi ngắn');
  assert.equal(p.json.fee.totalAmount, 2500);
  const c = await post(`/api/sessions/${p.json.session.sessionId}/check-out`, { recognitionId: outRec, plateNumber: '59X112345', expectedAmount: 2500 });
  assert.equal(c.status, 200);
  assert.equal(c.json.session.checkOutPlateEdited, true);
});

test('Biển số xác nhận không khớp lượt gửi / ảnh xe VÀO dùng cho xe RA → bị từ chối', async () => {
  const sid = await parkCar('51G55555', 2, 60);
  const mismatch = await post(`/api/sessions/${sid}/check-out`, { recognitionId: await upload('OUT'), plateNumber: '51G55556', expectedAmount: 30000 });
  assert.equal(mismatch.json.error.code, 'PLATE_MISMATCH');
  const wrongDir = await post('/api/sessions/check-out/preview', { recognitionId: await upload('IN'), plateNumber: '51G55555' });
  assert.equal(wrongDir.json.error.code, 'WRONG_DIRECTION');
});

test('Dữ liệu sai kiểu → 400', async () => {
  assert.equal((await post('/api/sessions/1/check-out', { recognitionId: 1, plateNumber: '51G55555', expectedAmount: -5 })).status, 400);
  assert.equal((await post('/api/sessions/abc/check-out', { recognitionId: 1, plateNumber: '51G55555', expectedAmount: 0 })).status, 400);
  assert.equal((await post('/api/sessions/check-out/preview', { recognitionId: 1, plateNumber: 'XYZ' })).status, 400);
});
