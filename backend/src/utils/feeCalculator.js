/**
 * TÍNH PHÍ GỬI XE — quy tắc đã được nhóm xác nhận ngày 27/10/2026.
 *
 * 1. Khung THƯỜNG: DayStartTime → NightStartTime (mặc định 06:00 → 22:00)
 *    Khung ĐÊM:    NightStartTime → DayStartTime hôm sau (mặc định 22:00 → 06:00)
 * 2. Xe ở trong khung nào (> 0 giây) thì tính phí khung đó, cộng dồn mọi khung:
 *      mỗi khung thường = DayFee, mỗi khung đêm = NightFee (trọn gói).
 * 3. Gửi ngắn: nếu TỔNG thời gian ≤ ShortStayMinutes (30 phút)
 *      → chỉ thu ShortStayPercent% (50%) của DayFee.
 *
 * Đây là HÀM THUẦN: không đọc database, không đọc đồng hồ hệ thống.
 * Cùng đầu vào luôn cho cùng kết quả → dễ kiểm thử (xem tests/feeCalculator.test.js).
 */
const { VN_OFFSET_MS, MINUTE_MS, DAY_MS, timeToMinutes, formatVN } = require('./time');

/**
 * Chia khoảng [checkInAt, checkOutAt) thành các đoạn theo khung thường / khung đêm.
 * @returns {{kind: 'DAY'|'NIGHT', from: Date, to: Date}[]}
 */
function splitIntoPeriods(checkInAt, checkOutAt, dayStartMinutes, nightStartMinutes) {
  // Làm việc trên "đồng hồ Việt Nam": cộng 7 tiếng rồi dùng phép tính UTC.
  let cursor = checkInAt.getTime() + VN_OFFSET_MS;
  const end = checkOutAt.getTime() + VN_OFFSET_MS;
  const periods = [];

  while (cursor < end) {
    const midnight = Math.floor(cursor / DAY_MS) * DAY_MS;      // 00:00 của ngày đang xét
    const minuteOfDay = (cursor - midnight) / MINUTE_MS;

    let kind;
    let boundary; // thời điểm khung hiện tại kết thúc
    if (minuteOfDay >= dayStartMinutes && minuteOfDay < nightStartMinutes) {
      kind = 'DAY';
      boundary = midnight + nightStartMinutes * MINUTE_MS;                // hết khung thường lúc 22:00
    } else if (minuteOfDay >= nightStartMinutes) {
      kind = 'NIGHT';
      boundary = midnight + DAY_MS + dayStartMinutes * MINUTE_MS;         // 06:00 sáng hôm sau
    } else {
      kind = 'NIGHT';                                                     // từ 00:00 đến trước 06:00
      boundary = midnight + dayStartMinutes * MINUTE_MS;                  // 06:00 cùng ngày
    }

    const periodEnd = Math.min(boundary, end);
    periods.push({
      kind,
      from: new Date(cursor - VN_OFFSET_MS),
      to: new Date(periodEnd - VN_OFFSET_MS),
    });
    cursor = boundary;
  }
  return periods;
}

function assertNonNegativeInt(name, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Bảng giá không hợp lệ: ${name} = ${value}`);
  }
}

/**
 * @param {Date} checkInAt
 * @param {Date} checkOutAt
 * @param {{dayFee:number, nightFee:number, shortStayMinutes:number, shortStayPercent:number,
 *          dayStartTime:string|Date, nightStartTime:string|Date, pricingRuleId?:number}} rule
 */
function calculateFee(checkInAt, checkOutAt, rule) {
  if (!(checkInAt instanceof Date) || Number.isNaN(checkInAt.getTime()) ||
      !(checkOutAt instanceof Date) || Number.isNaN(checkOutAt.getTime())) {
    throw new Error('Thời gian vào/ra không hợp lệ');
  }
  if (checkOutAt < checkInAt) {
    const err = new Error('Thời gian ra không được sớm hơn thời gian vào');
    err.code = 'INVALID_TIME_RANGE';
    throw err;
  }
  ['dayFee', 'nightFee', 'shortStayMinutes', 'shortStayPercent'].forEach((k) => assertNonNegativeInt(k, rule[k]));
  if (rule.shortStayPercent > 100) throw new Error('Bảng giá không hợp lệ: shortStayPercent > 100');

  const dayStart = timeToMinutes(rule.dayStartTime);
  const nightStart = timeToMinutes(rule.nightStartTime);
  if (dayStart >= nightStart) throw new Error('Bảng giá không hợp lệ: giờ bắt đầu khung thường phải trước khung đêm');

  const durationSeconds = Math.floor((checkOutAt - checkInAt) / 1000);
  const ruleSnapshot = {
    pricingRuleId: rule.pricingRuleId ?? null,
    dayStartTime: minutesToHHmm(dayStart),
    nightStartTime: minutesToHHmm(nightStart),
    dayFee: rule.dayFee,
    nightFee: rule.nightFee,
    shortStayMinutes: rule.shortStayMinutes,
    shortStayPercent: rule.shortStayPercent,
  };

  // Quy tắc 3: gửi ngắn
  if (durationSeconds <= rule.shortStayMinutes * 60) {
    const amount = Math.round((rule.dayFee * rule.shortStayPercent) / 100);
    return {
      totalAmount: amount,
      durationSeconds,
      isShortStay: true,
      items: [{
        kind: 'SHORT_STAY',
        from: checkInAt,
        to: checkOutAt,
        amount,
        label: `Gửi ngắn ≤ ${rule.shortStayMinutes} phút: ${rule.shortStayPercent}% × ${rule.dayFee}đ`,
      }],
      rule: ruleSnapshot,
    };
  }

  // Quy tắc 1–2: cộng dồn từng khung
  const items = splitIntoPeriods(checkInAt, checkOutAt, dayStart, nightStart).map((p) => {
    const isDay = p.kind === 'DAY';
    return {
      kind: p.kind,
      from: p.from,
      to: p.to,
      amount: isDay ? rule.dayFee : rule.nightFee,
      label: `${isDay ? 'Khung thường' : 'Khung đêm'} ${formatVN(p.from)} → ${formatVN(p.to)}`,
    };
  });

  return {
    totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
    durationSeconds,
    isShortStay: false,
    items,
    rule: ruleSnapshot,
  };
}

function minutesToHHmm(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

module.exports = { calculateFee, splitIntoPeriods };
