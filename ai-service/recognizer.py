"""
Lớp "adapter" (bộ chuyển đổi) cho mô hình nhận diện biển số.

Backend Node.js chỉ biết "hợp đồng" API (xem main.py). Muốn đổi mô hình khác
(YOLO tự huấn luyện, PaddleOCR, API bên ngoài...) chỉ cần viết 1 lớp mới có:
    name: str
    predict(image_bytes) -> dict theo đúng hợp đồng
rồi đổi hàm create_recognizer() — không phải sửa backend.

Mô hình đang dùng: fast-alpr (mã nguồn mở, chạy CPU qua ONNX Runtime)
  - Bước 1 PHÁT HIỆN vùng biển số: YOLOv9-tiny (open-image-models)
  - Bước 2 ĐỌC KÝ TỰ trên vùng đã cắt: mô hình OCR "global" (fast-plate-ocr)
Lần chạy đầu tiên thư viện tự tải mô hình (~11 MB) về máy, cần Internet.
"""
from __future__ import annotations

import base64
import time

import cv2
import numpy as np

# Bỏ các vùng phát hiện quá kém tin cậy (thường là vật thể khác bị nhận nhầm là biển số)
MIN_DETECTION_CONFIDENCE = 0.35


class ImageDecodeError(ValueError):
    """Ảnh hỏng hoặc không phải ảnh."""


def decode_image(image_bytes: bytes) -> np.ndarray:
    image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ImageDecodeError("Không đọc được ảnh")
    return image


def crop_to_base64(image: np.ndarray, box) -> str | None:
    """Cắt vùng biển số (nới rộng 4px) → JPEG base64 để hiển thị cho nhân viên."""
    h, w = image.shape[:2]
    x1, y1 = max(int(box.x1) - 4, 0), max(int(box.y1) - 4, 0)
    x2, y2 = min(int(box.x2) + 4, w), min(int(box.y2) + 4, h)
    if x2 <= x1 or y2 <= y1:
        return None
    ok, buf = cv2.imencode(".jpg", image[y1:y2, x1:x2], [cv2.IMWRITE_JPEG_QUALITY, 90])
    return base64.b64encode(buf.tobytes()).decode("ascii") if ok else None


class FastAlprRecognizer:
    name = "fast-alpr yolov9t+cct-xs-v2-global"

    def __init__(self) -> None:
        from fast_alpr import ALPR  # import ở đây để main.py vẫn chạy được khi chưa cài thư viện

        self._alpr = ALPR(
            detector_model="yolo-v9-t-384-license-plate-end2end",
            ocr_model="cct-xs-v2-global-model",
        )

    def predict(self, image_bytes: bytes) -> dict:
        started = time.perf_counter()
        image = decode_image(image_bytes)
        results = self._alpr.predict(image)

        plates = []
        for r in results:
            det = r.detection
            if det.confidence < MIN_DETECTION_CONFIDENCE or r.ocr is None or not r.ocr.text:
                continue
            char_conf = r.ocr.confidence if isinstance(r.ocr.confidence, (list, tuple)) else [r.ocr.confidence]
            box = det.bounding_box
            plates.append({
                "text": r.ocr.text,
                # Lấy độ tin cậy THẤP NHẤT trong các ký tự: chỉ cần 1 ký tự mờ là cảnh báo nhân viên kiểm tra
                "confidence": round(float(min(char_conf)), 4),
                "detection_confidence": round(float(det.confidence), 4),
                "bbox": [int(box.x1), int(box.y1), int(box.x2), int(box.y2)],
                # Ước lượng số dòng từ tỉ lệ cao/rộng (biển xe máy 2 dòng gần vuông hơn)
                "lines": 2 if (box.y2 - box.y1) / max(box.x2 - box.x1, 1) > 0.5 else 1,
                "crop_jpeg_base64": crop_to_base64(image, box),
            })

        return {
            "plates": plates,
            "engine": self.name,
            "processing_ms": int((time.perf_counter() - started) * 1000),
        }


def create_recognizer():
    """Tạo mô hình nhận diện. Đổi mô hình: sửa duy nhất hàm này."""
    return FastAlprRecognizer()
