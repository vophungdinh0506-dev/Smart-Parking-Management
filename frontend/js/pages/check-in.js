/**
 * Trang XE VÀO BÃI
 * Bước 1: chọn ảnh → POST /api/recognitions (direction=IN) → nhận recognitionId + gợi ý biển số
 * Bước 2: nhân viên kiểm tra/sửa biển số, chọn loại xe → POST /api/sessions/check-in
 */
(() => {
const { escapeHtml, showToast, setButtonLoading } = window.ui;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const els = {
  uploadForm: document.getElementById('upload-form'),
  input: document.getElementById('image-input'),
  dropzone: document.getElementById('dropzone'),
  preview: document.getElementById('image-preview'),
  hint: document.getElementById('dropzone-hint'),
  btnRecognize: document.getElementById('btn-recognize'),
  confirmForm: document.getElementById('confirm-form'),
  status: document.getElementById('recognition-status'),
  cropWrap: document.getElementById('crop-wrap'),
  cropImage: document.getElementById('crop-image'),
  candidates: document.getElementById('candidates'),
  plate: document.getElementById('plate-input'),
  plateHint: document.getElementById('plate-hint'),
  vehicleTypes: document.getElementById('vehicle-types'),
  confirmError: document.getElementById('confirm-error'),
  btnConfirm: document.getElementById('btn-confirm'),
  btnReset: document.getElementById('btn-reset'),
  insideList: document.getElementById('inside-list'),
  insideCount: document.getElementById('inside-count'),
  btnReload: document.getElementById('btn-reload-list'),
};

let selectedFile = null;
let previewUrl = null;
let recognition = null; // kết quả bước 1

// Màu của khung thông báo theo trạng thái nhận diện
const STATUS_ALERT = {
  SUCCESS: 'alert--success', LOW_CONFIDENCE: 'alert--warn', MULTIPLE: 'alert--warn',
  NOT_FOUND: 'alert--warn', ERROR: 'alert--error',
};

/* ---------------- Bước 1: chọn ảnh ---------------- */
function selectFile(file) {
  els.confirmForm.hidden = true;
  recognition = null;
  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) {
    showToast('Chỉ nhận ảnh JPEG, PNG hoặc WebP', 'error');
    return;
  }
  if (file.size > MAX_BYTES) {
    showToast('Ảnh vượt quá 5 MB', 'error');
    return;
  }
  selectedFile = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  els.preview.src = previewUrl;
  els.preview.hidden = false;
  els.hint.hidden = true;
  els.dropzone.classList.add('has-image');
  els.btnRecognize.disabled = false;
  els.btnRecognize.focus();
}

els.input.addEventListener('change', () => selectFile(els.input.files[0]));
['dragenter', 'dragover'].forEach((t) => els.dropzone.addEventListener(t, (e) => {
  e.preventDefault(); els.dropzone.classList.add('is-dragover');
}));
['dragleave', 'drop'].forEach((t) => els.dropzone.addEventListener(t, (e) => {
  e.preventDefault(); els.dropzone.classList.remove('is-dragover');
}));
els.dropzone.addEventListener('drop', (e) => selectFile(e.dataTransfer.files[0]));

els.uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedFile) return;

  const formData = new FormData();
  formData.append('direction', 'IN');
  formData.append('image', selectedFile);

  setButtonLoading(els.btnRecognize, true, 'Đang nhận diện...');
  els.input.disabled = true;
  const result = await window.api.request('/api/recognitions', { method: 'POST', formData });
  setButtonLoading(els.btnRecognize, false);
  els.input.disabled = false;

  if (!result.ok) {
    showToast(result.error.message, 'error', 6000);
    return;
  }
  recognition = result.data;
  els.btnRecognize.disabled = true; // ảnh này đã gửi rồi
  showRecognition(recognition);
});

/* ---------------- Bước 2: hiển thị kết quả ---------------- */
function showRecognition(r) {
  els.confirmForm.hidden = false;
  els.confirmError.hidden = true;

  let message = r.message;
  if (r.confidence !== null && r.confidence !== undefined) {
    message += ` (Độ tin cậy: ${Math.round(r.confidence * 100)}%)`;
  }
  els.status.className = `alert ${STATUS_ALERT[r.status] ?? 'alert--info'}`;
  els.status.textContent = message;

  els.cropWrap.hidden = !r.cropUrl;
  if (r.cropUrl) els.cropImage.src = r.cropUrl;

  // Nhiều biển số → cho nhân viên bấm chọn
  if (r.status === 'MULTIPLE' && r.candidates.length) {
    els.candidates.innerHTML = '<span class="muted small">Chọn biển số đúng:</span>' + r.candidates.map((c) =>
      `<button type="button" class="chip" data-plate="${escapeHtml(c.plate)}">${escapeHtml(c.plate)}
        ${c.confidence !== null ? `<span class="muted">${Math.round(c.confidence * 100)}%</span>` : ''}</button>`).join('');
    els.candidates.hidden = false;
  } else {
    els.candidates.hidden = true;
    els.candidates.innerHTML = '';
  }

  els.plate.value = r.plate ?? '';
  els.plate.classList.toggle('is-warning', r.status !== 'SUCCESS');
  suggestVehicleType(r.plate);
  els.plate.focus();
  els.plate.select();
  els.confirmForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

els.candidates.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  els.plate.value = chip.dataset.plate;
  suggestVehicleType(chip.dataset.plate);
  els.candidates.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-selected', c === chip));
});

/** Gợi ý loại xe từ dạng biển số: biển xe máy có thêm 1 chữ số sau chữ cái (59-X1...) */
function suggestVehicleType(plate) {
  const p = (plate || '').toUpperCase().replace(/[\s.\-_]/g, '');
  let code = null;
  if (/^[0-9]{2}[A-ZĐ]{1,2}[0-9][0-9]{5}$/.test(p)) code = 'MOTORBIKE';   // 9–10 ký tự: chắc chắn xe máy
  const radio = code && els.vehicleTypes.querySelector(`input[data-code="${code}"]`);
  if (radio && !els.vehicleTypes.querySelector('input:checked')) radio.checked = true;
}

async function loadVehicleTypes() {
  const result = await window.api.request('/api/vehicle-types');
  if (!result.ok) {
    els.vehicleTypes.innerHTML = `<span class="text-danger">${escapeHtml(result.error.message)}</span>`;
    return;
  }
  els.vehicleTypes.innerHTML = result.data.items.map((v) => `
    <label class="segmented__option">
      <input type="radio" name="vehicleTypeId" value="${v.vehicleTypeId}" data-code="${escapeHtml(v.code)}" required>
      <span>${escapeHtml(v.name)}</span>
    </label>`).join('');
}

function resetAll() {
  selectedFile = null;
  recognition = null;
  els.uploadForm.reset();
  els.confirmForm.reset();
  els.confirmForm.hidden = true;
  els.preview.hidden = true;
  els.preview.removeAttribute('src');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  els.hint.hidden = false;
  els.dropzone.classList.remove('has-image');
  els.btnRecognize.disabled = true;
  els.btnConfirm.disabled = false;
  els.confirmError.hidden = true;
}

els.btnReset.addEventListener('click', resetAll);

/* ---------------- Xác nhận xe vào ---------------- */
els.confirmForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.confirmError.hidden = true;

  const plateNumber = els.plate.value.trim();
  const checked = els.vehicleTypes.querySelector('input:checked');
  if (!plateNumber) return showConfirmError('Vui lòng nhập biển số xe', els.plate);
  if (!checked) return showConfirmError('Vui lòng chọn loại xe', els.vehicleTypes.querySelector('input'));
  if (!recognition) return showConfirmError('Vui lòng tải ảnh và nhận diện trước');

  setButtonLoading(els.btnConfirm, true, 'Đang lưu...');
  const result = await window.api.request('/api/sessions/check-in', {
    method: 'POST',
    body: { recognitionId: recognition.recognitionId, plateNumber, vehicleTypeId: Number(checked.value) },
  });
  setButtonLoading(els.btnConfirm, false);

  if (!result.ok) {
    const focusPlate = result.error.details?.field === 'plateNumber';
    showConfirmError(result.error.message, focusPlate ? els.plate : null);
    // Ảnh đã bị dùng / hết hạn → phải tải ảnh mới
    if (['RECOGNITION_ALREADY_USED', 'RECOGNITION_EXPIRED', 'RECOGNITION_NOT_FOUND'].includes(result.error.code)) {
      els.btnConfirm.disabled = true;
    }
    return;
  }

  const s = result.data.session;
  showToast(`Đã tạo lượt gửi: ${s.plateDisplay} (${s.vehicleType.name}) lúc ${window.format.dateTime(s.checkInAt)}`, 'success', 6000);
  resetAll();
  loadInsideList();
});

function showConfirmError(message, focusEl) {
  els.confirmError.textContent = message;
  els.confirmError.hidden = false;
  if (focusEl) focusEl.focus();
}

/* ---------------- Danh sách xe trong bãi ---------------- */
async function loadInsideList() {
  const result = await window.api.request('/api/sessions?status=OPEN&pageSize=20');
  if (!result.ok) {
    els.insideList.innerHTML = `<div class="alert alert--error">${escapeHtml(result.error.message)}</div>`;
    return;
  }
  const { items, total } = result.data;
  els.insideCount.textContent = total;
  if (!items.length) {
    els.insideList.innerHTML = '<div class="empty">Chưa có xe nào trong bãi.</div>';
    return;
  }
  els.insideList.innerHTML = `
    <ul class="vehicle-list">
      ${items.map((s) => `
        <li class="vehicle-list__item">
          <div>
            <div class="plate">${escapeHtml(s.plateDisplay)}</div>
            <div class="muted small">${escapeHtml(s.vehicleType.name)} · vào ${escapeHtml(window.format.dateTime(s.checkInAt))}
              ${s.checkInPlateEdited ? ' · <span title="Biển số được nhân viên nhập/sửa tay">sửa tay</span>' : ''}</div>
          </div>
          <span class="muted small">${escapeHtml(window.format.duration(s.checkInAt))}</span>
        </li>`).join('')}
    </ul>
    ${total > items.length ? `<p class="muted small">Đang hiện ${items.length}/${total} xe mới nhất.</p>` : ''}`;
}

els.btnReload.addEventListener('click', loadInsideList);

window.ui.ready.then(() => {
  loadVehicleTypes();
  loadInsideList();
});
})();
