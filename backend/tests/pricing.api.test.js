/**
 * Kiểm thử biểu phí: xem, đổi giá (chỉ ADMIN), lịch sử phiên bản, thử tính phí (TC07, TC08),
 * và đảm bảo xe đang gửi vẫn tính theo giá lúc vào.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

let db; let api; let admin; let staff;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 7)]);
const vn = (s) => `${s}:00+07:00`;

test.before(async () => {
  const helpers = require('./helpers/testApp');
  db = require('./helpers/fakeDb').installFakeDb();
  api = await helpers.startServer(require('../src/app').createApp);
  const login = async (u, p) => (await api.call('POST', '/api/auth/login', { body: { username: u, password: p } }))
    .setCookie.find((c) => c.startsWith('sp_session=')).split(';')[0];
  admin = await login('admin', 'Admin@123');
  staff = await login('nv01', 'Staff@123');
});
test.after(() => api.close());

const NEW_CAR_RULE = { vehicleTypeId: 2, dayStartTime: '6:00', nightStartTime: '22:00', dayFee: 40000, nightFee: 60000, shortStayMinutes: 15, shortStayPercent: 50 };

test('Nhân viên xem được bảng giá đang áp dụng', async () => {
  const r = await api.call('GET', '/api/pricing-rules', { cookie: staff });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.items.map((i) => [i.vehicleType.code, i.dayFee, i.nightFee]), [['MOTORBIKE', 5000, 30000], ['CAR', 30000, 50000]]);
});

test('TC07: thử tính phí khớp biểu phí đã chốt', async () => {
  const cases = [
    [2, '2026-10-27T20:00', '2026-10-28T07:00', 110000],
    [1, '2026-10-27T21:00', '2026-10-27T23:00', 35000],
    [1, '2026-10-27T08:00', '2026-10-27T08:20', 2500],
  ];
  for (const [vehicleTypeId, from, to, expected] of cases) {
    const r = await api.call('POST', '/api/pricing-rules/simulate', { cookie: staff, body: { vehicleTypeId, checkInAt: vn(from), checkOutAt: vn(to) } });
    assert.equal(r.status, 200);
    assert.equal(r.json.fee.totalAmount, expected, `${from} → ${to}`);
  }
});

test('TC08: thử tính với giờ ra sớm hơn giờ vào → 400', async () => {
  const r = await api.call('POST', '/api/pricing-rules/simulate', { cookie: staff, body: { vehicleTypeId: 1, checkInAt: vn('2026-10-27T10:00'), checkOutAt: vn('2026-10-27T09:00') } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'INVALID_TIME_RANGE');
});

test('Nhân viên KHÔNG được đổi giá (403)', async () => {
  const r = await api.call('POST', '/api/pricing-rules', { cookie: staff, body: NEW_CAR_RULE });
  assert.equal(r.status, 403);
  assert.equal(db.pricing.length, 2);
});

test('Dữ liệu biểu phí sai → 400', async () => {
  const bad = [
    { ...NEW_CAR_RULE, dayFee: -1 },
    { ...NEW_CAR_RULE, dayFee: 'abc' },
    { ...NEW_CAR_RULE, shortStayPercent: 150 },
    { ...NEW_CAR_RULE, dayStartTime: '25:00' },
    { ...NEW_CAR_RULE, dayStartTime: '23:00', nightStartTime: '22:00' },
    { ...NEW_CAR_RULE, vehicleTypeId: 9 },
  ];
  for (const body of bad) {
    assert.equal((await api.call('POST', '/api/pricing-rules', { cookie: admin, body })).status, 400, JSON.stringify(body));
  }
});

test('Đổi giá: tạo phiên bản mới, phiên bản cũ được giữ lại; xe đang gửi vẫn tính theo giá cũ', async () => {
  // Xe vào TRƯỚC khi đổi giá
  const form = new FormData();
  form.append('direction', 'IN'); form.append('image', new Blob([JPEG], { type: 'image/jpeg' }), 'x.jpg');
  const rec = await (await fetch(`${api.base}/api/recognitions`, { method: 'POST', body: form, headers: { Cookie: staff } })).json();
  const ci = await api.call('POST', '/api/sessions/check-in', { cookie: staff, body: { recognitionId: rec.recognitionId, plateNumber: '51F12345', vehicleTypeId: 2 } });
  assert.equal(ci.status, 201);
  const oldRuleId = ci.json.session.pricingRuleId;

  const r = await api.call('POST', '/api/pricing-rules', { cookie: admin, body: NEW_CAR_RULE });
  assert.equal(r.status, 201);
  assert.equal(r.json.rule.dayStartTime, '06:00');
  assert.equal(r.json.rule.dayFee, 40000);
  assert.equal(db.pricing.filter((p) => p.vehicleTypeId === 2 && p.isActive).length, 1);
  assert.equal(db.pricing.find((p) => p.pricingRuleId === oldRuleId).isActive, false);
  assert.ok(db.audits.some((a) => a.action === 'PRICE_CHANGE'));

  const hist = await api.call('GET', '/api/pricing-rules/history?vehicleTypeId=2', { cookie: staff });
  assert.deepEqual(hist.json.items.map((i) => i.dayFee), [40000, 30000]);

  // Lượt gửi cũ vẫn gắn với giá cũ
  assert.equal(db.sessions.find((s) => s.plateNumber === '51F12345').pricingRuleId, oldRuleId);
});

test('Thử tính với biểu phí nháp (chưa lưu)', async () => {
  const r = await api.call('POST', '/api/pricing-rules/simulate', { cookie: admin, body: {
    vehicleTypeId: 1, checkInAt: vn('2026-10-27T08:00'), checkOutAt: vn('2026-10-27T09:00'),
    rule: { dayStartTime: '06:00', nightStartTime: '22:00', dayFee: 8000, nightFee: 30000, shortStayMinutes: 30, shortStayPercent: 50 },
  } });
  assert.equal(r.json.fee.totalAmount, 8000);
});
