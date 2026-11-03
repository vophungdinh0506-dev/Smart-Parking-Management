/**
 * Kiểm thử luồng XE VÀO BÃI với database giả lập và AI service giả lập.
 * Chạy: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const bcrypt = require('bcryptjs');

// ---------- AI service giả lập: trả kết quả theo biến aiReply ----------
let aiReply = { status: 200, body: { plates: [] } };
const aiServer = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    res.writeHead(aiReply.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(aiReply.body));
  });
});

// ---------- Database giả lập ----------
const db = { recognitions: [], sessions: [], audits: [] };
const users = [{ userId: 1, username: 'nv01', passwordHash: bcrypt.hashSync('Staff@123', 4), fullName: 'Nhân viên 1', role: 'STAFF', isActive: true }];
const vehicleTypes = [{ vehicleTypeId: 1, code: 'MOTORBIKE', name: 'Xe máy' }, { vehicleTypeId: 2, code: 'CAR', name: 'Ô tô' }];
const clone = (o) => (o ? structuredClone(o) : null);
const sessionView = (s) => s && {
  ...clone(s), vehicleType: clone(vehicleTypes.find((v) => v.vehicleTypeId === s.vehicleTypeId)), checkInByName: 'Nhân viên 1',
};

let helpers;
let api;
let cookie;
test.before(async () => {
  await new Promise((r) => aiServer.listen(0, '127.0.0.1', r));
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${aiServer.address().port}`;
  helpers = require('./helpers/testApp');
  const { mockModule } = helpers;

  mockModule('src/config/db.js', {
    sql: {}, getPool: async () => { throw new Error('không dùng DB thật trong test'); },
    withTransaction: async (work) => work({ fakeTx: true }),
    isUniqueViolation: (e) => e?.number === 2601,
  });
  mockModule('src/repositories/userRepo.js', {
    findByUsername: async (u) => clone(users.find((x) => x.username === u)),
    findById: async (id) => clone(users.find((x) => x.userId === id)),
  });
  mockModule('src/repositories/auditRepo.js', {
    log: async (e) => { db.audits.push(e); }, logSafe: async (e) => { db.audits.push(e); },
  });
  mockModule('src/repositories/vehicleTypeRepo.js', {
    findAll: async () => clone(vehicleTypes),
    findById: async (id) => clone(vehicleTypes.find((v) => v.vehicleTypeId === id)),
  });
  mockModule('src/repositories/pricingRepo.js', {
    findActiveByVehicleType: async (vt) => ({ pricingRuleId: vt, vehicleTypeId: vt }),
  });
  mockModule('src/repositories/recognitionRepo.js', {
    insert: async (rec) => {
      const row = { ...rec, recognitionId: db.recognitions.length + 1, createdAt: new Date(), sessionId: null, confirmedPlate: null };
      db.recognitions.push(row);
      return { recognitionId: row.recognitionId, createdAt: row.createdAt };
    },
    findById: async (id) => clone(db.recognitions.find((r) => r.recognitionId === id)),
    markUsed: async (id, sessionId, plate) => {
      const r = db.recognitions.find((x) => x.recognitionId === id);
      if (!r || r.sessionId !== null) return false;
      Object.assign(r, { sessionId, confirmedPlate: plate });
      return true;
    },
  });
  mockModule('src/repositories/sessionRepo.js', {
    findOpenByPlate: async (plate) => sessionView(db.sessions.find((s) => s.plateNumber === plate && s.status === 'OPEN')),
    insertOpen: async (s) => {
      await new Promise((r) => setImmediate(r)); // tạo khe hở để mô phỏng 2 request chạy song song
      if (db.sessions.some((x) => x.plateNumber === s.plateNumber && x.status === 'OPEN')) {
        throw Object.assign(new Error('Cannot insert duplicate key row'), { number: 2601 }); // giống UNIQUE index thật
      }
      const row = { ...s, sessionId: db.sessions.length + 1, status: 'OPEN' };
      db.sessions.push(row);
      return row.sessionId;
    },
    findById: async (id) => sessionView(db.sessions.find((s) => s.sessionId === id)),
    findImagePaths: async (id) => {
      const s = db.sessions.find((x) => x.sessionId === id);
      return s ? { in: s.checkInImagePath, out: null } : null;
    },
    list: async ({ status }) => {
      const items = db.sessions.filter((s) => !status || s.status === status).map(sessionView);
      return { total: items.length, items };
    },
  });

  const { createApp } = require('../src/app');
  api = await helpers.startServer(createApp);
  const login = await api.call('POST', '/api/auth/login', { body: { username: 'nv01', password: 'Staff@123' } });
  cookie = login.setCookie.find((c) => c.startsWith('sp_session=')).split(';')[0];
});
test.after(async () => { await api?.close(); aiServer.closeAllConnections(); aiServer.close(); });

// Ảnh JPEG giả: chỉ cần đúng "chữ ký" 3 byte đầu FF D8 FF
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const CROP_B64 = JPEG.toString('base64');


async function upload({ bytes = JPEG, type = 'image/jpeg', direction = 'IN', withCookie = true } = {}) {
  const form = new FormData();
  form.append('direction', direction);
  form.append('image', new Blob([bytes], { type }), 'xe.jpg');
  const res = await fetch(`${api.base}/api/recognitions`, {
    method: 'POST', body: form, headers: withCookie ? { Cookie: cookie } : {},
  });
  return { status: res.status, json: await res.json() };
}
const checkIn = (body) => api.call('POST', '/api/sessions/check-in', { body, cookie });

// ======================= TẢI ẢNH + NHẬN DIỆN =======================
test('Chưa đăng nhập → không tải ảnh được (401)', async () => {
  assert.equal((await upload({ withCookie: false })).status, 401);
});

test('File không phải ảnh (đổi đuôi .jpg) → 415', async () => {
  const r = await upload({ bytes: Buffer.from('MZ day la file exe gia mao'), type: 'image/jpeg' });
  assert.equal(r.status, 415);
});

test('AI đọc tốt → SUCCESS, biển số được chuẩn hóa, có ảnh cắt', async () => {
  aiReply = { status: 200, body: { engine: 'fake', processing_ms: 12,
    plates: [{ text: '51f-123.45', confidence: 0.97, crop_jpeg_base64: CROP_B64 }] } };
  const r = await upload();
  assert.equal(r.status, 201);
  assert.equal(r.json.status, 'SUCCESS');
  assert.equal(r.json.plate, '51F12345');
  assert.ok(r.json.cropUrl);

  const img = await fetch(api.base + r.json.imageUrl, { headers: { Cookie: cookie } });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.equal((await fetch(api.base + r.json.imageUrl)).status, 401, 'xem ảnh phải đăng nhập');
  assert.equal((await fetch(api.base + r.json.cropUrl, { headers: { Cookie: cookie } })).status, 200);
});

test('Các trường hợp AI: độ tin cậy thấp / không thấy biển / nhiều biển / AI lỗi', async () => {
  aiReply = { status: 200, body: { plates: [{ text: '51F12345', confidence: 0.4 }] } };
  assert.equal((await upload()).json.status, 'LOW_CONFIDENCE');

  aiReply = { status: 200, body: { plates: [{ text: '51F1', confidence: 0.99 }] } }; // thiếu ký tự
  assert.equal((await upload()).json.status, 'LOW_CONFIDENCE');

  aiReply = { status: 200, body: { plates: [] } };
  const notFound = await upload();
  assert.equal(notFound.json.status, 'NOT_FOUND');
  assert.equal(notFound.json.plate, null);

  aiReply = { status: 200, body: { plates: [{ text: '30A11111', confidence: 0.6 }, { text: '51F12345', confidence: 0.9 }] } };
  const multi = await upload();
  assert.equal(multi.json.status, 'MULTIPLE');
  assert.deepEqual(multi.json.candidates.map((c) => c.plate), ['51F12345', '30A11111']);

  aiReply = { status: 503, body: { detail: 'Chưa tích hợp mô hình' } };
  const err = await upload();
  assert.equal(err.status, 201, 'AI lỗi vẫn trả recognitionId để nhân viên nhập tay');
  assert.equal(err.json.status, 'ERROR');
  assert.equal(err.json.plate, null, 'không bao giờ bịa biển số');
  assert.match(db.recognitions.at(-1).errorMessage, /503/);
});

// ======================= TẠO LƯỢT GỬI =======================
test('Xác nhận xe vào (nhân viên sửa biển số) → 201, ghi nhật ký, đánh dấu "sửa tay"', async () => {
  aiReply = { status: 200, body: { plates: [{ text: '59X112346', confidence: 0.9 }] } };
  const rec = await upload();
  const r = await checkIn({ recognitionId: rec.json.recognitionId, plateNumber: '59-x1 123.45', vehicleTypeId: 1 });
  assert.equal(r.status, 201);
  assert.equal(r.json.session.plateNumber, '59X112345');
  assert.equal(r.json.session.plateDisplay, '59-X1 123.45');
  assert.equal(r.json.session.status, 'OPEN');
  assert.equal(r.json.session.checkInPlateEdited, true);
  assert.ok(db.audits.some((a) => a.action === 'CHECK_IN' && a.entityId === r.json.session.sessionId));

  // Dùng lại đúng ảnh đó → bị chặn
  const again = await checkIn({ recognitionId: rec.json.recognitionId, plateNumber: '59X112345', vehicleTypeId: 1 });
  assert.equal(again.status, 409);
  assert.equal(again.json.error.code, 'RECOGNITION_ALREADY_USED');
});

test('Biển số đang ở trong bãi → 409, không tạo lượt thứ 2', async () => {
  const rec = await upload();
  const before = db.sessions.length;
  const r = await checkIn({ recognitionId: rec.json.recognitionId, plateNumber: '59X1-12345', vehicleTypeId: 1 });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, 'PLATE_ALREADY_INSIDE');
  assert.equal(db.sessions.length, before);
});

test('2 nhân viên xác nhận CÙNG LÚC cùng 1 biển số → chỉ 1 lượt được tạo', async () => {
  const a = await upload();
  const b = await upload();
  const [ra, rb] = await Promise.all([
    checkIn({ recognitionId: a.json.recognitionId, plateNumber: '51G99999', vehicleTypeId: 2 }),
    checkIn({ recognitionId: b.json.recognitionId, plateNumber: '51G99999', vehicleTypeId: 2 }),
  ]);
  assert.deepEqual([ra.status, rb.status].sort(), [201, 409]);
  assert.equal(db.sessions.filter((s) => s.plateNumber === '51G99999').length, 1);
});

test('Biển số sai định dạng theo loại xe → 400 INVALID_PLATE', async () => {
  const rec = await upload();
  const r = await checkIn({ recognitionId: rec.json.recognitionId, plateNumber: '59X112345', vehicleTypeId: 2 }); // biển xe máy chọn Ô tô
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'INVALID_PLATE');
});

test('Dữ liệu thiếu / sai kiểu → 400', async () => {
  assert.equal((await checkIn({ plateNumber: '51F12345', vehicleTypeId: 2 })).status, 400);
  assert.equal((await checkIn({ recognitionId: 'abc', plateNumber: '51F12345', vehicleTypeId: 2 })).status, 400);
  assert.equal((await checkIn({ recognitionId: 1, plateNumber: '', vehicleTypeId: 2 })).status, 400);
  assert.equal((await checkIn({ recognitionId: 1, plateNumber: '51F12345', vehicleTypeId: 9 })).status, 400);
});

test('Ảnh của xe RA không dùng cho xe VÀO; ảnh quá 30 phút bị từ chối; mã ảnh không tồn tại → 404', async () => {
  const out = await upload({ direction: 'OUT' });
  assert.equal((await checkIn({ recognitionId: out.json.recognitionId, plateNumber: '51F11111', vehicleTypeId: 2 })).json.error.code, 'WRONG_DIRECTION');

  const old = await upload();
  db.recognitions.find((r) => r.recognitionId === old.json.recognitionId).createdAt = new Date(Date.now() - 31 * 60000);
  assert.equal((await checkIn({ recognitionId: old.json.recognitionId, plateNumber: '51F11111', vehicleTypeId: 2 })).json.error.code, 'RECOGNITION_EXPIRED');

  assert.equal((await checkIn({ recognitionId: 999999, plateNumber: '51F11111', vehicleTypeId: 2 })).status, 404);
});

test('Danh sách xe trong bãi', async () => {
  const r = await api.call('GET', '/api/sessions?status=OPEN', { cookie });
  assert.equal(r.status, 200);
  assert.ok(r.json.total >= 2);
  assert.ok(r.json.items.every((s) => s.status === 'OPEN' && s.plateDisplay && s.checkInImageUrl));
  assert.equal((await api.call('GET', '/api/sessions?status=XYZ', { cookie })).status, 400);
});

test('Đường dẫn ảnh lạ (thử đọc file hệ thống) → 404', async () => {
  for (const url of ['/api/images/recognitions/..%2F..%2Fetc/original', '/api/images/recognitions/1/passwd', '/api/images/sessions/-1/in']) {
    assert.equal((await fetch(api.base + url, { headers: { Cookie: cookie } })).status, 404, url);
  }
});
