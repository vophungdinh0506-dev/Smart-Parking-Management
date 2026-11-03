/**
 * Tiện ích thời gian.
 *
 * Database lưu thời gian theo UTC. Việt Nam dùng UTC+7 cố định (không có giờ mùa hè),
 * nên "giờ Việt Nam" = giờ UTC + 7 tiếng.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Thời điểm hiện tại, bỏ phần mili-giây.
 * Lý do: cột DATETIME2(0) chỉ lưu tới giây. Nếu tính phí bằng thời gian có mili-giây
 * rồi lưu bản đã làm tròn, số liệu đối soát có thể lệch nhau.
 */
function nowSeconds() {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

/** Đổi 'HH:mm', 'HH:mm:ss' hoặc Date (kiểu TIME do mssql trả về) thành số phút trong ngày. */
function timeToMinutes(value) {
  if (value instanceof Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value));
  if (!match) throw new Error(`Giờ không hợp lệ: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Giờ không hợp lệ: ${value}`);
  return hours * 60 + minutes;
}

/** Hiển thị Date theo giờ Việt Nam: "27/10/2026 08:05". */
function formatVN(date) {
  const d = new Date(date.getTime() + VN_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

module.exports = { VN_OFFSET_MS, MINUTE_MS, DAY_MS, nowSeconds, timeToMinutes, formatVN };
