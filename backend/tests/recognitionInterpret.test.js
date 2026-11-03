/** Kiểm thử hàm diễn giải kết quả AI (hàm thuần, không cần server). */
const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/testApp'); // nạp biến môi trường cho test
const { interpretAiResult } = require('../src/services/recognitionService');

test('Không có biển / dữ liệu rác → NOT_FOUND', () => {
  assert.equal(interpretAiResult({ plates: [] }).status, 'NOT_FOUND');
  assert.equal(interpretAiResult(null).status, 'NOT_FOUND');
  assert.equal(interpretAiResult({ plates: [{ text: '  ', confidence: 1 }] }).status, 'NOT_FOUND');
});

test('Ngưỡng độ tin cậy 0.85', () => {
  assert.equal(interpretAiResult({ plates: [{ text: '51F12345', confidence: 0.85 }] }).status, 'SUCCESS');
  assert.equal(interpretAiResult({ plates: [{ text: '51F12345', confidence: 0.84 }] }).status, 'LOW_CONFIDENCE');
  assert.equal(interpretAiResult({ plates: [{ text: '51F12345' }] }).status, 'LOW_CONFIDENCE');
});

test('Độ tin cậy ngoài khoảng 0–1 bị kẹp lại', () => {
  assert.equal(interpretAiResult({ plates: [{ text: '51F12345', confidence: 7 }] }).confidence, 1);
});
