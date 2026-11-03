/**
 * Trang XE VÀO BÃI
 * Bước 1: chọn ảnh → POST /api/recognitions (direction=IN) → nhận recognitionId + gợi ý biển số
 * Bước 2: nhân viên kiểm tra/sửa biển số, chọn loại xe → POST /api/sessions/check-in
 */
(() => {
const { escapeHtml, showToast, setButtonLoading } = window.ui;
const { createImageIntake, showRecognition, createInsideList } = window.components;
const $ = (id) => document.getElementById(id);

const els = {
  confirmForm: $('confirm-form'),
  plate: $('plate-input'),
  vehicleTypes: $('vehicle-types'),
  confirmError: $('confirm-error'),
  btnConfirm: $('btn-confirm'),
};
let recognition = null; // kết quả bước 1

const insideList = createInsideList({ container: $('inside-list'), countEl: $('inside-count'), reloadBtn: $('btn-reload-list') });

const intake = createImageIntake({
  direction: 'IN',
  form: $('upload-form'), input: $('image-input'), dropzone: $('dropzone'),
  preview: $('image-preview'), hint: $('dropzone-hint'), button: $('btn-recognize'),
  onFileChanged: () => { els.confirmForm.hidden = true; recognition = null; },
  onRecognized: (r) => {
    recognition = r;
    els.confirmForm.hidden = false;
    els.confirmError.hidden = true;
    els.btnConfirm.disabled = false;
    showRecognition(r, {
      statusEl: $('recognition-status'), cropWrap: $('crop-wrap'), cropImage: $('crop-image'),
      candidatesEl: $('candidates'), plateInput: els.plate, onPick: suggestVehicleType,
    });
    suggestVehicleType(r.plate);
    els.plate.focus();
    els.plate.select();
    els.confirmForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
});

/** Gợi ý loại xe từ dạng biển số: 2 số + chữ + 1 số + 5 số (59-X1 123.45) chắc chắn là xe máy */
function suggestVehicleType(plate) {
  const p = (plate || '').toUpperCase().replace(/[\s.\-_]/g, '');
  if (!/^[0-9]{2}[A-ZĐ]{1,2}[0-9][0-9]{5}$/.test(p)) return;
  const radio = els.vehicleTypes.querySelector('input[data-code="MOTORBIKE"]');
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
  recognition = null;
  intake.reset();
  els.confirmForm.reset();
  els.confirmForm.hidden = true;
  els.btnConfirm.disabled = false;
  els.confirmError.hidden = true;
}
$('btn-reset').addEventListener('click', resetAll);

function showConfirmError(message, focusEl) {
  els.confirmError.textContent = message;
  els.confirmError.hidden = false;
  focusEl?.focus();
}

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
    showConfirmError(result.error.message, result.error.details?.field === 'plateNumber' ? els.plate : null);
    if (['RECOGNITION_ALREADY_USED', 'RECOGNITION_EXPIRED', 'RECOGNITION_NOT_FOUND'].includes(result.error.code)) {
      els.btnConfirm.disabled = true; // phải tải ảnh mới
    }
    return;
  }

  const s = result.data.session;
  showToast(`Đã tạo lượt gửi: ${s.plateDisplay} (${s.vehicleType.name}) lúc ${window.format.dateTime(s.checkInAt)}`, 'success', 6000);
  resetAll();
  insideList.load();
});

window.ui.ready.then(() => {
  loadVehicleTypes();
  insideList.load();
});
})();
