/** GET /api/vehicle-types → danh sách loại xe (cho ô chọn trên giao diện) */
const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const vehicleTypeRepo = require('../repositories/vehicleTypeRepo');

const router = express.Router();
router.get('/', requireAuth, async (req, res) => {
  res.json({ items: await vehicleTypeRepo.findAll() });
});
module.exports = router;
