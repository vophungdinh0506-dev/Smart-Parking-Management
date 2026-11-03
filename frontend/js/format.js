/** Định dạng hiển thị dùng chung: thời gian theo giờ Việt Nam, tiền VNĐ, thời lượng. */
(() => {
const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/** "2026-10-27T12:50:05.000Z" → "19:50 27/10/2026" */
function dateTime(iso) {
  if (!iso) return '';
  const parts = Object.fromEntries(timeFormatter.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
}

function money(amount) {
  return `${Number(amount ?? 0).toLocaleString('vi-VN')}đ`;
}

/** Số phút → "2 giờ 15 phút" */
function duration(fromIso, toIso = new Date().toISOString()) {
  const minutes = Math.max(0, Math.floor((new Date(toIso) - new Date(fromIso)) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts = [];
  if (days) parts.push(`${days} ngày`);
  if (hours) parts.push(`${hours} giờ`);
  parts.push(`${mins} phút`);
  return parts.join(' ');
}

window.format = { dateTime, money, duration };
})();
