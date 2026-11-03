/** Truy cập bảng Users. Chỉ chứa câu SQL có tham số — không nối chuỗi. */
const { sql, request } = require('../config/db');

const COLUMNS = 'UserId, Username, PasswordHash, FullName, Role, IsActive, CreatedAt';

function toUser(row) {
  if (!row) return null;
  return {
    userId: row.UserId,
    username: row.Username,
    passwordHash: row.PasswordHash,
    fullName: row.FullName,
    role: row.Role,
    isActive: row.IsActive === true,
    createdAt: row.CreatedAt,
  };
}

async function findByUsername(username) {
  const req = await request();
  const result = await req
    .input('username', sql.VarChar(50), username)
    .query(`SELECT ${COLUMNS} FROM dbo.Users WHERE Username = @username`);
  return toUser(result.recordset[0]);
}

async function findById(userId, tx) {
  const req = await request(tx);
  const result = await req
    .input('userId', sql.Int, userId)
    .query(`SELECT ${COLUMNS} FROM dbo.Users WHERE UserId = @userId`);
  return toUser(result.recordset[0]);
}

async function list() {
  const req = await request();
  const result = await req.query(`SELECT ${COLUMNS} FROM dbo.Users ORDER BY UserId`);
  return result.recordset.map(toUser);
}

async function insert({ username, passwordHash, fullName, role }, tx) {
  const req = await request(tx);
  const result = await req
    .input('username', sql.VarChar(50), username)
    .input('hash', sql.VarChar(100), passwordHash)
    .input('fullName', sql.NVarChar(100), fullName)
    .input('role', sql.VarChar(10), role)
    .query(`INSERT INTO dbo.Users (Username, PasswordHash, FullName, Role)
            OUTPUT INSERTED.UserId VALUES (@username, @hash, @fullName, @role)`);
  return result.recordset[0].UserId;
}

async function update(userId, { fullName, role, isActive }, tx) {
  const req = await request(tx);
  await req
    .input('id', sql.Int, userId)
    .input('fullName', sql.NVarChar(100), fullName)
    .input('role', sql.VarChar(10), role)
    .input('active', sql.Bit, isActive)
    .query('UPDATE dbo.Users SET FullName = @fullName, Role = @role, IsActive = @active WHERE UserId = @id');
}

async function setPassword(userId, passwordHash, tx) {
  const req = await request(tx);
  await req
    .input('id', sql.Int, userId)
    .input('hash', sql.VarChar(100), passwordHash)
    .query('UPDATE dbo.Users SET PasswordHash = @hash WHERE UserId = @id');
}

/** Số ADMIN đang hoạt động — để không cho khóa/hạ quyền admin cuối cùng */
async function countActiveAdmins(tx) {
  const req = await request(tx);
  const result = await req.query("SELECT COUNT(*) AS N FROM dbo.Users WITH (UPDLOCK, HOLDLOCK) WHERE Role = 'ADMIN' AND IsActive = 1");
  return result.recordset[0].N;
}

module.exports = { findByUsername, findById, list, insert, update, setPassword, countActiveAdmins };
