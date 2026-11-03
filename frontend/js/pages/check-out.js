/**
 * Trang XE RA BÃI
 * Bước 1: ảnh xe ra → POST /api/recognitions (direction=OUT)
 * Bước 2: xác nhận biển số → POST /api/sessions/check-out/preview → lượt gửi + phí tạm tính
 * Bước 3: nhân viên đối chiếu 2 ảnh, thu tiền → POST /api/sessions/:id/check-out
 * Số tiền hiển thị do BACKEND tính. Trang này không tự tính phí.
 */
(() => {
const { escapeHtml, showToast, setButtonLoading } = window.ui;
const { createImageIntake, showRecognition, createInsideList, confirmDialog } = window.components;
const fmt = window.format;
const $ = (id) => document.getElementById(id);

const els = {
  plateForm: $('plate-form'), plate: $('plate-input'), lookupError: $('lookup-error'),
  suggestions: $('suggestions'), btnLookup: $('btn-lookup'),
  feePanel: $('fee-panel'), imgIn: $('img-in'), imgOut: $('img-out'), info: $('session-info'),
  feeItems: $('fee-items'), feeTotal: $('fee-total'), feeNote: $('fee-note'),
  payError: $('pay-error'), btnPay: $('btn-pay'),
};

let recognition = null; // ảnh xe ra đã tải lên
let quote = null;       // kết quả xem trước: { session, checkOutAt, fee, checkOutImageUrl }

const insideList = createInsideList({
  container: $('inside-list'), countEl: $('inside-count'), reloadBtn: $('btn-reload-list'),
  onSelect: (plate) => {
    if (els.plateForm.hidden) return showToast('Hãy tải ảnh xe ra trước, rồi mới chọn biển số.', 'info');
    els.plate.value = plate;
    els.plate.focus();
  },
});

const intake = createImageIntake({
  direction: 'OUT',
  form: $('upload-form'), input: $('image-input'), dropzone: $('dropzone'),
  preview: $('image-preview'), hint: $('dropzone-hint'), button: $('btn-recognize'),
  onFileChanged: () => { hideAfter('upload'); recognition = null; },
  onRecognized: (r) => {
    recognition = r;
    els.plateForm.hidden = false;
    hideAfter('plate');
    showRecognition(r, {
      statusEl: $('recognition-status'), cropWrap: $('crop-wrap'), cropImage: $('crop-image'),
      candidatesEl: $('candidates'), plateInput: els.plate,
    });
    els.plate.focus();
    els.plate.select();
    els.plateForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
});

/** Ẩn các bước phía sau 1 bước (khi nhân viên làm lại từ bước đó) */
function hideAfter(step) {
  if (step === 'upload') els.plateForm.hidden = true;
  els.lookupError.hidden = true;
  els.suggestions.hidden = true;
  els.feePanel.hidden = true;
  els.payError.hidden = true;
  quote = null;
}

function resetAll() {
  recognition = null;
  intake.reset();
  els.plateForm.reset();
  hideAfter('upload');
  els.btnLookup.disabled = false;
  els.btnPay.disabled = false;
}
$('btn-reset').addEventListener('click', resetAll);
$('btn-cancel-pay').addEventListener('click', () => { hideAfter('plate'); els.plate.focus(); });
els.plate.addEventListener('input', () => { if (!els.feePanel.hidden) hideAfter('plate'); });

/* ---------------- Bước 2: tìm lượt gửi ---------------- */
async function lookup() {
  hideAfter('plate');
  const plateNumber = els.plate.value.trim();
  if (!plateNumber) {
    els.lookupError.textContent = 'Vui lòng nhập biển số xe';
    els.lookupError.hidden = false;
    return els.plate.focus();
  }

  setButtonLoading(els.btnLookup, true, 'Đang tìm...');
  const result = await window.api.request('/api/sessions/check-out/preview', {
    method: 'POST', body: { recognitionId: recognition.recognitionId, plateNumber },
  });
  setButtonLoading(els.btnLookup, false);

  if (!result.ok) {
    els.lookupError.textContent = result.error.message;
    els.lookupError.hidden = false;
    const suggestions = result.error.details?.suggestions ?? [];
    if (suggestions.length) {
      els.suggestions.innerHTML = '<span class="muted small">Có phải xe này?</span>' + suggestions.map((s) =>
        `<button type="button" class="chip" data-plate="${escapeHtml(s.plateNumber)}">${escapeHtml(s.plateDisplay)}
          <span class="muted">${escapeHtml(s.vehicleTypeName)}</span></button>`).join('');
      els.suggestions.hidden = false;
    }
    if (['RECOGNITION_ALREADY_USED', 'RECOGNITION_EXPIRED', 'RECOGNITION_NOT_FOUND'].includes(result.error.code)) {
      els.btnLookup.disabled = true;
    }
    return;
  }
  quote = result.data;
  renderQuote();
}

els.plateForm.addEventListener('submit', (e) => { e.preventDefault(); lookup(); });
els.suggestions.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  els.plate.value = chip.dataset.plate;
  lookup();
});

/* ---------------- Bước 3: hiển thị phí ---------------- */
function renderQuote() {
  const { session: s, fee, checkOutAt } = quote;
  els.imgIn.src = s.checkInImageUrl;
  els.imgOut.src = quote.checkOutImageUrl;

  const rows = [
    ['Biển số', `<span class="plate">${escapeHtml(s.plateDisplay)}</span>`],
    ['Loại xe', escapeHtml(s.vehicleType.name)],
    ['Giờ vào', escapeHtml(fmt.dateTime(s.checkInAt))],
    ['Giờ ra (tạm tính)', escapeHtml(fmt.dateTime(checkOutAt))],
    ['Thời gian gửi', escapeHtml(fmt.duration(s.checkInAt, checkOutAt))],
    ['Nhân viên nhận xe', escapeHtml(s.checkInByName ?? '')],
  ];
  els.info.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  els.feeItems.innerHTML = fee.items.map((i) => `
    <tr><td>${escapeHtml(i.kind === 'SHORT_STAY' ? i.label : feeItemLabel(i))}</td>
        <td class="num">${escapeHtml(fmt.money(i.amount))}</td></tr>`).join('');
  els.feeTotal.textContent = fmt.money(fee.totalAmount);
  els.feeNote.textContent = `Biểu phí áp dụng: khung thường ${fee.rule.dayStartTime}–${fee.rule.nightStartTime} `
    + `${fmt.money(fee.rule.dayFee)}/lượt, khung đêm ${fmt.money(fee.rule.nightFee)}; gửi ≤ ${fee.rule.shortStayMinutes} phút `
    + `thu ${fee.rule.shortStayPercent}%. Phí được máy chủ tính lại khi xác nhận.`;

  els.feePanel.hidden = false;
  els.btnPay.disabled = false;
  els.feePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function feeItemLabel(i) {
  return `${i.kind === 'DAY' ? 'Khung thường' : 'Khung đêm'}: ${fmt.dateTime(i.from)} → ${fmt.dateTime(i.to)}`;
}

/* ---------------- Xác nhận thu tiền ---------------- */
els.btnPay.addEventListener('click', async () => {
  if (!quote) return;
  const { session: s, fee } = quote;
  const ok = await confirmDialog({
    title: 'Xác nhận đã thu tiền',
    bodyHtml: `<p>Xe <strong class="plate">${escapeHtml(s.plateDisplay)}</strong> (${escapeHtml(s.vehicleType.name)})</p>
               <p class="dialog__amount">${escapeHtml(fmt.money(fee.totalAmount))}</p>
               <p class="muted small">Sau khi xác nhận, lượt gửi sẽ được đóng và không thể thu tiền lại.</p>`,
    confirmText: 'Đã thu tiền',
  });
  if (!ok) return;

  els.payError.hidden = true;
  setButtonLoading(els.btnPay, true, 'Đang lưu...');
  const result = await window.api.request(`/api/sessions/${s.sessionId}/check-out`, {
    method: 'POST',
    body: { recognitionId: recognition.recognitionId, plateNumber: s.plateNumber, expectedAmount: fee.totalAmount },
  });
  setButtonLoading(els.btnPay, false);

  if (!result.ok) {
    els.payError.textContent = result.error.message;
    els.payError.hidden = false;
    if (result.error.code === 'FEE_CHANGED') {
      // Phí thay đổi (ví dụ vừa qua 22:00) → lấy lại báo giá mới để nhân viên xem rồi bấm lại
      await lookup();
      els.payError.textContent = `${result.error.message}`;
      els.payError.hidden = false;
    } else if (['SESSION_NOT_OPEN', 'RECOGNITION_ALREADY_USED', 'RECOGNITION_EXPIRED'].includes(result.error.code)) {
      els.btnPay.disabled = true;
      insideList.load();
    }
    return;
  }

  const closed = result.data.session;
  showToast(`Xe ${closed.plateDisplay} đã ra lúc ${fmt.dateTime(closed.checkOutAt)}. Đã thu ${fmt.money(closed.feeAmount)}.`, 'success', 7000);
  resetAll();
  insideList.load();
});

window.ui.ready.then(() => insideList.load());
})();
