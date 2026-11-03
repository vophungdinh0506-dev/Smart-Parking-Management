/**
 * Kiểm thử hàm tính phí theo đúng 12 ví dụ trong docs/02-thiet-ke-he-thong.md, mục 4.2.
 * Chạy: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateFee } = require('../src/utils/feeCalculator');

// Tạo Date theo giờ Việt Nam cho dễ đọc
const vn = (s) => new Date(`${s}:00+07:00`);

const MOTORBIKE = { pricingRuleId: 1, dayStartTime: '06:00', nightStartTime: '22:00',
  dayFee: 5000, nightFee: 30000, shortStayMinutes: 30, shortStayPercent: 50 };
const CAR = { pricingRuleId: 2, dayStartTime: '06:00', nightStartTime: '22:00',
  dayFee: 30000, nightFee: 50000, shortStayMinutes: 30, shortStayPercent: 50 };

const cases = [
  [1,  'Xe máy gửi 20 phút → gửi ngắn',         MOTORBIKE, '2026-10-27T08:00', '2026-10-27T08:20', 2500,   ['SHORT_STAY']],
  [2,  'Xe máy đúng 30 phút → vẫn gửi ngắn',    MOTORBIKE, '2026-10-27T08:00', '2026-10-27T08:30', 2500,   ['SHORT_STAY']],
  [3,  'Xe máy 31 phút → 1 khung thường',       MOTORBIKE, '2026-10-27T08:00', '2026-10-27T08:31', 5000,   ['DAY']],
  [4,  'Xe máy cả ngày tới 21:59',              MOTORBIKE, '2026-10-27T08:00', '2026-10-27T21:59', 5000,   ['DAY']],
  [5,  'Xe máy 21:00→23:00 qua 22h',            MOTORBIKE, '2026-10-27T21:00', '2026-10-27T23:00', 35000,  ['DAY', 'NIGHT']],
  [6,  'Xe máy chỉ trong khung đêm',            MOTORBIKE, '2026-10-27T23:00', '2026-10-28T05:00', 30000,  ['NIGHT']],
  [7,  'Xe máy 20:00→07:00 hôm sau',            MOTORBIKE, '2026-10-27T20:00', '2026-10-28T07:00', 40000,  ['DAY', 'NIGHT', 'DAY']],
  [8,  'Ô tô 25 phút → gửi ngắn',               CAR,       '2026-10-27T09:00', '2026-10-27T09:25', 15000,  ['SHORT_STAY']],
  [9,  'Ô tô ra đúng 22:00:00 → không tính đêm', CAR,      '2026-10-27T08:00', '2026-10-27T22:00', 30000,  ['DAY']],
  [10, 'Ô tô 20:00→07:00 hôm sau',              CAR,       '2026-10-27T20:00', '2026-10-28T07:00', 110000, ['DAY', 'NIGHT', 'DAY']],
  [11, 'Ô tô T2 10:00 → T4 09:00',              CAR,       '2026-10-26T10:00', '2026-10-28T09:00', 190000, ['DAY', 'NIGHT', 'DAY', 'NIGHT', 'DAY']],
  [12, 'Xe máy 21:50→22:10 (gửi ngắn vắt 22h)', MOTORBIKE, '2026-10-27T21:50', '2026-10-27T22:10', 2500,   ['SHORT_STAY']],
];

for (const [no, name, rule, inAt, outAt, expected, kinds] of cases) {
  test(`Ca ${no}: ${name} = ${expected}đ`, () => {
    const result = calculateFee(vn(inAt), vn(outAt), rule);
    assert.equal(result.totalAmount, expected);
    assert.deepEqual(result.items.map((i) => i.kind), kinds);
    // Tổng các dòng chi tiết phải bằng tổng tiền
    assert.equal(result.items.reduce((s, i) => s + i.amount, 0), result.totalAmount);
  });
}

test('Xe vào lúc 02:00 (sau nửa đêm) tới 06:00 → 1 khung đêm', () => {
  const r = calculateFee(vn('2026-10-28T02:00'), vn('2026-10-28T06:00'), MOTORBIKE);
  assert.equal(r.totalAmount, 30000);
  assert.deepEqual(r.items.map((i) => i.kind), ['NIGHT']);
});

test('Khung đêm vắt qua nửa đêm chỉ tính 1 lần', () => {
  const r = calculateFee(vn('2026-10-27T22:30'), vn('2026-10-28T05:30'), CAR);
  assert.equal(r.totalAmount, 50000);
  assert.equal(r.items.length, 1);
});

test('30 phút 1 giây không còn là gửi ngắn', () => {
  const inAt = vn('2026-10-27T08:00');
  const outAt = new Date(inAt.getTime() + (30 * 60 + 1) * 1000);
  const r = calculateFee(inAt, outAt, MOTORBIKE);
  assert.equal(r.isShortStay, false);
  assert.equal(r.totalAmount, 5000);
});

test('Giờ ra sớm hơn giờ vào → báo lỗi', () => {
  assert.throws(
    () => calculateFee(vn('2026-10-27T10:00'), vn('2026-10-27T09:00'), MOTORBIKE),
    { code: 'INVALID_TIME_RANGE' },
  );
});

test('Bảng giá có số âm → báo lỗi', () => {
  assert.throws(() => calculateFee(vn('2026-10-27T08:00'), vn('2026-10-27T10:00'), { ...CAR, dayFee: -1 }));
});

test('Nhận giờ dạng Date (kiểu TIME từ SQL Server qua mssql)', () => {
  const rule = { ...CAR,
    dayStartTime: new Date(Date.UTC(1970, 0, 1, 6, 0)),
    nightStartTime: new Date(Date.UTC(1970, 0, 1, 22, 0)) };
  assert.equal(calculateFee(vn('2026-10-27T20:00'), vn('2026-10-28T07:00'), rule).totalAmount, 110000);
});

test('Đổi giờ khung trong bảng giá được áp dụng', () => {
  const rule = { ...MOTORBIKE, nightStartTime: '18:00' };
  assert.equal(calculateFee(vn('2026-10-27T17:00'), vn('2026-10-27T19:00'), rule).totalAmount, 35000);
});
