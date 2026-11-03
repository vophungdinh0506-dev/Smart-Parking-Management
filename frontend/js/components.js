/**
 * Thành phần giao diện dùng chung cho trang Xe vào và Xe ra:
 *  - createImageIntake : chọn/kéo thả ảnh → gửi nhận diện → trả kết quả
 *  - showRecognition   : hiển thị kết quả nhận diện (trạng thái, ảnh cắt, các biển số gợi ý)
 *  - createInsideList  : danh sách xe đang trong bãi
 *  - confirmDialog     : hộp xác nhận thao tác quan trọng (thay cho window.confirm)
 */
(() => {
const { escapeHtml, showToast, setButtonLoading } = window.ui;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/* ================= Tiếp nhận ảnh ================= */
function createImageIntake({ direction, form, input, dropzone, preview, hint, button, onRecognized, onFileChanged }) {
  let selectedFile = null;
  let previewUrl = null;

  function select(file) {
    onFileChanged?.();
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) return showToast('Chỉ nhận ảnh JPEG, PNG hoặc WebP', 'error');
    if (file.size > MAX_BYTES) return showToast('Ảnh vượt quá 5 MB', 'error');
    selectedFile = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.hidden = false;
    hint.hidden = true;
    dropzone.classList.add('has-image');
    button.disabled = false;
    button.focus();
  }

  input.addEventListener('change', () => select(input.files[0]));
  ['dragenter', 'dragover'].forEach((t) => dropzone.addEventListener(t, (e) => { e.preventDefault(); dropzone.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach((t) => dropzone.addEventListener(t, (e) => { e.preventDefault(); dropzone.classList.remove('is-dragover'); }));
  dropzone.addEventListener('drop', (e) => select(e.dataTransfer.files[0]));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('direction', direction);
    formData.append('image', selectedFile);

    setButtonLoading(button, true, 'Đang nhận diện...');
    input.disabled = true;
    const result = await window.api.request('/api/recognitions', { method: 'POST', formData });
    setButtonLoading(button, false);
    input.disabled = false;

    if (!result.ok) return showToast(result.error.message, 'error', 6000);
    button.disabled = true; // ảnh này đã gửi rồi
    onRecognized(result.data);
  });

  function reset() {
    selectedFile = null;
    form.reset();
    preview.hidden = true;
    preview.removeAttribute('src');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    hint.hidden = false;
    dropzone.classList.remove('has-image');
    button.disabled = true;
  }
  return { reset };
}

/* ================= Hiển thị kết quả nhận diện ================= */
const STATUS_ALERT = {
  SUCCESS: 'alert--success', LOW_CONFIDENCE: 'alert--warn', MULTIPLE: 'alert--warn',
  NOT_FOUND: 'alert--warn', ERROR: 'alert--error',
};

function showRecognition(r, { statusEl, cropWrap, cropImage, candidatesEl, plateInput, onPick }) {
  let message = r.message;
  if (r.confidence !== null && r.confidence !== undefined) message += ` (Độ tin cậy: ${Math.round(r.confidence * 100)}%)`;
  statusEl.className = `alert ${STATUS_ALERT[r.status] ?? 'alert--info'}`;
  statusEl.textContent = message;

  cropWrap.hidden = !r.cropUrl;
  if (r.cropUrl) cropImage.src = r.cropUrl;

  if (r.status === 'MULTIPLE' && r.candidates.length) {
    candidatesEl.innerHTML = '<span class="muted small">Chọn biển số đúng:</span>' + r.candidates.map((c) =>
      `<button type="button" class="chip" data-plate="${escapeHtml(c.plate)}">${escapeHtml(c.plate)}
        ${c.confidence !== null ? `<span class="muted">${Math.round(c.confidence * 100)}%</span>` : ''}</button>`).join('');
    candidatesEl.hidden = false;
    candidatesEl.onclick = (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      plateInput.value = chip.dataset.plate;
      candidatesEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-selected', c === chip));
      onPick?.(chip.dataset.plate);
    };
  } else {
    candidatesEl.hidden = true;
    candidatesEl.innerHTML = '';
  }

  plateInput.value = r.plate ?? '';
  plateInput.classList.toggle('is-warning', r.status !== 'SUCCESS');
}

/* ================= Danh sách xe trong bãi ================= */
function createInsideList({ container, countEl, reloadBtn, onSelect }) {
  async function load() {
    const result = await window.api.request('/api/sessions?status=OPEN&pageSize=20');
    if (!result.ok) {
      container.innerHTML = `<div class="alert alert--error">${escapeHtml(result.error.message)}</div>`;
      return;
    }
    const { items, total } = result.data;
    countEl.textContent = total;
    if (!items.length) {
      container.innerHTML = '<div class="empty">Chưa có xe nào trong bãi.</div>';
      return;
    }
    const tag = onSelect ? 'button' : 'div';
    container.innerHTML = `
      <ul class="vehicle-list">
        ${items.map((s) => `
          <li>
            <${tag} class="vehicle-list__item${onSelect ? ' is-clickable' : ''}" ${onSelect ? `type="button" data-plate="${escapeHtml(s.plateNumber)}" title="Điền biển số này"` : ''}>
              <span>
                <span class="plate">${escapeHtml(s.plateDisplay)}</span>
                <span class="muted small vehicle-list__meta">${escapeHtml(s.vehicleType.name)} · vào ${escapeHtml(window.format.dateTime(s.checkInAt))}
                  ${s.checkInPlateEdited ? ' · <span title="Biển số được nhân viên nhập/sửa tay">sửa tay</span>' : ''}</span>
              </span>
              <span class="muted small">${escapeHtml(window.format.duration(s.checkInAt))}</span>
            </${tag}>
          </li>`).join('')}
      </ul>
      ${total > items.length ? `<p class="muted small">Đang hiện ${items.length}/${total} xe mới nhất.</p>` : ''}`;
  }
  if (onSelect) {
    container.addEventListener('click', (e) => {
      const item = e.target.closest('[data-plate]');
      if (item) onSelect(item.dataset.plate);
    });
  }
  reloadBtn?.addEventListener('click', load);
  return { load };
}

/* ================= Hộp xác nhận ================= */
/** @returns {Promise<boolean>} true nếu người dùng bấm xác nhận */
function confirmDialog({ title, bodyHtml, confirmText = 'Xác nhận', cancelText = 'Quay lại', danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <form method="dialog">
        <h2 class="dialog__title">${escapeHtml(title)}</h2>
        <div class="dialog__body">${bodyHtml}</div>
        <div class="actions dialog__actions">
          <button class="btn btn--secondary" value="cancel" type="submit">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" value="ok" type="submit" autofocus>${escapeHtml(confirmText)}</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok');
      dialog.remove();
    });
    dialog.showModal();
  });
}

/**
 * Hộp thoại có ô nhập liệu. Trả về object { tênTrường: giáTrị } khi bấm xác nhận, null khi hủy.
 * Ô có thuộc tính required được trình duyệt kiểm tra trước khi đóng hộp thoại.
 */
function formDialog({ title, bodyHtml, confirmText = 'Lưu', cancelText = 'Hủy', danger = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    dialog.innerHTML = `
      <form method="dialog">
        <h2 class="dialog__title">${escapeHtml(title)}</h2>
        <div class="dialog__body">${bodyHtml}</div>
        <div class="actions dialog__actions">
          <button class="btn btn--secondary" value="cancel" type="submit" formnovalidate>${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" value="ok" type="submit">${escapeHtml(confirmText)}</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    const form = dialog.querySelector('form');
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok' ? Object.fromEntries(new FormData(form)) : null);
      dialog.remove();
    });
    dialog.showModal();
    dialog.querySelector('input, select, textarea')?.focus();
  });
}

const STATUS_BADGE = {
  OPEN: '<span class="badge badge--info">Đang gửi</span>',
  CLOSED: '<span class="badge badge--ok">Đã ra</span>',
  CANCELLED: '<span class="badge badge--error">Đã hủy</span>',
};

/** Hộp thoại xem chi tiết 1 lượt gửi (ảnh vào/ra, thời gian, phí, lý do hủy) */
async function showSessionDetail(sessionId) {
  const result = await window.api.request(`/api/sessions/${sessionId}`);
  if (!result.ok) return showToast(result.error.message, 'error');
  const s = result.data.session;
  const fmt = window.format;
  const rows = [
    ['Biển số', `<span class="plate">${escapeHtml(s.plateDisplay)}</span>`],
    ['Loại xe', escapeHtml(s.vehicleType.name)],
    ['Trạng thái', STATUS_BADGE[s.status]],
    ['Giờ vào', `${escapeHtml(fmt.dateTime(s.checkInAt))} · ${escapeHtml(s.checkInByName ?? '')}${s.checkInPlateEdited ? ' · sửa tay' : ''}`],
  ];
  if (s.status === 'CLOSED') {
    rows.push(['Giờ ra', `${escapeHtml(fmt.dateTime(s.checkOutAt))} · ${escapeHtml(s.checkOutByName ?? '')}${s.checkOutPlateEdited ? ' · sửa tay' : ''}`]);
    rows.push(['Thời gian gửi', escapeHtml(fmt.duration(s.checkInAt, s.checkOutAt))]);
    rows.push(['Phí đã thu', `<strong>${escapeHtml(fmt.money(s.feeAmount))}</strong>`]);
  } else if (s.status === 'OPEN') {
    rows.push(['Đã gửi', escapeHtml(fmt.duration(s.checkInAt))]);
  } else {
    rows.push(['Hủy lúc', `${escapeHtml(fmt.dateTime(s.cancelledAt))} · ${escapeHtml(s.cancelledByName ?? '')}`]);
    rows.push(['Lý do hủy', escapeHtml(s.cancelReason)]);
  }
  const items = s.feeBreakdown?.items ?? [];
  await confirmDialog({
    title: `Lượt gửi #${s.sessionId}`,
    bodyHtml: `
      <div class="compare">
        <figure><img src="${escapeHtml(s.checkInImageUrl)}" alt="Ảnh xe lúc vào"><figcaption>Lúc vào</figcaption></figure>
        <figure>${s.checkOutImageUrl ? `<img src="${escapeHtml(s.checkOutImageUrl)}" alt="Ảnh xe lúc ra">` : '<div class="compare__empty">Chưa có</div>'}<figcaption>Lúc ra</figcaption></figure>
      </div>
      <dl class="info-grid">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${items.length ? `<table class="fee-table"><tbody>${items.map((i) => `<tr><td>${escapeHtml(i.kind === 'SHORT_STAY' ? 'Gửi ngắn' : i.kind === 'DAY' ? 'Khung thường' : 'Khung đêm')}
        <span class="muted small">${escapeHtml(fmt.dateTime(i.from))} → ${escapeHtml(fmt.dateTime(i.to))}</span></td>
        <td class="num">${escapeHtml(fmt.money(i.amount))}</td></tr>`).join('')}</tbody></table>` : ''}`,
    confirmText: 'Đóng',
    cancelText: 'Quay lại',
  });
}

window.components = { createImageIntake, showRecognition, createInsideList, confirmDialog, formDialog, showSessionDetail, STATUS_BADGE };
})();
