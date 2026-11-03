/**
 * Kết nối SQL Server bằng thư viện mssql.
 * Dùng 1 "connection pool" (nhóm kết nối dùng chung) cho cả ứng dụng,
 * thay vì mở/đóng kết nối mới cho mỗi request.
 */
const sql = require('mssql');
const config = require('./env');

let poolPromise = null;

function buildConfig() {
  const c = {
    server: config.db.server,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    connectionTimeout: 5000,
    requestTimeout: 15000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: config.db.encrypt,
      trustServerCertificate: config.db.trustServerCertificate,
      useUTC: true, // Date trong JS <-> DATETIME2 trong DB đều hiểu là giờ UTC
    },
  };
  // Có tên instance (ví dụ SQLEXPRESS) thì dùng instanceName, ngược lại dùng cổng
  if (config.db.instanceName) {
    c.options.instanceName = config.db.instanceName;
  } else {
    c.port = config.db.port;
  }
  return c;
}

/** Lấy pool; nếu lần trước kết nối lỗi thì lần sau sẽ thử kết nối lại. */
function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(buildConfig());
    pool.on('error', (err) => console.error('[db] Lỗi kết nối SQL Server:', err.message));
    poolPromise = pool.connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

async function closePool() {
  if (!poolPromise) return;
  const pool = await poolPromise.catch(() => null);
  poolPromise = null;
  if (pool) await pool.close();
}

/**
 * Tạo request: nằm trong transaction nếu có tx, ngược lại dùng pool.
 * @param {import('mssql').Transaction} [tx]
 */
async function request(tx) {
  return tx ? new sql.Request(tx) : (await getPool()).request();
}

/**
 * Chạy nhiều câu lệnh trong 1 TRANSACTION: hoặc lưu tất cả, hoặc không lưu gì.
 * Lỗi ở bất kỳ bước nào → ROLLBACK (hủy toàn bộ) rồi ném lỗi ra ngoài.
 *   await withTransaction(async (tx) => { ...repo.insert(..., tx) ... });
 */
async function withTransaction(work) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  try {
    const result = await work(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try { await tx.rollback(); } catch { /* transaction đã bị SQL Server tự hủy */ }
    throw err;
  }
}

/** Lỗi vi phạm UNIQUE (trùng khóa) của SQL Server: 2601 (unique index), 2627 (unique constraint). */
function isUniqueViolation(err) {
  return err?.number === 2601 || err?.number === 2627 || err?.originalError?.info?.number === 2601;
}

module.exports = { sql, getPool, closePool, request, withTransaction, isUniqueViolation };
