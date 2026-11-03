/**
 * Hàm gọi API dùng chung cho mọi trang.
 * - Luôn gọi cùng địa chỉ với trang web (không cần CORS).
 * - Trình duyệt tự gửi kèm cookie đăng nhập (credentials: 'same-origin').
 * - Trả về { ok, status, data, error } thay vì ném lỗi, để trang dễ hiển thị thông báo.
 * - Phiên đăng nhập hết hạn giữa chừng (401) → tự chuyển về trang đăng nhập.
 */
async function apiRequest(path, { method = 'GET', body, formData } = {}) {
  const options = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (formData) {
    options.body = formData;              // trình duyệt tự đặt Content-Type multipart
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, options);
  } catch {
    return { ok: false, status: 0, data: null,
      error: { code: 'NETWORK_ERROR', message: 'Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa.' } };
  }

  let data = null;
  try { data = await response.json(); } catch { /* phản hồi rỗng hoặc không phải JSON */ }

  if (response.status === 401 && !path.startsWith('/api/auth/') && window.ui?.goToLogin) {
    window.ui.goToLogin();
  }

  if (!response.ok) {
    return { ok: false, status: response.status, data,
      error: data?.error ?? { code: 'HTTP_' + response.status, message: 'Yêu cầu thất bại (' + response.status + ')' } };
  }
  return { ok: true, status: response.status, data, error: null };
}

window.api = { request: apiRequest };
