/* ============================================
   E-Piket — Form Logic (Petugas Piket)
   Multi-step form with dynamic checklist
   ============================================ */

let currentStep = 1;
let kelompokData = [];
let selectedKelompok = null;
let selectedPos = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('tanggalPiket').value = today;

  // Load kelompok data
  loadKelompok();
});

// ---- API Calls ----

async function loadKelompok() {
  try {
    const res = await fetch('/api/piket/kelompok');
    kelompokData = await res.json();
    renderKelompok();
  } catch (err) {
    console.error('Error loading kelompok:', err);
    document.getElementById('kelompokGrid').innerHTML = `
      <div class="error-message">Gagal memuat data. Silakan refresh halaman.</div>
    `;
  }
}

async function loadChecklist(posId) {
  try {
    const res = await fetch(`/api/piket/pos/${posId}/checklist`);
    const data = await res.json();
    renderChecklist(data.checklist);
  } catch (err) {
    console.error('Error loading checklist:', err);
  }
}

// ---- Rendering ----

function renderKelompok() {
  const grid = document.getElementById('kelompokGrid');

  grid.innerHTML = kelompokData.map(k => `
    <div class="select-card" onclick="selectKelompok(${k.id})" data-kelompok-id="${k.id}">
      <h3>${k.nama}</h3>
      ${k.deskripsi ? `<p class="card-desc">${k.deskripsi}</p>` : ''}
    </div>
  `).join('');
}

function renderPos(kelompok) {
  const grid = document.getElementById('posGrid');
  document.getElementById('selectedKelompokName').textContent = kelompok.nama;

  grid.innerHTML = kelompok.posList.map(p => `
    <div class="select-card" onclick="selectPos(${p.id}, '${escapeHtml(p.nama)}')" data-pos-id="${p.id}">
      <h3>${p.nama}</h3>
    </div>
  `).join('');
}

function renderChecklist(items) {
  const container = document.getElementById('checklistContainer');

  container.innerHTML = items.map(item => `
    <div class="checklist-item" onclick="toggleCheck(this)" data-checklist-id="${item.id}">
      <div class="checklist-checkbox"></div>
      <span class="checklist-label">${item.item_text}</span>
    </div>
  `).join('');
}

// ---- User Actions ----

function selectKelompok(id) {
  selectedKelompok = kelompokData.find(k => k.id === id);
  if (selectedKelompok) {
    renderPos(selectedKelompok);
    goToStep(2);
  }
}

function selectPos(id, name) {
  selectedPos = { id, name };
  document.getElementById('selectedPosName').textContent = name;
  document.getElementById('checklistPosName').textContent = name;
  loadChecklist(id);
  goToStep(3);
}

function toggleCheck(el) {
  el.classList.toggle('checked');
}

function handleGlobalBack() {
  if (currentStep > 1) {
    goToStep(currentStep - 1);
  }
}

function handleGlobalNext() {
  if (currentStep < 4) {
    goToStep(currentStep + 1);
  }
}

function goToStep(step) {
  // Validation for step 4
  if (step === 4) {
    const nama = document.getElementById('namaPetugas').value.trim();
    const tanggal = document.getElementById('tanggalPiket').value;
    if (!nama || !tanggal) {
      showToast('Mohon isi nama petugas dan tanggal terlebih dahulu.', 'error');
      return;
    }
  }

  // Hide all steps
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));

  // Show target step
  const targetStep = document.getElementById(`step-${step}`);
  if (targetStep) {
    targetStep.classList.add('active');
    currentStep = step;
  }

  // Update nav arrows container
  const navArrows = document.getElementById('formNavArrows');
  const backBtn = document.getElementById('globalBackBtn');
  const nextBtn = document.getElementById('globalNextBtn');

  if (navArrows) {
    navArrows.style.display = step === 1 ? 'none' : 'flex';
  }
  if (backBtn) {
    backBtn.style.display = step > 1 ? 'inline-flex' : 'none';
  }
  if (nextBtn) {
    nextBtn.style.display = 'none';
  }

  // Update progress
  updateProgress(step);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgress(step) {
  const fill = document.querySelector('.progress-fill');
  const steps = document.querySelectorAll('.progress-steps .step');

  fill.style.width = `${(step / 4) * 100}%`;

  steps.forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 < step) s.classList.add('done');
    if (i + 1 === step) s.classList.add('active');
  });
}

async function submitReport() {
  const btn = document.getElementById('btnSubmit');
  const btnText = btn.querySelector('.btn-text');
  const btnLoading = btn.querySelector('.btn-loading');

  // Gather data
  const nama = document.getElementById('namaPetugas').value.trim();
  const tanggal = document.getElementById('tanggalPiket').value;
  const catatan = document.getElementById('catatanLain').value.trim();

  const checkedItems = [];
  document.querySelectorAll('.checklist-item.checked').forEach(item => {
    checkedItems.push(parseInt(item.dataset.checklistId));
  });

  if (!nama || !tanggal) {
    showToast('Mohon isi nama dan tanggal.', 'error');
    return;
  }

  // Show loading
  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline-flex';

  try {
    const res = await fetch('/api/piket/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pos_id: selectedPos.id,
        nama_petugas: nama,
        tanggal: tanggal,
        checklist_items: checkedItems,
        catatan_lain: catatan || null
      })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Laporan berhasil dikirim!');
      resetForm();
    } else {
      showToast(data.error || 'Gagal mengirim laporan.', 'error');
    }
  } catch (err) {
    console.error('Submit error:', err);
    showToast('Terjadi kesalahan. Silakan coba lagi.', 'error');
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
}

function resetForm() {
  // Reset selections
  selectedKelompok = null;
  selectedPos = null;

  // Reset inputs
  const namaInput = document.getElementById('namaPetugas');
  if (namaInput) namaInput.value = '';
  const tglInput = document.getElementById('tanggalPiket');
  if (tglInput) tglInput.value = new Date().toISOString().split('T')[0];
  const catInput = document.getElementById('catatanLain');
  if (catInput) catInput.value = '';

  // Show step 1
  const successEl = document.getElementById('step-success');
  if (successEl) {
    successEl.style.display = 'none';
    successEl.classList.remove('active');
  }
  goToStep(1);
}

// ---- Utilities ----

function escapeHtml(text) {
  return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function showToast(message, type = 'success') {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '⚠️'} ${message}`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
