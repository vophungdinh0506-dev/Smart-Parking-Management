/**
 * Gửi ảnh sang AI service (Python) và diễn giải kết quả.
 *
 * AI chỉ trả dữ liệu thô (danh sách biển số + độ tin cậy). BACKEND quyết định trạng thái:
 *   SUCCESS        — 1 biển, độ tin cậy cao, đúng định dạng
 *   LOW_CONFIDENCE — 1 biển nhưng độ tin cậy thấp hoặc sai định dạng → nhân viên kiểm tra kỹ
 *   NOT_FOUND      — không thấy biển số (ảnh mờ, tối, bị che, không có xe)
 *   MULTIPLE       — nhiều biển trong ảnh → nhân viên chọn
 *   ERROR          — AI tắt, quá thời gian, trả lỗi → nhân viên nhập tay
 * Dù trạng thái nào, ảnh vẫn được lưu và nhân viên vẫn tiếp tục được (nhập tay).
 * KHÔNG BAO GIỜ tự tạo biển số giả khi AI lỗi.
 */
const config = require('../config/env');
const { normalizePlate, isValidPlate } = require('../utils/plate');
const { saveImage } = require('../middlewares/upload');
const recognitionRepo = require('../repositories/recognitionRepo');

const STATUS_MESSAGES = {
  SUCCESS: 'Đã nhận diện biển số. Vui lòng kiểm tra lại trước khi xác nhận.',
  LOW_CONFIDENCE: 'Kết quả nhận diện chưa chắc chắn. Vui lòng đối chiếu kỹ với ảnh.',
  NOT_FOUND: 'Không phát hiện biển số trong ảnh. Vui lòng nhập biển số thủ công.',
  MULTIPLE: 'Ảnh có nhiều biển số. Vui lòng chọn đúng biển của xe.',
  ERROR: 'Không sử dụng được module nhận diện. Vui lòng nhập biển số thủ công.',
};

/**
 * Hàm thuần: diễn giải JSON của AI → { status, recognizedPlate, confidence, candidates, cropBase64 }
 */
function interpretAiResult(body, threshold = config.ai.confidenceThreshold) {
  const plates = Array.isArray(body?.plates) ? body.plates : [];
  const candidates = plates
    .map((p) => ({
      plate: normalizePlate(String(p?.text ?? '')).slice(0, 12),
      confidence: Number.isFinite(Number(p?.confidence)) ? Math.min(Math.max(Number(p.confidence), 0), 1) : null,
      cropBase64: typeof p?.crop_jpeg_base64 === 'string' ? p.crop_jpeg_base64 : null,
    }))
    .filter((c) => c.plate.length > 0)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  if (candidates.length === 0) {
    return { status: 'NOT_FOUND', recognizedPlate: null, confidence: null, candidates: [], cropBase64: null };
  }
  const best = candidates[0];
  let status;
  if (candidates.length > 1) status = 'MULTIPLE';
  else if ((best.confidence ?? 0) >= threshold && isValidPlate(best.plate)) status = 'SUCCESS';
  else status = 'LOW_CONFIDENCE';

  return {
    status,
    recognizedPlate: best.plate,
    confidence: best.confidence,
    candidates: candidates.map(({ plate, confidence }) => ({ plate, confidence })),
    cropBase64: best.cropBase64,
  };
}

/** Gọi AI service. Không ném lỗi — mọi sự cố đều trả về status ERROR kèm lý do (để ghi log). */
async function callAiService(buffer, mimetype) {
  const started = Date.now();
  try {
    const form = new FormData();
    form.append('image', new Blob([buffer], { type: mimetype }), `image.${mimetype.split('/')[1]}`);
    const res = await fetch(`${config.ai.url}/recognize`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(config.ai.timeoutMs),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: `AI trả về HTTP ${res.status}: ${body?.detail ?? ''}`.trim(), elapsed: Date.now() - started };
    }
    return { ok: true, body, elapsed: Date.now() - started };
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? `Quá ${config.ai.timeoutMs} ms không phản hồi` : err.message;
    return { ok: false, error: `Không gọi được AI service: ${reason}`, elapsed: Date.now() - started };
  }
}

/**
 * Lưu ảnh → gọi AI → lưu kết quả vào RecognitionLogs.
 * @returns kết quả để trả cho frontend
 */
async function recognize({ buffer, mimetype, direction, userId }) {
  const imagePath = await saveImage(buffer, mimetype);
  const ai = await callAiService(buffer, mimetype);

  let outcome;
  if (ai.ok) {
    outcome = interpretAiResult(ai.body);
  } else {
    console.warn('[recognition]', ai.error);
    outcome = { status: 'ERROR', recognizedPlate: null, confidence: null, candidates: [], cropBase64: null };
  }

  let cropImagePath = null;
  if (outcome.cropBase64) {
    try {
      cropImagePath = await saveImage(Buffer.from(outcome.cropBase64, 'base64'), 'image/jpeg', '-crop');
    } catch (err) {
      console.warn('[recognition] Không lưu được ảnh cắt:', err.message);
    }
  }

  const engineName = ai.ok && typeof ai.body?.engine === 'string' ? ai.body.engine : null;
  const processingMs = ai.ok && Number.isInteger(ai.body?.processing_ms) ? ai.body.processing_ms : ai.elapsed;

  const saved = await recognitionRepo.insert({
    direction,
    source: 'UPLOAD',
    imagePath,
    cropImagePath,
    recognizedPlate: outcome.recognizedPlate,
    candidates: outcome.candidates,
    confidence: outcome.confidence,
    status: outcome.status,
    errorMessage: ai.ok ? null : ai.error,
    engineName,
    processingMs,
    createdBy: userId,
  });

  return {
    recognitionId: saved.recognitionId,
    direction,
    status: outcome.status,
    message: STATUS_MESSAGES[outcome.status],
    plate: outcome.recognizedPlate,
    confidence: outcome.confidence,
    candidates: outcome.candidates,
    engine: engineName,
    processingMs,
    imageUrl: `/api/images/recognitions/${saved.recognitionId}/original`,
    cropUrl: cropImagePath ? `/api/images/recognitions/${saved.recognitionId}/crop` : null,
  };
}

module.exports = { recognize, interpretAiResult, STATUS_MESSAGES };
