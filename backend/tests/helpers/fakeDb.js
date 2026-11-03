/**
 * Database GIẢ LẬP trong bộ nhớ cho test API — mô phỏng các ràng buộc quan trọng của SQL Server:
 *  - UNIQUE biển số đang mở (lỗi 2601), UNIQUE Payments.SessionId (lỗi 2627)
 *  - UPDATE ... WHERE Status = 'OPEN' (chỉ đóng/hủy được lượt đang mở)
 * Dùng: const fake = installFakeDb(); trước khi require app.
 */
const bcrypt = require('bcryptjs');
const { mockModule } = require('./testApp');

const tick = () => new Promise((r) => setImmediate(r)); // khe hở để mô phỏng 2 request chạy song song
const clone = (o) => (o == null ? null : structuredClone(o));
const uniqueError = (n) => Object.assign(new Error('Violation of UNIQUE KEY'), { number: n });

function installFakeDb() {
  const db = {
    users: [
      { userId: 1, username: 'admin', passwordHash: bcrypt.hashSync('Admin@123', 4), fullName: 'Quản trị', role: 'ADMIN', isActive: true },
      { userId: 2, username: 'nv01', passwordHash: bcrypt.hashSync('Staff@123', 4), fullName: 'Nhân viên 1', role: 'STAFF', isActive: true },
    ],
    vehicleTypes: [{ vehicleTypeId: 1, code: 'MOTORBIKE', name: 'Xe máy' }, { vehicleTypeId: 2, code: 'CAR', name: 'Ô tô' }],
    pricing: [
      { pricingRuleId: 1, vehicleTypeId: 1, dayStartTime: '06:00', nightStartTime: '22:00', dayFee: 5000, nightFee: 30000, shortStayMinutes: 30, shortStayPercent: 50, isActive: true, createdAt: new Date() },
      { pricingRuleId: 2, vehicleTypeId: 2, dayStartTime: '06:00', nightStartTime: '22:00', dayFee: 30000, nightFee: 50000, shortStayMinutes: 30, shortStayPercent: 50, isActive: true, createdAt: new Date() },
    ],
    recognitions: [], sessions: [], payments: [], audits: [],
  };
  const vt = (id) => db.vehicleTypes.find((v) => v.vehicleTypeId === id);
  const userName = (id) => db.users.find((u) => u.userId === id)?.fullName ?? null;
  const view = (s) => s && {
    ...clone(s),
    vehicleType: clone(vt(s.vehicleTypeId)),
    checkInByName: userName(s.checkInBy),
    checkOutByName: userName(s.checkOutBy),
    cancelledByName: userName(s.cancelledBy),
  };

  mockModule('src/config/db.js', {
    sql: {},
    getPool: async () => ({ request: () => ({ query: async () => ({ recordset: [{ ok: 1 }] }) }) }),
    request: async () => { throw new Error('repo giả lập không dùng request()'); },
    withTransaction: async (work) => work({ fakeTx: true }),
    isUniqueViolation: (e) => e?.number === 2601 || e?.number === 2627,
  });
  mockModule('src/repositories/userRepo.js', {
    findByUsername: async (u) => clone(db.users.find((x) => x.username === u)),
    findById: async (id) => clone(db.users.find((x) => x.userId === id)),
    list: async () => clone(db.users),
    insert: async (u) => {
      if (db.users.some((x) => x.username === u.username)) throw uniqueError(2627);
      const row = { ...u, userId: db.users.length + 1, isActive: true, createdAt: new Date() };
      db.users.push(row);
      return row.userId;
    },
    update: async (id, patch) => { Object.assign(db.users.find((x) => x.userId === id), patch); },
    setPassword: async (id, hash) => { db.users.find((x) => x.userId === id).passwordHash = hash; },
    countActiveAdmins: async () => db.users.filter((u) => u.role === 'ADMIN' && u.isActive).length,
  });
  mockModule('src/repositories/auditRepo.js', {
    log: async (e) => { db.audits.push(e); }, logSafe: async (e) => { db.audits.push(e); },
  });
  mockModule('src/repositories/vehicleTypeRepo.js', {
    findAll: async () => clone(db.vehicleTypes),
    findById: async (id) => clone(vt(id)),
  });
  const ruleView = (p) => p && { ...clone(p), vehicleType: clone(vt(p.vehicleTypeId)), createdByName: userName(p.createdBy) };
  mockModule('src/repositories/pricingRepo.js', {
    findActiveByVehicleType: async (id) => ruleView(db.pricing.find((p) => p.vehicleTypeId === id && p.isActive)),
    findById: async (id) => ruleView(db.pricing.find((p) => p.pricingRuleId === id)),
    findAllActive: async () => db.pricing.filter((p) => p.isActive).map(ruleView),
    listHistory: async (id) => db.pricing.filter((p) => p.vehicleTypeId === id).reverse().map(ruleView),
    deactivateActive: async (id) => {
      const cur = db.pricing.find((p) => p.vehicleTypeId === id && p.isActive);
      if (cur) cur.isActive = false;
      return cur?.pricingRuleId ?? null;
    },
    insertActive: async (r) => {
      if (db.pricing.some((p) => p.vehicleTypeId === r.vehicleTypeId && p.isActive)) throw uniqueError(2601);
      const row = { ...clone(r), pricingRuleId: db.pricing.length + 1, isActive: true, createdAt: new Date() };
      db.pricing.push(row);
      return row.pricingRuleId;
    },
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
  mockModule('src/repositories/paymentRepo.js', {
    insert: async (p) => {
      await tick();
      if (db.payments.some((x) => x.sessionId === p.sessionId)) throw uniqueError(2627);
      const row = { ...p, paymentId: db.payments.length + 1 };
      db.payments.push(row);
      return row.paymentId;
    },
  });
  mockModule('src/repositories/sessionRepo.js', {
    findOpenByPlate: async (plate) => view(db.sessions.find((s) => s.plateNumber === plate && s.status === 'OPEN')),
    findOpenSimilar: async (plate) => {
      const suffix = (plate.match(/[0-9]{4}$/) || [])[0];
      return suffix ? db.sessions.filter((s) => s.status === 'OPEN' && s.plateNumber.endsWith(suffix)).map(view) : [];
    },
    insertOpen: async (s) => {
      await tick();
      if (db.sessions.some((x) => x.plateNumber === s.plateNumber && x.status === 'OPEN')) throw uniqueError(2601);
      const row = { ...s, sessionId: db.sessions.length + 1, status: 'OPEN', checkOutAt: null, feeAmount: null };
      db.sessions.push(row);
      return row.sessionId;
    },
    findById: async (id) => view(db.sessions.find((s) => s.sessionId === id)),
    close: async (c) => {
      const s = db.sessions.find((x) => x.sessionId === c.sessionId);
      if (!s || s.status !== 'OPEN') return false;
      Object.assign(s, { ...clone(c), status: 'CLOSED' });
      return true;
    },
    cancel: async (c) => {
      const s = db.sessions.find((x) => x.sessionId === c.sessionId);
      if (!s || s.status !== 'OPEN') return false;
      Object.assign(s, { status: 'CANCELLED', cancelledBy: c.cancelledBy, cancelReason: c.reason, cancelledAt: c.cancelledAt });
      return true;
    },
    updateOpen: async (u) => {
      const s = db.sessions.find((x) => x.sessionId === u.sessionId);
      if (!s || s.status !== 'OPEN') return false;
      if (db.sessions.some((x) => x !== s && x.status === 'OPEN' && x.plateNumber === u.plateNumber)) throw uniqueError(2601);
      Object.assign(s, { plateNumber: u.plateNumber, vehicleTypeId: u.vehicleTypeId, pricingRuleId: u.pricingRuleId, checkInPlateEdited: true });
      return true;
    },
    findImagePaths: async (id) => {
      const s = db.sessions.find((x) => x.sessionId === id);
      return s ? { in: s.checkInImagePath, out: s.checkOutImagePath ?? null } : null;
    },
    list: async ({ status, plate, from, to }) => {
      const items = db.sessions
        .filter((s) => (!status || s.status === status) && (!plate || s.plateNumber.includes(plate))
          && (!from || new Date(s.checkInAt) >= from) && (!to || new Date(s.checkInAt) < to))
        .map(view).reverse();
      return { total: items.length, items };
    },
  });
  mockModule('src/repositories/reportRepo.js', {
    revenue: async (from, to) => {
      const { vnDateKey } = require('../../src/utils/time');
      const groups = new Map();
      for (const p of db.payments.filter((x) => x.paidAt >= from && x.paidAt < to)) {
        const s = db.sessions.find((x) => x.sessionId === p.sessionId);
        const key = `${vnDateKey(p.paidAt)}|${s.vehicleTypeId}`;
        const g = groups.get(key) ?? { day: vnDateKey(p.paidAt), vehicleTypeId: s.vehicleTypeId, vehicleTypeName: vt(s.vehicleTypeId).name, amount: 0, count: 0 };
        g.amount += p.amount; g.count += 1;
        groups.set(key, g);
      }
      const cancelledCount = db.sessions.filter((s) => s.status === 'CANCELLED' && s.cancelledAt >= from && s.cancelledAt < to).length;
      return { rows: [...groups.values()], cancelledCount };
    },
  });
  return db;
}

module.exports = { installFakeDb };
