/**
 * GET /api/health — kiểm tra nhanh các thành phần đang chạy hay không.
 *   200 + status "ok"       : backend, database, AI service đều chạy
 *   200 + status "degraded" : database chạy nhưng AI service không chạy (vẫn nhập tay được)
 *   503 + status "down"     : không kết nối được database
 * Không trả chi tiết lỗi kỹ thuật ra ngoài (chi tiết được ghi ở log server).
 */
const express = require('express');
const config = require('../config/env');
const { getPool } = require('../config/db');

const router = express.Router();

async function checkDatabase() {
  const started = Date.now();
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    console.error('[health] SQL Server:', err.message);
    return { ok: false, message: 'Không kết nối được SQL Server' };
  }
}

async function checkAiService() {
  const started = Date.now();
  try {
    const res = await fetch(`${config.ai.url}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { ok: false, message: `Module nhận diện trả về lỗi ${res.status}` };
    const body = await res.json().catch(() => ({}));
    return {
      ok: true,
      latencyMs: Date.now() - started,
      modelReady: body.model_ready === true,
      engine: typeof body.engine === 'string' ? body.engine : null,
    };
  } catch (err) {
    console.error('[health] AI service:', err.message);
    return { ok: false, message: 'Không kết nối được module nhận diện' };
  }
}

router.get('/', async (req, res) => {
  const [database, aiService] = await Promise.all([checkDatabase(), checkAiService()]);
  let status = 'ok';
  if (!database.ok) status = 'down';
  else if (!aiService.ok || !aiService.modelReady) status = 'degraded';

  res.status(database.ok ? 200 : 503).json({
    status,
    time: new Date().toISOString(),
    components: { backend: { ok: true }, database, aiService },
  });
});

module.exports = router;
