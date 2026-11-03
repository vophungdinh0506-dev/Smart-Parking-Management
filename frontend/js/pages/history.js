/** Trang LỊCH SỬ GỬI XE (chức năng mở rộng) — lọc theo ngày vào, trạng thái, biển số; xem chi tiết. */
(() => {
const { escapeHtml } = window.ui;
const { showSessionDetail, STATUS_BADGE } = window.components;
const fmt = window.format;
const $ = (id) => document.getElementById(id);
const PAGE_SIZE = 20;
let page = 1;

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD */
function vnToday(offsetDays = 0) {
  return new Date(Date.now() + 7 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
}
$('f-from').value = vnToday(-6);
$('f-to').value = vnToday();

async function load() {
  const qs = new URLSearchParams({ page, pageSize: PAGE_SIZE });
  if ($('f-from').value) qs.set('from', $('f-from').value);
  if ($('f-to').value) qs.set('to', $('f-to').value);
  if ($('f-status').value) qs.set('status', $('f-status').value);
  if ($('f-plate').value.trim()) qs.set('plate', $('f-plate').value.trim());

  const result = await window.api.request(`/api/sessions?${qs}`);
  const wrap = $('table-wrap');
  if (!result.ok) { wrap.innerHTML = `<div class="alert alert--error">${escapeHtml(result.error.message)}</div>`; $('pager').innerHTML = ''; return; }
  const { items, total } = result.data;
  $('result-count').textContent = `${total} lượt`;
  if (!items.length) { wrap.innerHTML = '<div class="empty">Không có lượt gửi nào khớp điều kiện lọc.</div>'; $('pager').innerHTML = ''; return; }

  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Biển số</th><th>Loại xe</th><th>Giờ vào</th><th>Giờ ra</th><th>Thời gian gửi</th><th class="num">Phí</th><th>Trạng thái</th><th><span class="sr-only">Xem</span></th></tr></thead>
      <tbody>${items.map((s) => `
        <tr>
          <td class="muted">${s.sessionId}</td>
          <td><span class="plate">${escapeHtml(s.plateDisplay)}</span></td>
          <td>${escapeHtml(s.vehicleType.name)}</td>
          <td>${escapeHtml(fmt.dateTime(s.checkInAt))}</td>
          <td>${s.checkOutAt ? escapeHtml(fmt.dateTime(s.checkOutAt)) : '<span class="muted">—</span>'}</td>
          <td>${s.status === 'CANCELLED' ? '<span class="muted">—</span>' : escapeHtml(fmt.duration(s.checkInAt, s.checkOutAt ?? undefined))}</td>
          <td class="num">${s.feeAmount !== null ? escapeHtml(fmt.money(s.feeAmount)) : '<span class="muted">—</span>'}</td>
          <td>${STATUS_BADGE[s.status]}</td>
          <td><button class="btn btn--secondary btn--small" data-id="${s.sessionId}">Chi tiết</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  $('pager').innerHTML = pages <= 1 ? '' : `
    <button class="btn btn--secondary btn--small" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Trước</button>
    <span class="muted">Trang ${page}/${pages}</span>
    <button class="btn btn--secondary btn--small" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Sau →</button>`;
}

$('pager').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) { page = Number(b.dataset.page); load(); } });
$('filter-form').addEventListener('submit', (e) => { e.preventDefault(); page = 1; load(); });
$('table-wrap').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) showSessionDetail(Number(b.dataset.id)); });

window.ui.ready.then(load);
})();
