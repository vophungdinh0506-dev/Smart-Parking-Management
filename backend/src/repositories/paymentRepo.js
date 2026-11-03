/** Truy cập bảng Payments — ghi nhận thu tiền tại quầy. UNIQUE(SessionId) chặn thu tiền 2 lần. */
const { sql, request } = require('../config/db');

async function insert({ sessionId, amount, method = 'CASH', receivedBy, paidAt }, tx) {
  const req = await request(tx);
  const result = await req
    .input('sessionId', sql.BigInt, sessionId)
    .input('amount', sql.Int, amount)
    .input('method', sql.VarChar(10), method)
    .input('by', sql.Int, receivedBy)
    .input('paidAt', sql.DateTime2(0), paidAt)
    .query(`INSERT INTO dbo.Payments (SessionId, Amount, Method, ReceivedBy, PaidAt)
            OUTPUT INSERTED.PaymentId
            VALUES (@sessionId, @amount, @method, @by, @paidAt)`);
  return Number(result.recordset[0].PaymentId);
}

module.exports = { insert };
