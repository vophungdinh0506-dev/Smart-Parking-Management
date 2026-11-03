/** Ghi nhật ký thao tác quan trọng vào bảng AuditLogs (phục vụ đối soát). */
const { sql, getPool } = require('../config/db');

/**
 * @param {object} entry
 * @param {number|null} entry.userId
 * @param {string} entry.action      ví dụ 'LOGIN_SUCCESS', 'CHECK_IN'
 * @param {string} [entry.entityType]
 * @param {number} [entry.entityId]
 * @param {object} [entry.detail]    sẽ lưu dạng JSON
 * @param {string} [entry.ipAddress]
 * @param {import('mssql').Transaction} [transaction] truyền vào khi cần ghi chung 1 transaction
 */
async function log(entry, transaction) {
  const request = transaction ? new sql.Request(transaction) : (await getPool()).request();
  await request
    .input('userId', sql.Int, entry.userId ?? null)
    .input('action', sql.VarChar(30), entry.action)
    .input('entityType', sql.VarChar(30), entry.entityType ?? null)
    .input('entityId', sql.BigInt, entry.entityId ?? null)
    .input('detail', sql.NVarChar(sql.MAX), entry.detail ? JSON.stringify(entry.detail) : null)
    .input('ipAddress', sql.VarChar(45), entry.ipAddress ? String(entry.ipAddress).slice(0, 45) : null)
    .query(`INSERT INTO dbo.AuditLogs (UserId, Action, EntityType, EntityId, Detail, IpAddress)
            VALUES (@userId, @action, @entityType, @entityId, @detail, @ipAddress)`);
}

/** Ghi log nhưng không làm hỏng thao tác chính nếu ghi log lỗi (dùng cho đăng nhập). */
async function logSafe(entry) {
  try {
    await log(entry);
  } catch (err) {
    console.error('[audit] Không ghi được nhật ký:', err.message);
  }
}

module.exports = { log, logSafe };
