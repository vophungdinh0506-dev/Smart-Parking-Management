"""
Dịch vụ nhận diện biển số — Smart Parking
Chạy:  uvicorn main:app --port 8000
       (thêm --reload khi đang sửa code)

"Hợp đồng" API mà backend Node.js mong đợi (xem docs/02-thiet-ke-he-thong.md, mục 6):
  POST /recognize (multipart, trường "image")
    → 200 {"plates": [{"text", "confidence", "bbox", "lines", "crop_jpeg_base64"}],
           "engine": str, "processing_ms": int}
    → 200 {"plates": []}   khi không thấy biển số
    → 400 ảnh hỏng · 413 ảnh quá lớn · 415 sai loại file · 503 chưa tải được mô hình
  GET /health → {"status": "ok", "model_ready": bool, "engine": str|null}

Dịch vụ CHỈ trả dữ liệu thô. Backend quyết định trạng thái (SUCCESS / LOW_CONFIDENCE / ...)
và nhân viên luôn được kiểm tra, sửa biển số trước khi lưu. KHÔNG trả biển số giả.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile

from recognizer import ImageDecodeError, create_recognizer

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

log = logging.getLogger("lpr")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

recognizer = None
load_error = None


@asynccontextmanager
async def lifespan(_app):
    """Nạp mô hình 1 lần khi khởi động (mất vài giây), không nạp lại cho mỗi ảnh."""
    global recognizer, load_error
    try:
        recognizer = create_recognizer()
        log.info("Đã nạp mô hình: %s", recognizer.name)
    except Exception as exc:  # thiếu thư viện, không tải được mô hình...
        load_error = str(exc)
        log.error("Không nạp được mô hình nhận diện: %s", exc)
    yield


app = FastAPI(title="Smart Parking — License Plate Recognition", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_ready": recognizer is not None,
        "engine": getattr(recognizer, "name", None),
        "error": None if recognizer else load_error,
    }


@app.post("/recognize")
async def recognize(image: UploadFile = File(...)):
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Chỉ nhận ảnh JPEG, PNG hoặc WebP")
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Ảnh vượt quá 5 MB")
    if recognizer is None:
        raise HTTPException(status_code=503, detail=f"Chưa nạp được mô hình nhận diện: {load_error}")

    try:
        # Chạy mô hình ở luồng phụ để server vẫn nhận request khác trong lúc xử lý
        return await asyncio.to_thread(recognizer.predict, data)
    except ImageDecodeError:
        raise HTTPException(status_code=400, detail="Ảnh bị hỏng hoặc không đọc được")
