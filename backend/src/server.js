/**
 * Điểm khởi động backend:  npm run dev  (tự khởi động lại khi sửa code)
 *                          npm start    (chạy bình thường)
 */
const config = require('./config/env');
const { createApp } = require('./app');
const { getPool, closePool } = require('./config/db');

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`Backend đang chạy tại http://localhost:${config.port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Cổng ${config.port} đang được chương trình khác sử dụng. Đổi PORT trong .env hoặc tắt chương trình đó.`);
  } else {
    console.error('Không khởi động được server:', err);
  }
  process.exit(1);
});

// Thử kết nối DB ngay khi khởi động để báo lỗi sớm (server vẫn chạy nếu DB chưa sẵn sàng)
getPool()
  .then(() => console.log(`Đã kết nối SQL Server (database: ${config.db.database})`))
  .catch((err) => console.error('Chưa kết nối được SQL Server:', err.message,
    '\n→ Kiểm tra: SQL Server đang chạy? Đã bật TCP/IP? Thông tin trong .env đúng chưa?'));

async function shutdown() {
  console.log('Đang tắt server...');
  server.close();
  await closePool().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
