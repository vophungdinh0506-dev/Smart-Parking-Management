/**
 * Trang BIỂU PHÍ
 * - Mọi nhân viên: xem biểu phí đang áp dụng, lịch sử, thử tính phí
 * - ADMIN: sửa biểu phí (tạo phiên bản mới). Backend kiểm tra quyền — ẩn nút ở đây chỉ để gọn giao diện.
 */
(() => {
const { escapeHtml, showToast, setButtonLoading } = window.ui;
const { confirmDialog } = window.components;
const fmt = window.format;
const $ = (id) => document.getElementById(id);

let currentUser = null;
let rules = [];

function ruleSummary(r) {
  return `
    <dl class="info-grid">
      <div><dt>Khung thường</dt><dd>${escapeHtml(r.dayStartTime)} – ${escapeHtml(r.nightStartTime)}</dd></div>
      <div><dt>Phí 1 lượt khung thường</dt><dd>${escapeHtml(fmt.money(r.dayFee))}</dd></div>
      <div><dt>Khung đêm</dt><dd>${escapeHtml(r.nightStartTime)} – ${escapeHtml(r.dayStartTime)} hôm sau</dd></div>
      <div><dt>Phí trọn gói khung đêm</dt><dd>${escapeHtml(fmt.money(r.nightFee))}</dd></div>
      <div><dt>Gửi ngắn</dt><dd>≤ ${r.shortStayMinutes} phút: ${r.shortStayPercent}% phí khung thường
        (${escapeHtml(fmt.money(Math.round(r.dayFee * r.shortStayPercent / 100)))})</dd></div>
      <div><dt>Áp dụng từ</dt><dd>${escapeHtml(fmt.dateTime(r.createdAt))}${r.createdByName ? ` · ${escapeHtml(r.createdByName)}` : ''}</dd></div>
    </dl>`;
}

function editForm(r) {
  const f = (name, label, value, attrs) => `
    <div class="field"><label for="${name}-${r.vehicleTypeId}">${label}</label>
      <input id="${name}-${r.vehicleTypeId}" name="${name}" value="${escapeHtml(value)}" ${attrs} required></div>`;
  return `
    <form class="rule-form" data-vt="${r.vehicleTypeId}" hidden novalidate>
      <div class="form-grid">
        ${f('dayStartTime', 'Bắt đầu khung thường', r.dayStartTime, 'type="time"')}
        ${f('nightStartTime', 'Bắt đầu khung đêm', r.nightStartTime, 'type="time"')}
        ${f('dayFee', 'Phí khung thường (đ)', r.dayFee, 'type="number" min="0" step="500" inputmode="numeric"')}
        ${f('nightFee', 'Phí khung đêm (đ)', r.nightFee, 'type="number" min="0" step="500" inputmode="numeric"')}
        ${f('shortStayMinutes', 'Gửi ngắn tối đa (phút)', r.shortStayMinutes, 'type="number" min="0" max="1440"')}
        ${f('shortStayPercent', '% phí khi gửi ngắn', r.shortStayPercent, 'type="number" min="0" max="100"')}
      </div>
      <div class="alert alert--error form-error" role="alert" hidden></div>
      <div class="actions">
        <button class="btn btn--primary" type="submit">Lưu biểu phí mới</button>
        <button class="btn btn--secondary btn-cancel-edit" type="button">Hủy</button>
      </div>
    </form>`;
}

async function loadRules() {
  const result = await window.api.request('/api/pricing-rules');
  const container = $('rule-cards');
  if (!result.ok) {
    container.innerHTML = `<div class="alert alert--error">${escapeHtml(result.error.message)}</div>`;
    return;
  }
  rules = result.data.items;
  const isAdmin = currentUser.role === 'ADMIN';
  container.innerHTML = rules.map((r) => `
    <section class="card" aria-labelledby="rule-title-${r.vehicleTypeId}">
      <div class="card__header">
        <h2 id="rule-title-${r.vehicleTypeId}">${escapeHtml(r.vehicleType.name)}</h2>
        ${isAdmin ? `<button class="btn btn--secondary btn--small btn-edit" type="button" data-vt="${r.vehicleTypeId}">Sửa biểu phí</button>` : ''}
      </div>
      <div class="rule-summary">${ruleSummary(r)}</div>
      ${isAdmin ? editForm(r) : ''}
      <details class="history" data-vt="${r.vehicleTypeId}">
        <summary>Lịch sử thay đổi</summary>
        <div class="history__body muted small">Đang tải...</div>
      </details>
    </section>`).join('');

  const selected = $('sim-type').value; // giữ lựa chọn cũ khi tải lại
  $('sim-type').innerHTML = rules.map((r) => `<option value="${r.vehicleTypeId}">${escapeHtml(r.vehicleType.name)}</option>`).join('');
  if (selected) $('sim-type').value = selected;
}

/* ---------- Sửa biểu phí (ADMIN) ---------- */
$('rule-cards').addEventListener('click', (e) => {
  const edit = e.target.closest('.btn-edit');
  if (edit) {
    const card = edit.closest('.card');
    card.querySelector('.rule-form').hidden = false;
    card.querySelector('.rule-summary').hidden = true;
    edit.hidden = true;
    card.querySelector('.rule-form input').focus();
  }
  if (e.target.closest('.btn-cancel-edit')) loadRules();
});

$('rule-cards').addEventListener('submit', async (e) => {
  const form = e.target.closest('.rule-form');
  if (!form) return;
  e.preventDefault();
  const vt = Number(form.dataset.vt);
  const old = rules.find((r) => r.vehicleTypeId === vt);
  const data = Object.fromEntries(new FormData(form));
  const body = {
    vehicleTypeId: vt,
    dayStartTime: data.dayStartTime, nightStartTime: data.nightStartTime,
    dayFee: Number(data.dayFee), nightFee: Number(data.nightFee),
    shortStayMinutes: Number(data.shortStayMinutes), shortStayPercent: Number(data.shortStayPercent),
  };
  const errBox = form.querySelector('.form-error');
  errBox.hidden = true;

  const ok = await confirmDialog({
    title: `Đổi biểu phí ${old.vehicleType.name}?`,
    bodyHtml: `<p>Khung thường ${escapeHtml(body.dayStartTime)}–${escapeHtml(body.nightStartTime)}: <strong>${escapeHtml(fmt.money(body.dayFee))}</strong>
               (trước: ${escapeHtml(fmt.money(old.dayFee))})</p>
               <p>Khung đêm: <strong>${escapeHtml(fmt.money(body.nightFee))}</strong> (trước: ${escapeHtml(fmt.money(old.nightFee))})</p>
               <p>Gửi ngắn ≤ ${body.shortStayMinutes} phút: ${body.shortStayPercent}%</p>
               <p class="muted small">Chỉ áp dụng cho xe vào sau thời điểm này. Biểu phí cũ được lưu lại trong lịch sử.</p>`,
    confirmText: 'Lưu biểu phí',
  });
  if (!ok) return;

  const btn = form.querySelector('button[type="submit"]');
  setButtonLoading(btn, true, 'Đang lưu...');
  const result = await window.api.request('/api/pricing-rules', { method: 'POST', body });
  setButtonLoading(btn, false);
  if (!result.ok) {
    errBox.textContent = result.error.message;
    errBox.hidden = false;
    const field = result.error.details?.field;
    if (field) form.querySelector(`[name="${field}"]`)?.focus();
    return;
  }
  showToast(`Đã cập nhật biểu phí ${old.vehicleType.name}`, 'success');
  loadRules();
});

/* ---------- Lịch sử ---------- */
$('rule-cards').addEventListener('toggle', async (e) => {
  const details = e.target;
  if (!details.matches?.('details.history') || !details.open) return;
  const body = details.querySelector('.history__body');
  const result = await window.api.request(`/api/pricing-rules/history?vehicleTypeId=${details.dataset.vt}`);
  if (!result.ok) { body.textContent = result.error.message; return; }
  body.innerHTML = `
    <table class="fee-table">
      <thead><tr><th>Áp dụng từ</th><th>Khung</th><th class="num">Thường</th><th class="num">Đêm</th><th>Gửi ngắn</th><th>Trạng thái</th></tr></thead>
      <tbody>${result.data.items.map((r) => `
        <tr><td>${escapeHtml(fmt.dateTime(r.createdAt))}</td>
            <td>${escapeHtml(r.dayStartTime)}–${escapeHtml(r.nightStartTime)}</td>
            <td class="num">${escapeHtml(fmt.money(r.dayFee))}</td>
            <td class="num">${escapeHtml(fmt.money(r.nightFee))}</td>
            <td>≤${r.shortStayMinutes}′ · ${r.shortStayPercent}%</td>
            <td>${r.isActive ? '<span class="badge badge--ok">Đang áp dụng</span>' : '<span class="muted">Cũ</span>'}</td></tr>`).join('')}
      </tbody>
    </table>`;
}, true);

/* ---------- Thử tính phí ---------- */
// Đổi đầu vào → ẩn kết quả cũ để không nhìn nhầm
['sim-type', 'sim-in', 'sim-out'].forEach((id) => $(id).addEventListener('change', () => { $('sim-result').hidden = true; }));
function toLocalInput(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
$('sim-in').value = toLocalInput(new Date(Date.now() - 3 * 3600 * 1000));
$('sim-out').value = toLocalInput(new Date());

$('sim-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errBox = $('sim-error');
  errBox.hidden = true;
  $('sim-result').hidden = true;
  const inVal = $('sim-in').value;
  const outVal = $('sim-out').value;
  if (!inVal || !outVal) {
    errBox.textContent = 'Vui lòng chọn giờ vào và giờ ra';
    errBox.hidden = false;
    return;
  }
  const btn = $('btn-sim');
  setButtonLoading(btn, true, 'Đang tính...');
  const result = await window.api.request('/api/pricing-rules/simulate', {
    method: 'POST',
    body: { vehicleTypeId: Number($('sim-type').value), checkInAt: new Date(inVal).toISOString(), checkOutAt: new Date(outVal).toISOString() },
  });
  setButtonLoading(btn, false);
  if (!result.ok) {
    errBox.textContent = result.error.message;
    errBox.hidden = false;
    return;
  }
  const { fee } = result.data;
  $('sim-items').innerHTML = fee.items.map((i) => `
    <tr><td>${escapeHtml(i.kind === 'SHORT_STAY' ? i.label
      : `${i.kind === 'DAY' ? 'Khung thường' : 'Khung đêm'}: ${fmt.dateTime(i.from)} → ${fmt.dateTime(i.to)}`)}</td>
        <td class="num">${escapeHtml(fmt.money(i.amount))}</td></tr>`).join('');
  $('sim-total').textContent = `${fmt.money(fee.totalAmount)}`;
  $('sim-result').hidden = false;
});

window.ui.ready.then((user) => {
  currentUser = user;
  loadRules();
});
})();
