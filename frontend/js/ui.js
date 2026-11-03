/**
 * Tiện ích giao diện dùng chung cho mọi trang:
 * chống chèn mã HTML, thông báo nổi, nút "đang xử lý", menu, kiểm tra đăng nhập.
 */
// Bọc trong (() => { ... })() để biến của file này không đụng tên với file khác.
(() => {

/** Luôn dùng hàm này khi chèn dữ liệu (biển số, tên...) vào HTML để tránh tấn công XSS. */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function showToast(message, type = 'info', timeoutMs = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), timeoutMs);
}

/** Đặt nút vào trạng thái "đang xử lý" — chống bấm 2 lần. */
function setButtonLoading(button, loading, loadingText = 'Đang xử lý...') {
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${escapeHtml(loadingText)}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  }
}

const ROLE_LABEL = { ADMIN: 'Quản trị viên', STAFF: 'Nhân viên' };

/**
 * Danh sách trang trong menu.
 * ready = false: trang chưa làm (hiện mờ, nhãn "Sắp có") — làm xong trang nào thì đổi thành true.
 * roles: quyền được thấy trang. Đây chỉ là ẩn menu cho gọn; backend mới là nơi chặn quyền thật.
 */
const NAV_ITEMS = [
  { href: '/index.html',     label: 'Tổng quan',      ready: true,  roles: ['ADMIN', 'STAFF'] },
  { href: '/check-in.html',  label: 'Xe vào bãi',     ready: true,  roles: ['ADMIN', 'STAFF'] },
  { href: '/check-out.html', label: 'Xe ra bãi',      ready: false, roles: ['ADMIN', 'STAFF'] },
  { href: '/sessions.html',  label: 'Xe đang gửi',    ready: false, roles: ['ADMIN', 'STAFF'] },
  { href: '/history.html',   label: 'Lịch sử gửi xe', ready: false, roles: ['ADMIN', 'STAFF'] },
  { href: '/pricing.html',   label: 'Bảng giá',       ready: false, roles: ['ADMIN', 'STAFF'] },
  { href: '/reports.html',   label: 'Doanh thu',      ready: false, roles: ['ADMIN'] },
  { href: '/users.html',     label: 'Tài khoản',      ready: false, roles: ['ADMIN'] },
];
// Trang Đăng nhập (/login.html) không nằm trong menu.

function renderSidebar(user) {
  const aside = document.getElementById('sidebar');
  if (!aside) return;
  const current = location.pathname === '/' ? '/index.html' : location.pathname;
  const links = NAV_ITEMS
    .filter((item) => item.roles.includes(user.role))
    .map((item) => {
      const active = item.href === current ? ' is-active' : '';
      if (!item.ready) {
        return `<li><span class="sidebar__link is-disabled" aria-disabled="true">${escapeHtml(item.label)}
                <span class="sidebar__soon">Sắp có</span></span></li>`;
      }
      return `<li><a class="sidebar__link${active}" href="${item.href}"${active ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a></li>`;
    }).join('');

  aside.innerHTML = `
    <div class="sidebar__brand">Smart Parking</div>
    <nav aria-label="Menu chính"><ul class="sidebar__nav">${links}</ul></nav>
    <div class="sidebar__user">
      <div class="sidebar__user-name">${escapeHtml(user.fullName)}</div>
      <div class="sidebar__user-role">${escapeHtml(ROLE_LABEL[user.role] ?? user.role)} · ${escapeHtml(user.username)}</div>
      <button type="button" class="sidebar__logout" id="btn-logout">Đăng xuất</button>
    </div>`;

  document.getElementById('btn-logout').addEventListener('click', logout);
}

/** Chuyển về trang đăng nhập, nhớ trang hiện tại để quay lại sau khi đăng nhập. */
function goToLogin() {
  const next = location.pathname + location.search;
  location.replace(`/login.html?next=${encodeURIComponent(next)}`);
}

async function logout() {
  await window.api.request('/api/auth/logout', { method: 'POST' });
  location.replace('/login.html');
}

/**
 * Trang cần đăng nhập: hỏi backend "tôi là ai?".
 * Chưa đăng nhập → về trang đăng nhập. Đã đăng nhập → vẽ menu, hiện trang.
 * Các trang dùng: window.ui.ready.then((user) => { ... })
 */
async function requireLogin() {
  const result = await window.api.request('/api/auth/me');
  if (!result.ok) {
    if (result.status === 401) {
      goToLogin();
    } else {
      document.documentElement.classList.remove('auth-pending');
      document.body.innerHTML = `<div class="alert alert--error" style="margin:24px">${escapeHtml(result.error.message)}</div>`;
    }
    return new Promise(() => {}); // không bao giờ xong → code của trang không chạy tiếp
  }
  const { user } = result.data;
  renderSidebar(user);
  document.documentElement.classList.remove('auth-pending');
  return user;
}

window.ui = { escapeHtml, showToast, setButtonLoading, goToLogin };
// Trang đăng nhập đặt <body data-auth="none"> để không bị kiểm tra
window.ui.ready = document.body.dataset.auth === 'none' ? Promise.resolve(null) : requireLogin();
})();
