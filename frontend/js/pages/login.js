/** Trang Đăng nhập. */
(() => {
const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const button = document.getElementById('btn-login');

/** Trang sẽ quay về sau khi đăng nhập. Chỉ chấp nhận đường dẫn nội bộ (chống chuyển hướng sang web lạ). */
function nextPage() {
  const next = new URLSearchParams(location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login.html')) return next;
  return '/index.html';
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

// Đã đăng nhập rồi thì vào thẳng trang chính
window.api.request('/api/auth/me').then((r) => { if (r.ok) location.replace(nextPage()); });

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;

  const username = form.username.value.trim();
  const password = form.password.value;
  if (!username || !password) {
    showError('Vui lòng nhập tên đăng nhập và mật khẩu');
    (username ? form.password : form.username).focus();
    return;
  }

  window.ui.setButtonLoading(button, true, 'Đang đăng nhập...');
  const result = await window.api.request('/api/auth/login', { method: 'POST', body: { username, password } });
  if (result.ok) {
    location.replace(nextPage());
    return;
  }
  window.ui.setButtonLoading(button, false);
  showError(result.error.message);
  form.password.value = '';
  form.password.focus();
});
})();
