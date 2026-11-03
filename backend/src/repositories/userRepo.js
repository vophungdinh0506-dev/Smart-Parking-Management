/** Truy cập bảng Users. Chỉ chứa câu SQL có tham số — không nối chuỗi. */
const { sql, getPool } = require('../config/db');

const COLUMNS = 'UserId, Username, PasswordHash, FullName, Role, IsActive';

function toUser(row) {
  if (!row) return null;
  return {
    userId: row.UserId,
    username: row.Username,
    passwordHash: row.PasswordHash,
    fullName: row.FullName,
    role: row.Role,
    isActive: row.IsActive === true,
  };
}

async function findByUsername(username) {
  const pool = await getPool();
  const result = await pool.request()
    .input('username', sql.VarChar(50), username)
    .query(`SELECT ${COLUMNS} FROM dbo.Users WHERE Username = @username`);
  return toUser(result.recordset[0]);
}

async function findById(userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`SELECT ${COLUMNS} FROM dbo.Users WHERE UserId = @userId`);
  return toUser(result.recordset[0]);
}

module.exports = { findByUsername, findById };
