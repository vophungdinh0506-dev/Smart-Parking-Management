const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlate, isValidPlate, formatPlate } = require('../src/utils/plate');

test('Chuẩn hóa biển số', () => {
  assert.equal(normalizePlate('51f-123.45'), '51F12345');
  assert.equal(normalizePlate(' 59-X1 123.45 '), '59X112345');
  assert.equal(normalizePlate('29-mđ1 123.45'), '29MĐ112345');
  assert.equal(normalizePlate(null), '');
});

test('Biển ô tô hợp lệ / không hợp lệ', () => {
  assert.ok(isValidPlate('51F12345', 'CAR'));
  assert.ok(isValidPlate('30AB1234', 'CAR'));
  assert.ok(!isValidPlate('59X112345', 'CAR'));   // 9 ký tự kiểu xe máy
  assert.ok(!isValidPlate('5F12345', 'CAR'));     // thiếu số tỉnh
  assert.ok(!isValidPlate('51F123', 'CAR'));      // thiếu số
});

test('Biển xe máy hợp lệ / không hợp lệ', () => {
  assert.ok(isValidPlate('59X112345', 'MOTORBIKE'));
  assert.ok(isValidPlate('29B11234', 'MOTORBIKE'));
  assert.ok(isValidPlate('29MĐ112345', 'MOTORBIKE'));
  assert.ok(isValidPlate('59AA12345', 'MOTORBIKE'));
  assert.ok(!isValidPlate('59X1123456', 'MOTORBIKE'));
  assert.ok(!isValidPlate('ABC12345', 'MOTORBIKE'));
  assert.ok(!isValidPlate("51F1'; DROP", 'MOTORBIKE'));
});

test('Định dạng hiển thị', () => {
  assert.equal(formatPlate('51F12345', 'CAR'), '51F-123.45');
  assert.equal(formatPlate('30AB1234', 'CAR'), '30AB-1234');
  assert.equal(formatPlate('59X112345', 'MOTORBIKE'), '59-X1 123.45');
  assert.equal(formatPlate('29B11234', 'MOTORBIKE'), '29-B1 1234');
});
