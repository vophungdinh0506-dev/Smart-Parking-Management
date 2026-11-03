/**
 * Chuẩn hóa và kiểm tra biển số xe dân sự Việt Nam.
 *
 * Chuẩn hóa = viết hoa + bỏ dấu "-", ".", khoảng trắng.
 *   "51f-123.45"   → "51F12345"   (ô tô)
 *   "59-X1 123.45" → "59X112345"  (xe máy)
 *   "29-MĐ1 123.45"→ "29MĐ112345" (xe máy điện)
 *
 * Định dạng hợp lệ (sau chuẩn hóa):
 *   Ô tô  : 2 số + 1–2 chữ + 4–5 số               (51F12345, 30AB1234)
 *   Xe máy: 2 số + 1–2 chữ + [1 số] + 4–5 số       (59X112345, 29B11234, 59AA12345)
 * Biển đặc biệt (quân đội, ngoại giao...) nằm ngoài phạm vi.
 */
const VEHICLE_PATTERNS = {
  CAR: /^[0-9]{2}[A-ZĐ]{1,2}[0-9]{4,5}$/,
  MOTORBIKE: /^[0-9]{2}[A-ZĐ]{1,2}[0-9]?[0-9]{4,5}$/,
};

function normalizePlate(input) {
  if (typeof input !== 'string') return '';
  return input.normalize('NFC').toUpperCase().replace(/[\s.\-_]/g, '');
}

/** @param {'CAR'|'MOTORBIKE'} [vehicleTypeCode] bỏ trống = chấp nhận nếu khớp bất kỳ loại nào */
function isValidPlate(normalized, vehicleTypeCode) {
  if (typeof normalized !== 'string' || normalized.length > 12) return false;
  if (vehicleTypeCode) {
    const pattern = VEHICLE_PATTERNS[vehicleTypeCode];
    return Boolean(pattern) && pattern.test(normalized);
  }
  return Object.values(VEHICLE_PATTERNS).some((p) => p.test(normalized));
}

/** Định dạng để hiển thị: "51F-123.45", "59-X1 123.45". Không hợp lệ thì trả nguyên chuỗi. */
function formatPlate(normalized, vehicleTypeCode) {
  const pattern = vehicleTypeCode === 'CAR'
    ? /^([0-9]{2})([A-ZĐ]{1,2})()([0-9]{4,5})$/
    : /^([0-9]{2})([A-ZĐ]{1,2})([0-9]?)([0-9]{4,5})$/;
  const m = pattern.exec(normalized || '');
  if (!m) return normalized || '';
  const [, province, letters, seriesDigit, number] = m;
  const num = number.length === 5 ? `${number.slice(0, 3)}.${number.slice(3)}` : number;
  return vehicleTypeCode === 'CAR'
    ? `${province}${letters}-${num}`
    : `${province}-${letters}${seriesDigit} ${num}`;
}

module.exports = { normalizePlate, isValidPlate, formatPlate };
