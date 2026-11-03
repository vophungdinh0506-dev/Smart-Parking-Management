/**
 * Nhận 1 ảnh từ form (trường "image") và lưu vào thư mục uploads.
 *
 * Kiểm tra 2 lớp:
 *  1. Kiểu file khai báo (mimetype) và dung lượng — do multer kiểm tra.
 *  2. "Chữ ký file" (magic bytes): vài byte đầu của file thật. Đổi tên virus.exe thành
 *     anh.jpg vẫn bị phát hiện vì nội dung không bắt đầu bằng chữ ký của JPEG.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const { VN_OFFSET_MS } = require('../utils/time');

const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const multerSingleImage = multer({
  storage: multer.memoryStorage(), // giữ trong RAM để kiểm tra trước, hợp lệ mới ghi ra đĩa
  limits: { fileSize: config.upload.maxBytes, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      return cb(new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Chỉ nhận ảnh JPEG, PNG hoặc WebP'));
    }
    cb(null, true);
  },
}).single('image');

/** Middleware: sau khi chạy xong, req.file = { buffer, mimetype, size } đã được kiểm tra. */
function receiveImage(req, res, next) {
  multerSingleImage(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) return next(new AppError(400, 'IMAGE_REQUIRED', 'Vui lòng chọn ảnh xe'));
    const realType = detectImageType(req.file.buffer);
    if (!realType) {
      return next(new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'File không phải ảnh JPEG/PNG/WebP hợp lệ'));
    }
    req.file.mimetype = realType; // tin nội dung thật, không tin thông tin trình duyệt khai báo
    next();
  });
}

/** Thư mục theo ngày (giờ VN): 2026/10/27 */
function datedFolder(date = new Date()) {
  const d = new Date(date.getTime() + VN_OFFSET_MS);
  return path.posix.join(
    String(d.getUTCFullYear()),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  );
}

/**
 * Ghi buffer ảnh ra đĩa với tên ngẫu nhiên (UUID), không dùng tên file người dùng gửi.
 * @returns {Promise<string>} đường dẫn TƯƠNG ĐỐI so với thư mục uploads, dạng "2026/10/27/uuid.jpg"
 */
async function saveImage(buffer, mimetype, suffix = '') {
  const ext = ALLOWED[mimetype] || 'jpg';
  const relative = path.posix.join(datedFolder(), `${crypto.randomUUID()}${suffix}.${ext}`);
  const absolute = path.join(config.uploadDir, ...relative.split('/'));
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer, { flag: 'wx' });
  return relative;
}

module.exports = { receiveImage, saveImage, detectImageType };
