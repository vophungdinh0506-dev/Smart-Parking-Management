/**
 * Tạo tài khoản ADMIN đầu tiên (hoặc thêm admin mới).
 * Chạy:  npm run create-admin
 * Mật khẩu được băm bằng bcrypt trước khi lưu — database không bao giờ chứa mật khẩu gốc.
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
  const username = (await ask('Tên đăng nhập (3–50 ký tự, chữ/số/._-): ')).trim();
  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) throw new Error('Tên đăng nhập không hợp lệ');

  const fullName = (await ask('Họ tên: ')).trim();
  if (!fullName || fullName.length > 100) throw new Error('Họ tên không hợp lệ');

  const password = await askHidden('Mật khẩu (ít nhất 8 ký tự): ');
  if (password.length < 8) throw new Error('Mật khẩu phải có ít nhất 8 ký tự');
  const confirm = await askHidden('Nhập lại mật khẩu: ');
  if (password !== confirm) throw new Error('Hai lần nhập mật khẩu không khớp');

  const passwordHash = await bcrypt.hash(password, 12);
  const pool = await getPool();

  const exists = await pool.request()
    .input('username', sql.VarChar(50), username)
    .query('SELECT 1 FROM dbo.Users WHERE Username = @username');
  if (exists.recordset.length > 0) throw new Error(`Tài khoản "${username}" đã tồn tại`);

  await pool.request()
    .input('username', sql.VarChar(50), username)
    .input('passwordHash', sql.VarChar(100), passwordHash)
    .input('fullName', sql.NVarChar(100), fullName)
    .query(`INSERT INTO dbo.Users (Username, PasswordHash, FullName, Role)
            VALUES (@username, @passwordHash, @fullName, 'ADMIN')`);

  console.log(`Đã tạo tài khoản ADMIN "${username}".`);
}

main()
  .catch((err) => { console.error('Lỗi:', err.message); process.exitCode = 1; })
  .finally(async () => { rl.close(); await closePool().catch(() => {}); });
