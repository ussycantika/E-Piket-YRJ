/* ============================================
   E-Piket — Dashboard Logic
   Harian overview, analytics, charts, export
   ============================================ */

let chartTren = null;
let chartKepatuhan = null;
let kelompokDataCache = [];

// ---- Initialize Default Date Inputs ----

function ensureDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dariStr = thirtyDaysAgo.toISOString().split('T')[0];

  const tglDash = document.getElementById('tanggalDashboard');
  if (tglDash && !tglDash.value) tglDash.value = today;

  const dariEl = document.getElementById('analitikDari');
  const sampaiEl = document.getElementById('analitikSampai');
  const expDari = document.getElementById('eksporDari');
  const expSampai = document.getElementById('eksporSampai');

  if (dariEl && !dariEl.value) dariEl.value = dariStr;
  if (sampaiEl && !sampaiEl.value) sampaiEl.value = today;
  if (expDari && !expDari.value) expDari.value = dariStr;
  if (expSampai && !expSampai.value) expSampai.value = today;
}

document.addEventListener('DOMContentLoaded', () => {
  ensureDefaultDates();

  // Always load dashboard data on DOM ready
  loadDashboardHarian();
});

function setToday() {
  const tglDash = document.getElementById('tanggalDashboard');
  if (tglDash) tglDash.value = new Date().toISOString().split('T')[0];
  loadDashboardHarian();
}

// ---- Dashboard Harian ----

async function loadDashboardHarian() {
  ensureDefaultDates();

  const gridEl = document.getElementById('kelompokGridDashboard') || document.getElementById('kelompokGrid');
  const summaryEl = document.getElementById('summaryCards');

  // Render shimmer skeleton cards immediately while fetching
  if (summaryEl && (!summaryEl.children || summaryEl.children.length === 0)) {
    summaryEl.innerHTML = `
      <div class="kpi-card kpi-skeleton"></div>
      <div class="kpi-card kpi-skeleton"></div>
    `;
  }
  if (gridEl && (!gridEl.children || gridEl.children.length === 0)) {
    gridEl.innerHTML = `
      <div class="skeleton-grid-placeholder">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    `;
  }

  const input = document.getElementById('tanggalDashboard');
  const today = new Date().toISOString().split('T')[0];
  const tanggal = (input && input.value) ? input.value : today;

  try {
    const res = await fetch(`/api/dashboard/harian?tanggal=${tanggal}`);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    renderDashboardHarian(data);
  } catch (err) {
    console.error('Error loading dashboard:', err);
    const gridEl = document.getElementById('kelompokGridDashboard') || document.getElementById('kelompokGrid');
    if (gridEl) {
      gridEl.innerHTML = `
        <div class="empty-state-wrap">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Gagal Memuat Data</div>
          <div class="empty-state-desc">Terjadi kesalahan koneksi data (${err.message}).</div>
          <button class="btn btn-primary btn-sm" onclick="loadDashboardHarian()">Coba Lagi</button>
        </div>
      `;
    }
  }
}

function renderDashboardHarian(data) {
  const gridEl = document.getElementById('kelompokGridDashboard') || document.getElementById('kelompokGrid');
  const summaryEl = document.getElementById('summaryCards');

  if (!data || !data.kelompok || data.kelompok.length === 0) {
    if (gridEl) {
      gridEl.innerHTML = `
        <div class="empty-state-wrap">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">Belum Ada Laporan Piket</div>
          <div class="empty-state-desc">Belum ada pos piket yang mengirimkan laporan pada tanggal ini.</div>
          <button class="btn btn-primary btn-sm" onclick="switchTab('form')">Isi Laporan Piket Sekarang</button>
        </div>
      `;
    }
    if (summaryEl) summaryEl.innerHTML = '';
    return;
  }

  // Calculate totals
  let totalPos = 0, totalDone = 0;
  data.kelompok.forEach(k => {
    totalPos += k.total_pos || 0;
    totalDone += k.pos_selesai || 0;
  });
  const totalPending = totalPos - totalDone;

  // 1. Render Big KPI Metric Summary Cards
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="kpi-card card-accent-green">
        <div class="kpi-val text-success">${totalDone}<span style="font-size:1.2rem; color:var(--text-muted)">/${totalPos}</span></div>
        <div class="kpi-title">Pos Sudah Lapor</div>
      </div>
      <div class="kpi-card card-accent-red">
        <div class="kpi-val" style="color:var(--danger)">${totalPending}</div>
        <div class="kpi-title">Pos Belum Lapor</div>
      </div>
    `;
  }

  // 2. Render Kelompok Grid in 3 flex columns
  const columns = [[], [], []];
  data.kelompok.forEach((k, idx) => {
    if (idx === 0 || idx === 3) columns[0].push(k);
    else if (idx === 1 || idx === 4) columns[1].push(k);
    else columns[2].push(k);
  });

  if (gridEl) {
    gridEl.innerHTML = `
      <div class="kelompok-grid-columns">
        ${columns.map(colItems => `
          <div class="kelompok-column">
            ${colItems.map(k => `
              <div class="kelompok-section">
                <div class="kelompok-header-bar">
                  <span class="kelompok-bar-title">${k.nama} (${k.pos_selesai}/${k.total_pos})</span>
                </div>
                <div class="pos-list">
                  ${k.posList.map(p => {
                    const isReported = p.sudah_lapor && p.laporan_terakhir;
                    const posBadgeClass = isReported ? 'status-complete' : 'status-pending';
                    const posBadgeText = isReported ? 'Sudah Lapor' : 'Belum Lapor';

                    return `
                      <div class="pos-item" onclick="${isReported ? `viewReportDetail(${p.laporan_terakhir.id})` : ''}">
                        <div class="pos-info">
                          <div>
                            <div class="pos-name">${p.nama}</div>
                            <div class="pos-detail">
                              ${isReported
                                ? `${formatTime(p.laporan_terakhir.waktu_submit)} Petugas: ${p.laporan_terakhir.nama_petugas}`
                                : 'Belum ada laporan petugas'}
                            </div>
                          </div>
                        </div>
                        <div class="pos-action-group">
                          <span class="status-badge ${posBadgeClass}">
                            ${posBadgeText}
                          </span>
                          ${isReported ? '<span class="pos-action">Lihat detail</span>' : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }
}

// ---- Report Detail Modal ----

async function viewReportDetail(reportId) {
  try {
    const res = await fetch(`/api/dashboard/detail/${reportId}`);
    const data = await res.json();
    renderDetailModal(data);
  } catch (err) {
    console.error('Error loading detail:', err);
  }
}

function renderDetailModal(data) {
  const modal = document.getElementById('detailModal');
  const body = document.getElementById('modalBody');
  const title = document.getElementById('modalTitle');

  title.textContent = `${data.report.pos_nama}`;

  const checkedCount = data.responses.filter(r => r.is_checked).length;
  const totalCount = data.responses.length;

  body.innerHTML = `
    <div class="modal-info-row">
      <span class="label">Kelompok</span>
      <span class="value">${data.report.kelompok_nama}</span>
    </div>
    <div class="modal-info-row">
      <span class="label">Petugas</span>
      <span class="value">${data.report.nama_petugas}</span>
    </div>
    <div class="modal-info-row">
      <span class="label">Tanggal</span>
      <span class="value">${data.report.tanggal}</span>
    </div>
    <div class="modal-info-row">
      <span class="label">Waktu Submit</span>
      <span class="value">${formatTime(data.report.waktu_submit)}</span>
    </div>
    <div class="modal-info-row">
      <span class="label">Checklist</span>
      <span class="value">${checkedCount}/${totalCount} tercentang</span>
    </div>
    ${data.report.catatan_lain ? `
      <div class="modal-info-row">
        <span class="label">Catatan Lain</span>
        <span class="value">${data.report.catatan_lain}</span>
      </div>
    ` : ''}
    
    <div class="modal-checklist">
      <h4>Detail Checklist</h4>
      ${data.responses.map(r => `
        <div class="modal-check-item">
          <span class="check-icon ${r.is_checked ? 'done' : 'miss'}">${r.is_checked ? '✅' : '❌'}</span>
          <span>${r.item_text}</span>
        </div>
      `).join('')}
    </div>
  `;

  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('detailModal').style.display = 'none';
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.id === 'detailModal') {
    closeModal();
  }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ---- Analytics ----

async function loadAnalitik() {
  const dariEl = document.getElementById('analitikDari');
  const sampaiEl = document.getElementById('analitikSampai');

  const today = new Date().toISOString().split('T')[0];
  if (sampaiEl && !sampaiEl.value) {
    sampaiEl.value = today;
  }
  if (dariEl && !dariEl.value) {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    dariEl.value = d.toISOString().split('T')[0];
  }

  const dari = dariEl ? dariEl.value : '';
  const sampai = sampaiEl ? sampaiEl.value : '';

  try {
    const res = await fetch(`/api/dashboard/analitik?dari=${dari}&sampai=${sampai}`);
    const data = await res.json();
    renderAnalitik(data);
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

function renderAnalitik(data) {
  // 1. Tren chart
  renderTrenChart(data.tren_harian, data.total_pos);

  // 2. Kepatuhan chart
  renderKepatuhanChart(data.kepatuhan_per_pos);

  // 3. Unchecked list
  renderUncheckedList(data.checklist_sering_unchecked);

  // 4. Petugas table
  renderPetugasTable(data.rekap_petugas);
}

function renderTrenChart(tren, totalPos) {
  const ctx = document.getElementById('chartTren').getContext('2d');

  if (chartTren) chartTren.destroy();

  chartTren = new Chart(ctx, {
    type: 'line',
    data: {
      labels: tren.map(t => formatDateShort(t.tanggal)),
      datasets: [
        {
          label: 'Pos Terisi',
          data: tren.map(t => t.pos_terisi),
          borderColor: '#6366F1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#6366F1'
        },
        {
          label: 'Total Laporan',
          data: tren.map(t => t.total_laporan),
          borderColor: '#06B6D4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#06B6D4'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#9CA3AF', font: { family: 'Plus Jakarta Sans' } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#6B7280', font: { family: 'Plus Jakarta Sans', size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#6B7280', font: { family: 'Plus Jakarta Sans', size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

function renderKepatuhanChart(kepatuhan) {
  const ctx = document.getElementById('chartKepatuhan').getContext('2d');

  if (chartKepatuhan) chartKepatuhan.destroy();

  // Take top 10
  const topData = kepatuhan.slice(0, 10);

  chartKepatuhan = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topData.map(k => truncateText(k.pos_nama, 18)),
      datasets: [{
        label: 'Kepatuhan (%)',
        data: topData.map(k => k.persentase),
        backgroundColor: topData.map(k =>
          k.persentase >= 80 ? 'rgba(16, 185, 129, 0.7)' :
          k.persentase >= 50 ? 'rgba(245, 158, 11, 0.7)' :
          'rgba(239, 68, 68, 0.7)'
        ),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#6B7280', font: { family: 'Plus Jakarta Sans', size: 11 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: '#9CA3AF', font: { family: 'Plus Jakarta Sans', size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

function renderUncheckedList(items) {
  const container = document.getElementById('uncheckedList');

  if (items.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); padding: 1rem; text-align: center;">Tidak ada data untuk periode ini</p>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="unchecked-item">
      <div class="unchecked-info">
        <div class="unchecked-text">${item.item_text}</div>
        <div class="unchecked-pos">${item.pos_nama}</div>
      </div>
      <span class="unchecked-count">${item.total_unchecked}×</span>
    </div>
  `).join('');
}

function renderPetugasTable(petugas) {
  const tbody = document.querySelector('#tablePetugas tbody');

  if (petugas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Tidak ada data</td></tr>`;
    return;
  }

  tbody.innerHTML = petugas.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.nama_petugas}</td>
      <td>${p.total_laporan}</td>
      <td>${p.hari_aktif} hari</td>
    </tr>
  `).join('');
}

// ---- Export ----

async function loadKelompokForExport() {
  try {
    const res = await fetch('/api/piket/kelompok');
    kelompokDataCache = await res.json();

    const select = document.getElementById('eksporKelompok');
    kelompokDataCache.forEach(k => {
      const option = document.createElement('option');
      option.value = k.id;
      option.textContent = k.nama;
      select.appendChild(option);
    });

    // Update pos on kelompok change
    select.addEventListener('change', () => {
      updateExportPos(select.value);
    });
  } catch (err) {
    console.error('Error loading kelompok:', err);
  }
}

function updateExportPos(kelompokId) {
  const posSelect = document.getElementById('eksporPos');
  posSelect.innerHTML = '<option value="">Semua Pos</option>';

  if (!kelompokId) return;

  const kelompok = kelompokDataCache.find(k => k.id == kelompokId);
  if (kelompok) {
    kelompok.posList.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.nama;
      posSelect.appendChild(option);
    });
  }
}

function downloadExcel() {
  const dariEl = document.getElementById('eksporDari');
  const sampaiEl = document.getElementById('eksporSampai');
  const kelompokEl = document.getElementById('eksporKelompok');
  const posEl = document.getElementById('eksporPos');

  const dari = dariEl ? dariEl.value : '';
  const sampai = sampaiEl ? sampaiEl.value : '';
  const kelompokId = kelompokEl ? kelompokEl.value : '';
  const posId = posEl ? posEl.value : '';

  if (!dari || !sampai) {
    if (typeof showToast === 'function') {
      showToast('Mohon isi tanggal mulai dan akhir.', 'error');
    } else {
      alert('Mohon isi tanggal mulai dan akhir.');
    }
    return;
  }

  let url = `/api/dashboard/export?dari=${dari}&sampai=${sampai}`;
  if (kelompokId) url += `&kelompok_id=${kelompokId}`;
  if (posId) url += `&pos_id=${posId}`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Monitoring_Piket_${dari}_${sampai}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ---- Utilities ----

function formatTime(datetime) {
  if (!datetime) return '-';
  const d = new Date(datetime);
  if (isNaN(d.getTime())) {
    // If it's already a string like "2026-08-04 10:30:00"
    return datetime.split(' ').pop() || datetime;
  }
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(dateStr) {
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}`;
}

function truncateText(text, maxLen) {
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}
