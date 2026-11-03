/** Trang TÀI KHOẢN (chỉ ADMIN): thêm, đổi quyền, khóa/mở khóa, đặt lại mật khẩu. Không xóa để giữ lịch sử. */
(() => {
const { escapeHtml, showToast } = window.ui;
const { formDialog, confirmDialog } = window.components;
const fmt = window.format;
const $ = (id) => document.getElementById(id);
const ROLE = { ADMIN: 'Quản trị viên', STAFF: 'Nhân viên' };
let me = null;
let users = [];

async function load() {
  const result = await window.api.request('/api/users');
  const wrap = $('table-wrap');
  if (!result.ok) {
    wrap.innerHTML = `<div class="alert alert--error">${escapeHtml(result.status === 403 ? 'Chỉ quản trị viên được quản lý tài khoản.' : result.error.message)}</div>`;
    $('btn-create').hidden = true;
    return;
  }
  users = result.data.items;
  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Quyền</th><th>Trạng thái</th><th>Ngày tạo</th><th><span class="sr-only">Thao tác</span></th></tr></thead>
      <tbody>${users.map((u) => `
        <tr>
          <td><strong>${escapeHtml(u.username)}</strong>${u.userId === me.userId ? ' <span class="muted small">(bạn)</span>' : ''}</td>
          <td>${escapeHtml(u.fullName)}</td>
          <td>${escapeHtml(ROLE[u.role])}</td>
          <td>${u.isActive ? '<span class="badge badge--ok">Hoạt động</span>' : '<span class="badge badge--error">Đã khóa</span>'}</td>
          <td>${escapeHtml(fmt.dateTime(u.createdAt))}</td>
          <td><div class="row-actions">
            <button class="btn btn--secondary btn--small" data-act="edit" data-id="${u.userId}">Sửa</button>
            <button class="btn btn--secondary btn--small" data-act="password" data-id="${u.userId}">Đặt lại mật khẩu</button>
            ${u.userId === me.userId ? '' : `<button class="btn btn--secondary btn--small ${u.isActive ? 'text-danger' : ''}" data-act="toggle" data-id="${u.userId}">${u.isActive ? 'Khóa' : 'Mở khóa'}</button>`}
          </div></td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}

const roleSelect = (selected, disabled) => `
  <select id="d-role" name="role" ${disabled ? 'disabled' : ''}>
    <option value="STAFF" ${selected === 'STAFF' ? 'selected' : ''}>Nhân viên</option>
    <option value="ADMIN" ${selected === 'ADMIN' ? 'selected' : ''}>Quản trị viên</option>
  </select>`;

$('btn-create').addEventListener('click', async () => {
  const data = await formDialog({
    title: 'Thêm tài khoản',
    bodyHtml: `
      <div class="field"><label for="d-username">Tên đăng nhập</label>
        <input id="d-username" name="username" required minlength="3" maxlength="50" pattern="[A-Za-z0-9._\\-]+" autocomplete="off"
               title="Chữ không dấu, số và . _ -"></div>
      <div class="field"><label for="d-name">Họ tên</label><input id="d-name" name="fullName" required maxlength="100"></div>
      <div class="field"><label for="d-role">Quyền</label>${roleSelect('STAFF')}</div>
      <div class="field"><label for="d-pass">Mật khẩu ban đầu</label>
        <input id="d-pass" name="password" type="password" required minlength="8" maxlength="200" autocomplete="new-password">
        <span class="field__hint">Ít nhất 8 ký tự. Đưa cho nhân viên trực tiếp, không gửi qua tin nhắn công khai.</span></div>`,
    confirmText: 'Tạo tài khoản',
  });
  if (!data) return;
  const r = await window.api.request('/api/users', { method: 'POST', body: data });
  if (!r.ok) return showToast(r.error.message, 'error', 6000);
  showToast(`Đã tạo tài khoản ${r.data.user.username}`, 'success');
  load();
});

$('table-wrap').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const u = users.find((x) => x.userId === Number(btn.dataset.id));
  const isMe = u.userId === me.userId;

  if (btn.dataset.act === 'edit') {
    const data = await formDialog({
      title: `Sửa tài khoản ${u.username}`,
      bodyHtml: `
        <div class="field"><label for="d-name">Họ tên</label><input id="d-name" name="fullName" required maxlength="100" value="${escapeHtml(u.fullName)}"></div>
        <div class="field"><label for="d-role">Quyền</label>${roleSelect(u.role, isMe)}
          ${isMe ? '<span class="field__hint">Không thể tự đổi quyền của chính mình.</span>' : ''}</div>`,
    });
    if (!data) return;
    const body = { fullName: data.fullName };
    if (!isMe) body.role = data.role;
    const r = await window.api.request(`/api/users/${u.userId}`, { method: 'PATCH', body });
    if (!r.ok) return showToast(r.error.message, 'error', 6000);
    showToast('Đã cập nhật tài khoản', 'success');
    load();
  }

  if (btn.dataset.act === 'password') {
    const data = await formDialog({
      title: `Đặt lại mật khẩu cho ${u.username}`,
      bodyHtml: `<div class="field"><label for="d-pass">Mật khẩu mới</label>
        <input id="d-pass" name="password" type="password" required minlength="8" maxlength="200" autocomplete="new-password"></div>`,
      confirmText: 'Đặt lại',
    });
    if (!data) return;
    const r = await window.api.request(`/api/users/${u.userId}/reset-password`, { method: 'POST', body: data });
    if (!r.ok) return showToast(r.error.message, 'error', 6000);
    showToast(`Đã đặt lại mật khẩu cho ${u.username}`, 'success');
  }

  if (btn.dataset.act === 'toggle') {
    const locking = u.isActive;
    const ok = await confirmDialog({
      title: `${locking ? 'Khóa' : 'Mở khóa'} tài khoản ${u.username}?`,
      bodyHtml: locking
        ? '<p>Tài khoản sẽ bị đăng xuất ngay và không đăng nhập được nữa. Lịch sử thao tác vẫn được giữ.</p>'
        : '<p>Tài khoản sẽ đăng nhập lại được.</p>',
      confirmText: locking ? 'Khóa tài khoản' : 'Mở khóa',
      danger: locking,
    });
    if (!ok) return;
    const r = await window.api.request(`/api/users/${u.userId}`, { method: 'PATCH', body: { isActive: !locking } });
    if (!r.ok) return showToast(r.error.message, 'error', 6000);
    showToast(`Đã ${locking ? 'khóa' : 'mở khóa'} tài khoản ${u.username}`, 'success');
    load();
  }
});

window.ui.ready.then((u) => { me = u; load(); });
})();
