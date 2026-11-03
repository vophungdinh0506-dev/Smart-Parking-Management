/** Kiểm thử chức năng mở rộng: lịch sử gửi xe (lọc theo ngày) và báo cáo doanh thu. */
const test = require('node:test');
const assert = require('node:assert/strict');

let db; let api; let admin; let staff;
const vnDate = (iso) => new Date(`${iso}+07:00`);

test.before(async () => {
  const helpers = require('./helpers/testApp');
  db = require('./helpers/fakeDb').installFakeDb();
  api = await helpers.startServer(require('../src/app').createApp);
  const login = async (u, p) => (await api.call('POST', '/api/auth/login', { body: { username: u, password: p } }))
    .setCookie.find((c) => c.startsWith('sp_session=')).split(';')[0];
  admin = await login('admin', 'Admin@123');
  staff = await login('nv01', 'Staff@123');

  // Dữ liệu mẫu: 3 lượt đã thu tiền ở 2 ngày, 1 lượt đang gửi, 1 lượt bị hủy
  const add = (id, plate, vt, inAt, outAt, fee, status = 'CLOSED') => {
    db.sessions.push({ sessionId: id, plateNumber: plate, vehicleTypeId: vt, pricingRuleId: vt, status,
      checkInAt: vnDate(inAt), checkOutAt: outAt ? vnDate(outAt) : null, feeAmount: fee, checkInBy: 2,
      cancelledAt: status === 'CANCELLED' ? vnDate(inAt) : null });
    if (status === 'CLOSED') db.payments.push({ paymentId: id, sessionId: id, amount: fee, paidAt: vnDate(outAt) });
  };
  add(1, '51F11111', 2, '2026-11-01T08:00:00', '2026-11-01T10:00:00', 30000);
  add(2, '59X111111', 1, '2026-11-01T23:30:00', '2026-11-02T00:10:00', 2500); // thu tiền lúc 00:10 ngày 2/11 giờ VN
  add(3, '51G22222', 2, '2026-11-02T20:00:00', '2026-11-02T23:00:00', 80000);
  add(4, '30A33333', 2, '2026-11-02T09:00:00', null, null, 'OPEN');
  add(5, '30A44444', 2, '2026-11-02T09:05:00', null, null, 'CANCELLED');
});
test.after(() => api.close());

test('Lịch sử: lọc theo trạng thái, biển số, khoảng ngày (theo giờ VN)', async () => {
  const get = async (q) => (await api.call('GET', `/api/sessions?${q}`, { cookie: staff })).json;
  assert.equal((await get('status=CLOSED')).total, 3);
  assert.equal((await get('plate=51g')).items[0].plateNumber, '51G22222');
  assert.deepEqual((await get('from=2026-11-01&to=2026-11-01')).items.map((s) => s.sessionId).sort(), [1, 2]);
  assert.equal((await get('from=2026-11-02&to=2026-11-02')).total, 3);
  assert.equal((await api.call('GET', '/api/sessions?from=2026-13-01', { cookie: staff })).status, 400);
  assert.equal((await api.call('GET', '/api/sessions?from=2026-11-05&to=2026-11-01', { cookie: staff })).status, 400);
});

test('Chi tiết lượt đã kết thúc có giờ ra, phí, link ảnh', async () => {
  db.sessions[0].checkOutImagePath = 'x/out.jpg';
  const r = await api.call('GET', '/api/sessions/1', { cookie: staff });
  assert.equal(r.json.session.feeAmount, 30000);
  assert.ok(r.json.session.checkOutImageUrl);
  assert.ok(!('checkInImagePath' in r.json.session), 'không lộ đường dẫn file trên máy chủ');
});

test('Doanh thu: chỉ ADMIN', async () => {
  assert.equal((await api.call('GET', '/api/reports/revenue?from=2026-11-01&to=2026-11-03', { cookie: staff })).status, 403);
});

test('Doanh thu: tổng, theo ngày (giờ VN), theo loại xe, đủ ngày trống', async () => {
  const r = await api.call('GET', '/api/reports/revenue?from=2026-11-01&to=2026-11-03', { cookie: admin });
  assert.equal(r.status, 200);
  assert.equal(r.json.totalAmount, 112500);
  assert.equal(r.json.totalCount, 3);
  assert.equal(r.json.cancelledCount, 1);
  assert.deepEqual(r.json.byDay.map((d) => [d.day, d.amount, d.count]),
    [['2026-11-01', 30000, 1], ['2026-11-02', 82500, 2], ['2026-11-03', 0, 0]]);
  assert.deepEqual(r.json.byVehicleType.map((v) => [v.code, v.amount, v.count]), [['MOTORBIKE', 2500, 1], ['CAR', 110000, 2]]);
});

test('Doanh thu: tham số sai → 400', async () => {
  for (const q of ['', 'from=2026-11-01', 'from=abc&to=2026-11-02', 'from=2026-11-05&to=2026-11-01', 'from=2025-01-01&to=2026-11-01']) {
    assert.equal((await api.call('GET', `/api/reports/revenue?${q}`, { cookie: admin })).status, 400, q);
  }
});
