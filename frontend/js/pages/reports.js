/**
 * Trang DOANH THU (chức năng mở rộng, chỉ ADMIN).
 * Số liệu do backend tổng hợp từ bảng Payments; trang này chỉ hiển thị.
 * Biểu đồ cột 1 chuỗi (tổng doanh thu theo ngày) vẽ bằng HTML/CSS, có tooltip và bảng số liệu thay thế.
 */
(() => {
const { escapeHtml, setButtonLoading } = window.ui;
const fmt = window.format;
const $ = (id) => document.getElementById(id);

const vnToday = (offsetDays = 0) => new Date(Date.now() + 7 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
const shortDay = (day) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
/** Số tiền gọn cho nhãn trục: 1.250.000 → "1,25tr", 85.000 → "85k" */
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}tr` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

$('f-from').value = vnToday(-6);
$('f-to').value = vnToday();

document.querySelector('.toolbar__presets').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  $('f-to').value = vnToday();
  $('f-from').value = b.dataset.month ? `${vnToday().slice(0, 8)}01` : vnToday(1 - Number(b.dataset.days));
  load();
});

/** Làm tròn giá trị lớn nhất lên mốc "đẹp" để vạch lưới dễ đọc */
function niceMax(v) {
  if (v <= 0) return 10000;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v);
}

function renderChart(byDay) {
  const max = niceMax(Math.max(...byDay.map((d) => d.amount)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
  const step = byDay.length > 16 ? Math.ceil(byDay.length / 8) : 1; // thưa nhãn ngày khi khoảng dài
  $('chart').innerHTML = `
    <div class="chart__grid">${ticks.slice().reverse().map((t) => `<div class="chart__gridline"><span>${compact(t)}</span></div>`).join('')}</div>
    <div class="chart__bars" style="--n:${byDay.length}">
      ${byDay.map((d, i) => `
        <button type="button" class="chart__col" data-i="${i}" aria-label="${escapeHtml(shortDay(d.day))}: ${escapeHtml(fmt.money(d.amount))}, ${d.count} lượt">
          <span class="chart__bar" style="height:${(d.amount / max) * 100}%"></span>
          <span class="chart__label">${i % step === 0 ? escapeHtml(shortDay(d.day)) : ''}</span>
        </button>`).join('')}
    </div>`;

  const tip = $('chart-tooltip');
  const show = (col) => {
    const d = byDay[Number(col.dataset.i)];
    tip.innerHTML = `<strong>${escapeHtml(shortDay(d.day))}/${d.day.slice(0, 4)}</strong><br>
      ${escapeHtml(fmt.money(d.amount))} · ${d.count} lượt<br>
      <span class="muted">Xe máy ${escapeHtml(fmt.money(d.byVehicleType.MOTORBIKE ?? 0))} · Ô tô ${escapeHtml(fmt.money(d.byVehicleType.CAR ?? 0))}</span>`;
    tip.hidden = false;
    // Đặt tooltip ngay trên đỉnh cột (không che tiêu đề), không tràn ra ngoài khung
    const r = col.querySelector('.chart__bar').getBoundingClientRect();
    const host = $('report').getBoundingClientRect();
    const left = Math.min(Math.max(r.left - host.left + r.width / 2 - tip.offsetWidth / 2, 0), host.width - tip.offsetWidth);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(r.top - host.top - tip.offsetHeight - 8, 0)}px`;
    col.classList.add('is-active');
  };
  const hide = (col) => { tip.hidden = true; col?.classList.remove('is-active'); };
  $('chart').querySelectorAll('.chart__col').forEach((col) => {
    col.addEventListener('mouseenter', () => show(col));
    col.addEventListener('focus', () => show(col));
    col.addEventListener('mouseleave', () => hide(col));
    col.addEventListener('blur', () => hide(col));
  });
}

async function load() {
  $('report-error').hidden = true;
  const btn = $('filter-form').querySelector('button[type="submit"]');
  setButtonLoading(btn, true, 'Đang tải...');
  const qs = new URLSearchParams({ from: $('f-from').value, to: $('f-to').value });
  const result = await window.api.request(`/api/reports/revenue?${qs}`);
  setButtonLoading(btn, false);
  if (!result.ok) {
    $('report').hidden = true;
    $('report-error').textContent = result.status === 403 ? 'Chỉ quản trị viên được xem doanh thu.' : result.error.message;
    $('report-error').hidden = false;
    return;
  }
  const r = result.data;
  const avg = r.totalCount ? Math.round(r.totalAmount / r.totalCount) : 0;
  $('stats').innerHTML = [
    ['Tổng doanh thu', fmt.money(r.totalAmount)],
    ['Số lượt thu tiền', r.totalCount.toLocaleString('vi-VN')],
    ['Trung bình / lượt', fmt.money(avg)],
    ...r.byVehicleType.map((v) => [`${v.name}`, `${fmt.money(v.amount)}`, `${v.count} lượt`]),
    ['Lượt bị hủy', r.cancelledCount.toLocaleString('vi-VN')],
  ].map(([k, v, sub]) => `<div class="stat"><div class="stat__label">${escapeHtml(k)}</div>
      <div class="stat__value">${escapeHtml(v)}</div>${sub ? `<div class="stat__sub">${escapeHtml(sub)}</div>` : ''}</div>`).join('');

  $('chart-title').textContent = `Doanh thu theo ngày (${shortDay(r.from)} – ${shortDay(r.to)})`;
  renderChart(r.byDay);
  $('report-table').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Ngày</th><th class="num">Xe máy</th><th class="num">Ô tô</th><th class="num">Tổng</th><th class="num">Số lượt</th></tr></thead>
      <tbody>${r.byDay.map((d) => `<tr><td>${escapeHtml(shortDay(d.day))}/${d.day.slice(0, 4)}</td>
        <td class="num">${escapeHtml(fmt.money(d.byVehicleType.MOTORBIKE ?? 0))}</td><td class="num">${escapeHtml(fmt.money(d.byVehicleType.CAR ?? 0))}</td>
        <td class="num"><strong>${escapeHtml(fmt.money(d.amount))}</strong></td><td class="num">${d.count}</td></tr>`).join('')}</tbody>
    </table>`;
  $('report').hidden = false;
}

$('filter-form').addEventListener('submit', (e) => { e.preventDefault(); load(); });
window.ui.ready.then(load);
})();
