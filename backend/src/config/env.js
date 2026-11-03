/**
 * Đọc cấu hình từ file backend/.env (xem .env.example).
 * Mọi thông tin bí mật (mật khẩu DB, khóa JWT) chỉ nằm ở đây — không bao giờ đưa vào frontend.
 */
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Thiếu biến môi trường ${name}. Hãy copy backend/.env.example thành backend/.env và điền giá trị.`);
  }
  return value;
}

function integer(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`Biến ${name} phải là số nguyên, đang là "${raw}"`);
  return value;
}

function bool(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return ['true', '1', 'yes'].includes(raw.toLowerCase());
}

function secret(name) {
  const value = required(name);
  if (value.length < 32) {
    throw new Error(`${name} phải dài ít nhất 32 ký tự. Tạo chuỗi ngẫu nhiên bằng lệnh: npm run gen-secret`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';

const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: integer('PORT', 3000),
  auth: {
    jwtSecret: secret('JWT_SECRET'),
    sessionHours: integer('SESSION_HOURS', 8),          // 1 ca làm việc
    loginMaxAttemptsPerMinute: integer('LOGIN_MAX_ATTEMPTS_PER_MINUTE', 5),
  },
  db: {
    server: required('DB_SERVER'),
    port: integer('DB_PORT', 1433),
    instanceName: process.env.DB_INSTANCE || undefined,
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    encrypt: bool('DB_ENCRYPT', false),
    trustServerCertificate: bool('DB_TRUST_SERVER_CERTIFICATE', true),
  },
  ai: {
    url: (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, ''),
    timeoutMs: integer('AI_TIMEOUT_MS', 10000),
    // Độ tin cậy tối thiểu để coi là nhận diện tốt (0–1). Chỉnh lại sau khi đo trên bộ ảnh thật.
    confidenceThreshold: Number(process.env.AI_CONFIDENCE_THRESHOLD || 0.85),
  },
  upload: {
    maxBytes: integer('UPLOAD_MAX_MB', 5) * 1024 * 1024,
    // Ảnh tải lên quá số phút này thì không được dùng để xác nhận xe vào/ra (tránh dùng nhầm ảnh cũ)
    maxAgeMinutes: integer('RECOGNITION_MAX_AGE_MINUTES', 30),
  },
  uploadDir: path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads'),
};

module.exports = config;
