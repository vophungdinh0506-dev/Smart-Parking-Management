/** Trang Tổng quan — hiện tại chỉ hiển thị trạng thái từ GET /api/health. */
// Bọc trong (() => { ... })() để biến của file này không đụng tên với file khác.
(() => {
const { escapeHtml, setButtonLoading } = window.ui;

const SUMMARY = {
  ok:       ['badge--ok',    'Tất cả thành phần đang hoạt động'],
  degraded: ['badge--warn',  'Module nhận diện chưa sẵn sàng — nhân viên vẫn có thể nhập biển số thủ công'],
  down:     ['badge--error', 'Không kết nối được cơ sở dữ liệu — chưa thể xử lý xe vào/ra'],
};

function row(name, component, extraNote) {
  let badge;
  if (!component) badge = '<span class="badge badge--error">Không rõ</span>';
  else if (component.ok && component.modelReady === false) badge = '<span class="badge badge--warn">Chạy, chưa có mô hình</span>';
  else if (component.ok) badge = '<span class="badge badge--ok">Hoạt động</span>';
  else badge = '<span class="badge badge--error">Lỗi</span>';

  const notes = [];
  if (component?.message) notes.push(component.message);
  if (component?.latencyMs !== undefined) notes.push(`Phản hồi ${component.latencyMs} ms`);
  if (extraNote) notes.push(extraNote);

  return `<li><span class="status-list__name">${escapeHtml(name)}
            <span class="status-list__note">${escapeHtml(notes.join(' · '))}</span></span>${badge}</li>`;
}

async function loadHealth() {
  const button = document.getElementById('btn-refresh');
  setButtonLoading(button, true, 'Đang kiểm tra...');

  const result = await window.api.request('/api/health');
  setButtonLoading(button, false);

  const summary = document.getElementById('health-summary');
  const list = document.getElementById('health-list');

  // /api/health trả 503 khi DB lỗi nhưng vẫn có dữ liệu JSON → vẫn hiển thị được
  const data = result.data;
  if (!data?.components) {
    summary.innerHTML = `<div class="alert alert--error">${escapeHtml(result.error?.message ?? 'Không lấy được trạng thái')}</div>`;
    list.innerHTML = '';
    return;
  }

  const [badgeClass, text] = SUMMARY[data.status] ?? SUMMARY.down;
  summary.innerHTML = `<span class="badge ${badgeClass}">${escapeHtml(text)}</span>`;
  const ai = data.components.aiService;
  list.innerHTML = [
    row('Backend (Node.js)', data.components.backend),
    row('Cơ sở dữ liệu (SQL Server)', data.components.database),
    row('Module nhận diện biển số (Python)', ai, ai?.engine ? `Mô hình: ${ai.engine}` : ''),
  ].join('');
  document.getElementById('health-time').textContent =
    `Cập nhật lúc ${new Date(data.time).toLocaleTimeString('vi-VN')}`;
}

document.getElementById('btn-refresh').addEventListener('click', loadHealth);
window.ui.ready.then(loadHealth); // chỉ chạy khi đã đăng nhập
})();
