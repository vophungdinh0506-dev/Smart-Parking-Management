/**
 * Cấu hình ứng dụng Express: middleware bảo mật, API, phục vụ file frontend.
 * Tách riêng khỏi server.js để sau này viết test API mà không cần mở cổng thật.
 */
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const recognitionsRouter = require('./routes/recognitions');
const sessionsRouter = require('./routes/sessions');
const vehicleTypesRouter = require('./routes/vehicleTypes');
const imagesRouter = require('./routes/images');
const pricingRouter = require('./routes/pricing');
const usersRouter = require('./routes/users');
const reportsRouter = require('./routes/reports');
const { apiNotFound, errorHandler } = require('./middlewares/errorHandler');

const FRONTEND_DIR = path.resolve(__dirname, '..', '..', 'frontend');

function createApp() {
  const app = express();

  // Thêm các HTTP header bảo mật (chặn nhúng iframe, giới hạn nguồn script...)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'blob:'],   // blob: để xem trước ảnh trước khi tải lên
        'upgrade-insecure-requests': null,          // chạy local bằng http nên tắt
      },
    },
  }));

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // ---- API ----
  // API không cần đăng nhập: health, auth
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  // API nghiệp vụ — mỗi router tự gắn requireAuth
  app.use('/api/recognitions', recognitionsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/vehicle-types', vehicleTypesRouter);
  app.use('/api/images', imagesRouter);
  app.use('/api/pricing-rules', pricingRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/reports', reportsRouter); // chức năng mở rộng
  app.use('/api', apiNotFound); // mọi /api/... chưa khai báo → 404 JSON

  // ---- Frontend (HTML/CSS/JS tĩnh) ----
  app.use(express.static(FRONTEND_DIR, { extensions: ['html'] }));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
