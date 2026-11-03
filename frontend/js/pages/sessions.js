/**
 * Trang XE ĐANG GỬI — danh sách lượt OPEN.
 * ADMIN: sửa biển số/loại xe hoặc hủy lượt tạo nhầm (bắt buộc ghi lý do; backend kiểm tra quyền).
 */
(() => {
const { escapeHtml, showToast } = window.ui;
const { formDialog, showSessionDetail } = window.components;
const fmt = window.format;
const $ = (id) => document.getElementById(id);
const PAGE_SIZE = 20;

let user = null;
let page = 1;
let vehicleTypes = [];

async function load() {
  const plate = $('f-plate').value.trim();
  const qs = new URLSearchParams({ status: 'OPEN', page, pageSize: PAGE_SIZE });
  if (plate) qs.set('plate', plate);
  const result = await window.api.request(`/api/sessions?${qs}`);
  const wrap = $('table-wrap');
  if (!result.ok) { wrap.innerHTML = `<div class="alert alert--error">${escapeHtml(result.error.message)}</div>`; return; }
  const { items, total } = result.data;
  $('result-count').textContent = `${total} xe`;
  if (!items.length) {
    wrap.innerHTML = `<div class="empty">${plate ? 'Không có xe nào khớp biển số đã nhập.' : 'Chưa có xe nào trong bãi.'}</div>`;
    $('pager').innerHTML = '';
    return;
  }
  const isAdmin = user.role === 'ADMIN';
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Ảnh vào</th><th>Biển số</th><th>Loại xe</th><th>Giờ vào</th><th>Đã gửi</th><th>Nhân viên</th><th><span class="sr-only">Thao tác</span></th></tr></thead>
      <tbody>${items.map((s) => `
        <tr>
          <td><img class="thumb" src="${escapeHtml(s.checkInImageUrl)}" alt="" loading="lazy"></td>
          <td><span class="plate">${escapeHtml(s.plateDisplay)}</span>${s.checkInPlateEdited ? ' <span class="muted small">(sửa tay)</span>' : ''}</td>
          <td>${escapeHtml(s.vehicleType.name)}</td>
          <td>${escapeHtml(fmt.dateTime(s.checkInAt))}</td>
          <td>${escapeHtml(fmt.duration(s.checkInAt))}</td>
          <td>${escapeHtml(s.checkInByName ?? '')}</td>
          <td><div class="row-actions">
            <button class="btn btn--secondary btn--small" data-act="view" data-id="${s.sessionId}">Chi tiết</button>
            ${isAdmin ? `<button class="btn btn--secondary btn--small" data-act="edit" data-id="${s.sessionId}">Sửa</button>
              <button class="btn btn--secondary btn--small text-danger" data-act="cancel" data-id="${s.sessionId}">Hủy lượt</button>` : ''}
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  wrap.dataset.items = JSON.stringify(items.map((s) => ({ id: s.sessionId, plate: s.plateNumber, display: s.plateDisplay, vt: s.vehicleType.vehicleTypeId })));
  renderPager(total);
}

function renderPager(total) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  $('pager').innerHTML = pages <= 1 ? '' : `
    <button class="btn btn--secondary btn--small" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Trước</button>
    <span class="muted">Trang ${page}/${pages}</span>
    <button class="btn btn--secondary btn--small" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>Sau →</button>`;
}
$('pager').addEventListener('click', (e) => {
  const b = e.target.closest('[data-page]');
  if (b) { page = Number(b.dataset.page); load(); }
});
$('filter-form').addEventListener('submit', (e) => { e.preventDefault(); page = 1; load(); });

$('table-wrap').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const item = JSON.parse($('table-wrap').dataset.items).find((x) => x.id === id);

  if (btn.dataset.act === 'view') return showSessionDetail(id);

  if (btn.dataset.act === 'edit') {
    const data = await formDialog({
      title: `Sửa lượt gửi ${item.display}`,
      bodyHtml: `
        <div class="field"><label for="d-plate">Biển số đúng</label>
          <input id="d-plate" name="plateNumber" class="plate-input" value="${escapeHtml(item.plate)}" maxlength="20" required></div>
        <div class="field"><label for="d-vt">Loại xe</label>
          <select id="d-vt" name="vehicleTypeId">${vehicleTypes.map((v) => `<option value="${v.vehicleTypeId}" ${v.vehicleTypeId === item.vt ? 'selected' : ''}>${escapeHtml(v.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="d-reason">Lý do sửa <span class="required">*</span></label>
          <textarea id="d-reason" name="reason" minlength="3" maxlength="255" required placeholder="VD: Nhân viên gõ sai số cuối"></textarea></div>`,
      confirmText: 'Lưu thay đổi',
    });
    if (!data) return;
    const r = await window.api.request(`/api/sessions/${id}`, {
      method: 'PATCH', body: { plateNumber: data.plateNumber, vehicleTypeId: Number(data.vehicleTypeId), reason: data.reason },
    });
    if (!r.ok) return showToast(r.error.message, 'error', 6000);
    showToast(`Đã sửa lượt gửi thành ${r.data.session.plateDisplay} (${r.data.session.vehicleType.name})`, 'success');
    load();
  }

  if (btn.dataset.act === 'cancel') {
    const data = await formDialog({
      title: `Hủy lượt gửi ${item.display}?`,
      bodyHtml: `
        <p>Chỉ dùng khi lượt gửi được tạo nhầm (xe không thực sự vào bãi, tạo trùng...). Lượt bị hủy không thu phí và không thể khôi phục.</p>
        <div class="field"><label for="d-reason">Lý do hủy <span class="required">*</span></label>
          <textarea id="d-reason" name="reason" minlength="3" maxlength="255" required placeholder="VD: Tạo trùng do bấm nhầm"></textarea></div>`,
      confirmText: 'Hủy lượt gửi',
      cancelText: 'Quay lại',
      danger: true,
    });
    if (!data) return;
    const r = await window.api.request(`/api/sessions/${id}/cancel`, { method: 'POST', body: { reason: data.reason } });
    if (!r.ok) return showToast(r.error.message, 'error', 6000);
    showToast(`Đã hủy lượt gửi ${item.display}`, 'success');
    load();
  }
});

window.ui.ready.then(async (u) => {
  user = u;
  const vt = await window.api.request('/api/vehicle-types');
  vehicleTypes = vt.ok ? vt.data.items : [];
  load();
});
})();
