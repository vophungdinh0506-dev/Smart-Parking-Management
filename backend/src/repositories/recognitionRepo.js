/** Truy cập bảng RecognitionLogs — mỗi lần tải ảnh/nhận diện là 1 dòng. */
const { sql, request } = require('../config/db');

function toRecognition(row) {
  if (!row) return null;
  return {
    recognitionId: Number(row.RecognitionId),
    direction: row.Direction,
    source: row.Source,
    imagePath: row.ImagePath,
    cropImagePath: row.CropImagePath,
    recognizedPlate: row.RecognizedPlate,
    candidates: row.Candidates ? JSON.parse(row.Candidates) : [],
    confidence: row.Confidence === null ? null : Number(row.Confidence),
    status: row.Status,
    engineName: row.EngineName,
    processingMs: row.ProcessingMs,
    confirmedPlate: row.ConfirmedPlate,
    sessionId: row.SessionId === null ? null : Number(row.SessionId),
    createdBy: row.CreatedBy,
    createdAt: row.CreatedAt,
  };
}

async function insert(rec) {
  const req = await request();
  const result = await req
    .input('direction', sql.VarChar(3), rec.direction)
    .input('source', sql.VarChar(10), rec.source || 'UPLOAD')
    .input('imagePath', sql.NVarChar(260), rec.imagePath)
    .input('cropImagePath', sql.NVarChar(260), rec.cropImagePath ?? null)
    .input('recognizedPlate', sql.NVarChar(12), rec.recognizedPlate ?? null)
    .input('candidates', sql.NVarChar(sql.MAX), rec.candidates?.length ? JSON.stringify(rec.candidates) : null)
    .input('confidence', sql.Decimal(5, 4), rec.confidence ?? null)
    .input('status', sql.VarChar(20), rec.status)
    .input('errorMessage', sql.NVarChar(500), rec.errorMessage ? String(rec.errorMessage).slice(0, 500) : null)
    .input('engineName', sql.VarChar(50), rec.engineName ? String(rec.engineName).slice(0, 50) : null)
    .input('processingMs', sql.Int, rec.processingMs ?? null)
    .input('createdBy', sql.Int, rec.createdBy)
    .query(`INSERT INTO dbo.RecognitionLogs
              (Direction, Source, ImagePath, CropImagePath, RecognizedPlate, Candidates, Confidence,
               Status, ErrorMessage, EngineName, ProcessingMs, CreatedBy)
            OUTPUT INSERTED.RecognitionId, INSERTED.CreatedAt
            VALUES (@direction, @source, @imagePath, @cropImagePath, @recognizedPlate, @candidates, @confidence,
                    @status, @errorMessage, @engineName, @processingMs, @createdBy)`);
  const row = result.recordset[0];
  return { recognitionId: Number(row.RecognitionId), createdAt: row.CreatedAt };
}

/** Đọc 1 dòng. forUpdate = true: khóa dòng tới hết transaction (chống 2 người dùng cùng 1 ảnh). */
async function findById(recognitionId, tx, { forUpdate = false } = {}) {
  const req = await request(tx);
  const hint = forUpdate ? 'WITH (UPDLOCK, ROWLOCK)' : '';
  const result = await req
    .input('id', sql.BigInt, recognitionId)
    .query(`SELECT * FROM dbo.RecognitionLogs ${hint} WHERE RecognitionId = @id`);
  return toRecognition(result.recordset[0]);
}

/** Gắn ảnh với lượt gửi. Chỉ thành công nếu ảnh CHƯA được dùng. @returns {Promise<boolean>} */
async function markUsed(recognitionId, sessionId, confirmedPlate, tx) {
  const req = await request(tx);
  const result = await req
    .input('id', sql.BigInt, recognitionId)
    .input('sessionId', sql.BigInt, sessionId)
    .input('plate', sql.NVarChar(12), confirmedPlate)
    .query(`UPDATE dbo.RecognitionLogs
            SET SessionId = @sessionId, ConfirmedPlate = @plate
            WHERE RecognitionId = @id AND SessionId IS NULL`);
  return result.rowsAffected[0] === 1;
}

module.exports = { insert, findById, markUsed };
