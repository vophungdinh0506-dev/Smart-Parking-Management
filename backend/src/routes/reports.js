/**
 * GET /api/reports/revenue?from=2026-11-01&to=2026-11-30   (CHỈ ADMIN — chức năng mở rộng)
 * → tổng doanh thu, số lượt thu tiền, chia theo ngày và theo loại xe.
 */
const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const reportRepo = require('../repositories/reportRepo');
const vehicleTypeRepo = require('../repositories/vehicleTypeRepo');
const AppError = require('../utils/AppError');
const { parseVnDate, vnDateKey, DAY_MS } = require('../utils/time');

const router = express.Router();
router.use(requireAuth, requireRole('ADMIN'));

router.get('/revenue', async (req, res) => {
  if (!req.query.from || !req.query.to) throw new AppError(400, 'VALIDATION_ERROR', 'Chọn khoảng ngày cần xem', { field: 'from' });
  const from = parseVnDate(String(req.query.from), 'from');
  const to = new Date(parseVnDate(String(req.query.to), 'to').getTime() + DAY_MS);
  if (to <= from) throw new AppError(400, 'VALIDATION_ERROR', 'Ngày kết thúc phải từ ngày bắt đầu trở đi', { field: 'to' });
  if (to - from > 366 * DAY_MS) throw new AppError(400, 'VALIDATION_ERROR', 'Chỉ xem tối đa 366 ngày', { field: 'to' });

  const [{ rows, cancelledCount }, vehicleTypes] = await Promise.all([reportRepo.revenue(from, to), vehicleTypeRepo.findAll()]);

  // Điền đủ mọi ngày trong khoảng (ngày không có doanh thu = 0) để vẽ biểu đồ liên tục
  const byDay = [];
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) {
    const day = vnDateKey(new Date(t));
    const dayRows = rows.filter((r) => r.day === day);
    byDay.push({
      day,
      amount: dayRows.reduce((s, r) => s + r.amount, 0),
      count: dayRows.reduce((s, r) => s + r.count, 0),
      byVehicleType: Object.fromEntries(vehicleTypes.map((v) => [v.code, dayRows.find((r) => r.vehicleTypeId === v.vehicleTypeId)?.amount ?? 0])),
    });
  }
  const byVehicleType = vehicleTypes.map((v) => {
    const vRows = rows.filter((r) => r.vehicleTypeId === v.vehicleTypeId);
    return { ...v, amount: vRows.reduce((s, r) => s + r.amount, 0), count: vRows.reduce((s, r) => s + r.count, 0) };
  });

  res.json({
    from: req.query.from, to: req.query.to,
    totalAmount: byDay.reduce((s, d) => s + d.amount, 0),
    totalCount: byDay.reduce((s, d) => s + d.count, 0),
    cancelledCount,
    byDay,
    byVehicleType,
  });
});

module.exports = router;
