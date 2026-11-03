/** Truy cập bảng VehicleTypes (Xe máy, Ô tô). */
const { sql, request } = require('../config/db');

const toVehicleType = (r) => (r ? { vehicleTypeId: r.VehicleTypeId, code: r.Code, name: r.Name } : null);

async function findAll() {
  const req = await request();
  const result = await req.query('SELECT VehicleTypeId, Code, Name FROM dbo.VehicleTypes ORDER BY VehicleTypeId');
  return result.recordset.map(toVehicleType);
}

async function findById(vehicleTypeId, tx) {
  const req = await request(tx);
  const result = await req
    .input('id', sql.TinyInt, vehicleTypeId)
    .query('SELECT VehicleTypeId, Code, Name FROM dbo.VehicleTypes WHERE VehicleTypeId = @id');
  return toVehicleType(result.recordset[0]);
}

module.exports = { findAll, findById };
