"""
Dịch vụ nhận diện biển số — Smart Parking
Chạy:  uvicorn main:app --port 8000 --reload

TRẠNG THÁI HIỆN TẠI (Giai đoạn 3): mới có khung API.
  - GET  /health    : hoạt động thật, báo model_ready = false
  - POST /recognize : trả 503 "chưa tích hợp mô hình" — KHÔNG trả biển số giả.
Mô hình thật (YOLO + OCR) sẽ được thêm ở Giai đoạn 4c, trong file recognizer.py.

"Hợp đồng" API mà backend Node.js mong đợi (xem docs/02-thiet-ke-he-thong.md, mục 6):
  POST /recognize (multipart, field "image")
  -> 200 {"plates": [{"text", "confidence", "bbox", "lines", "crop_jpeg_base64"}],
          "engine": str, "processing_ms": int}
  -> 200 {"plates": []}  khi không thấy biển số
"""
from fastapi import FastAPI, File, HTTPException, UploadFile

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

app = FastAPI(title="Smart Parking — License Plate Recognition", version="0.1.0")

# Sẽ được gán khi tích hợp mô hình thật
recognizer = None


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_ready": recognizer is not None,
        "engine": getattr(recognizer, "name", None),
    }


@app.post("/recognize")
async def recognize(image: UploadFile = File(...)):
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Chỉ nhận ảnh JPEG, PNG hoặc WebP")
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Ảnh vượt quá 5 MB")

    if recognizer is None:
        raise HTTPException(status_code=503, detail="Chưa tích hợp mô hình nhận diện (Giai đoạn 4c)")

    return recognizer.predict(data)
