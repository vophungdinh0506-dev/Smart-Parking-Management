/**
 * Đặt lại mật khẩu cho 1 tài khoản (khi quên mật khẩu).
 * Chạy:  npm run reset-password
 * Mật khẩu KHÔNG thể xem lại vì database chỉ lưu chuỗi băm bcrypt (một chiều) → chỉ có thể đặt mật khẩu mới.
 * Lệnh này chạy trên máy chủ (cần file .env kết nối database), nên chỉ người quản trị máy mới dùng được.
 */
const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const { sql, getPool, closePool } = require('../src/config/db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// Hỏi mật khẩu mà không hiện ký tự ra màn hình
function askHidden(question) {
  return new Promise((resolve) => {
    const original = rl._writeToOutput;
    rl._writeToOutput = (s) => { if (s.includes(question)) original.call(rl, s); };
    rl.question(question, (answer) => {
      rl._writeToOutput = original;
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const pool = await getPool();

  const users = await pool.request().query('SELECT Username, FullName, Role, IsActive FROM dbo.Users ORDER BY UserId');
  console.log('Các tài khoản hiện có:');
  for (const u of users.recordset) {
    console.log(`  - ${u.Username} (${u.FullName}, ${u.Role}${u.IsActive ? '' : ', ĐANG KHÓA'})`);
  }

  const username = (await ask('Tên đăng nhập cần đặt lại mật khẩu: ')).trim();
  const found = users.recordset.find((u) => u.Username === username);
  if (!found) throw new Error(`Không có tài khoản "${username}"`);

  const password = await askHidden('Mật khẩu mới (ít nhất 8 ký tự): ');
  if (password.length < 8) throw new Error('Mật khẩu phải có ít nhất 8 ký tự');
  const confirm = await askHidden('Nhập lại mật khẩu mới: ');
  if (password !== confirm) throw new Error('Hai lần nhập mật khẩu không khớp');

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.request()
    .input('username', sql.VarChar(50), username)
    .input('hash', sql.VarChar(100), passwordHash)
    .query('UPDATE dbo.Users SET PasswordHash = @hash WHERE Username = @username');

  await pool.request()
    .input('username', sql.VarChar(50), username)
    .query(`INSERT INTO dbo.AuditLogs (UserId, Action, EntityType, EntityId, Detail)
            SELECT UserId, 'PASSWORD_RESET', 'USER', UserId, N'{"by":"script"}' FROM dbo.Users WHERE Username = @username`);

  console.log(`Đã đặt lại mật khẩu cho "${username}". Hãy đăng nhập bằng mật khẩu mới.`);
}

main()
  .catch((err) => { console.error('Lỗi:', err.message); process.exitCode = 1; })
  .finally(async () => { rl.close(); await closePool().catch(() => {}); });
