"""
ĐO ĐỘ CHÍNH XÁC NHẬN DIỆN trên bộ ảnh có nhãn (phục vụ mục 5.3 của đề cương).

Chuẩn bị thư mục ảnh, ví dụ ai-service/dataset/, theo 1 trong 2 cách:
  (a) Đặt tên file = biển số đúng:  51F12345.jpg, 59X112345_dem.jpg  (phần sau dấu _ được bỏ qua)
  (b) Có file labels.csv:            filename,plate
                                     IMG_001.jpg,51F-123.45
      Ảnh KHÔNG có biển số: để plate trống → kỳ vọng hệ thống báo "không thấy biển số".

Chạy:   python evaluate.py dataset
Kết quả: in tỷ lệ đúng, thời gian trung bình; ghi chi tiết từng ảnh ra dataset/evaluation_report.csv
"""
import csv
import re
import statistics
import sys
import time
from pathlib import Path

from recognizer import create_recognizer

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
THRESHOLD = 0.85  # giống AI_CONFIDENCE_THRESHOLD của backend


def normalize(plate: str) -> str:
    return re.sub(r"[\s.\-_]", "", plate.upper())


def load_labels(folder: Path) -> dict:
    labels_file = folder / "labels.csv"
    if labels_file.exists():
        with labels_file.open(encoding="utf-8-sig") as f:
            return {row["filename"]: normalize(row.get("plate") or "") for row in csv.DictReader(f)}
    return {p.name: normalize(p.stem.split("_")[0]) for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXT}


def main(folder_arg: str) -> None:
    folder = Path(folder_arg)
    labels = load_labels(folder)
    if not labels:
        sys.exit(f"Không có ảnh nào trong {folder}")

    recognizer = create_recognizer()
    rows, times = [], []
    for filename, expected in sorted(labels.items()):
        path = folder / filename
        if not path.exists():
            print(f"  ! Thiếu file {filename}")
            continue
        t = time.perf_counter()
        result = recognizer.predict(path.read_bytes())
        times.append((time.perf_counter() - t) * 1000)
        plates = result["plates"]
        best = max(plates, key=lambda p: p["confidence"]) if plates else None
        predicted = normalize(best["text"]) if best else ""
        correct = predicted == expected
        rows.append({
            "filename": filename, "expected": expected, "predicted": predicted,
            "confidence": best["confidence"] if best else "", "plates_found": len(plates),
            "correct": correct, "low_confidence": bool(best) and best["confidence"] < THRESHOLD,
        })
        mark = "✓" if correct else "✗"
        print(f"  {mark} {filename:35} đúng={expected or '(không biển)':12} đọc={predicted or '(không thấy)':12} tin cậy={rows[-1]['confidence']}")

    total = len(rows)
    with_plate = [r for r in rows if r["expected"]]
    correct_plates = sum(r["correct"] for r in with_plate)
    wrong_but_flagged = sum(1 for r in with_plate if not r["correct"] and (r["low_confidence"] or not r["predicted"]))
    wrong_confident = sum(1 for r in with_plate if not r["correct"] and r["predicted"] and not r["low_confidence"])

    print("\n===== KẾT QUẢ =====")
    print(f"Số ảnh: {total} (có biển: {len(with_plate)}, không biển: {total - len(with_plate)})")
    if with_plate:
        print(f"Tỷ lệ đọc đúng toàn bộ biển số: {correct_plates}/{len(with_plate)} = {correct_plates / len(with_plate):.1%}")
        print(f"Đọc sai nhưng ĐÃ cảnh báo nhân viên (độ tin cậy thấp / không thấy): {wrong_but_flagged}")
        print(f"Đọc sai mà KHÔNG cảnh báo (nguy hiểm nhất, cần nêu trong báo cáo): {wrong_confident}")
    no_plate = [r for r in rows if not r["expected"]]
    if no_plate:
        ok = sum(1 for r in no_plate if not r["predicted"])
        print(f"Ảnh không biển → báo không thấy: {ok}/{len(no_plate)}")
    print(f"Thời gian xử lý trung bình: {statistics.mean(times):.0f} ms/ảnh (CPU)")

    report = folder / "evaluation_report.csv"
    with report.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Chi tiết từng ảnh: {report}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "dataset")
