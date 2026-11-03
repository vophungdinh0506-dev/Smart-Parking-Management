/**
 * Dựng app Express để test API mà KHÔNG cần SQL Server thật:
 * thay các repository bằng bản giả lập lưu trong bộ nhớ.
 */
const path = require('node:path');

// Biến môi trường cho test (đặt trước khi nạp config)
Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_SERVER: 'test', DB_NAME: 'test', DB_USER: 'test', DB_PASSWORD: 'test',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
  LOGIN_MAX_ATTEMPTS_PER_MINUTE: '5',
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://127.0.0.1:1',
  // Ảnh trong test ghi vào thư mục tạm của hệ điều hành, không làm bẩn backend/uploads
  UPLOAD_DIR: require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'sp-test-')),
});

/** Thay module tại đường dẫn bằng đối tượng giả lập (phải gọi trước khi require app). */
function mockModule(relativePath, exportsObject) {
  const fullPath = require.resolve(path.join(__dirname, '..', '..', relativePath));
  require.cache[fullPath] = { id: fullPath, filename: fullPath, loaded: true, exports: exportsObject };
}

/** Khởi động server ở cổng ngẫu nhiên, trả về hàm gọi API giống fetch. */
async function startServer(createApp) {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, url, { body, cookie } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base + url, {
      method, headers, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* không phải JSON */ }
    return { status: res.status, json, setCookie: res.headers.getSetCookie() };
  }
  // closeAllConnections: đóng cả kết nối keep-alive để test kết thúc ngay
  return { base, call, close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }) };
}

module.exports = { mockModule, startServer };
