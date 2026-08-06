const express = require('express');
const ExcelJS = require('exceljs');
const { supabase } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function formatWaktuSubmit(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;

  const dateStr = d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const timeStr = d.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\./g, ':');

  return `${dateStr} ${timeStr} WIB`;
}

// Dashboard routes (Public access)

// GET /api/dashboard/harian?tanggal=YYYY-MM-DD
router.get('/harian', async (req, res) => {
  let tanggal = req.query.tanggal;
  if (!tanggal || tanggal.trim() === '') {
    tanggal = new Date().toISOString().split('T')[0];
  }

  try {
    const { data: kelompokList } = await supabase
      .from('kelompok_piket')
      .select('*')
      .order('urutan', { ascending: true });

    const { data: posList } = await supabase
      .from('pos_piket')
      .select('*')
      .order('urutan', { ascending: true });

    const { data: reports } = await supabase
      .from('piket_reports')
      .select('id, pos_id, nama_petugas, tanggal, catatan_lain, waktu_submit')
      .eq('tanggal', tanggal)
      .order('waktu_submit', { ascending: false });

    const reportsByPos = {};
    (reports || []).forEach(r => {
      if (!reportsByPos[r.pos_id]) reportsByPos[r.pos_id] = [];
      reportsByPos[r.pos_id].push(r);
    });

    const result = (kelompokList || []).map(k => {
      const posItems = (posList || []).filter(p => p.kelompok_id === k.id).map(p => ({
        ...p,
        sudah_lapor: !!reportsByPos[p.id],
        jumlah_laporan: reportsByPos[p.id] ? reportsByPos[p.id].length : 0,
        laporan_terakhir: reportsByPos[p.id] ? reportsByPos[p.id][0] : null
      }));

      const total = posItems.length;
      const done = posItems.filter(p => p.sudah_lapor).length;

      return {
        ...k,
        posList: posItems,
        total_pos: total,
        pos_selesai: done,
        persentase: total > 0 ? Math.round((done / total) * 100) : 0
      };
    });

    res.json({ tanggal, kelompok: result });
  } catch (err) {
    console.error('Error harian dashboard:', err);
    res.status(500).json({ error: 'Gagal mengambil data dashboard harian.' });
  }
});

// GET /api/dashboard/detail/:reportId
router.get('/detail/:reportId', async (req, res) => {
  const reportId = req.params.reportId;

  try {
    const { data: report, error: rErr } = await supabase
      .from('piket_reports')
      .select('*, pos_piket(nama, kelompok_piket(nama))')
      .eq('id', reportId)
      .single();

    if (rErr || !report) {
      return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    }

    const { data: responses } = await supabase
      .from('checklist_responses')
      .select('is_checked, checklist_template(item_text, urutan)')
      .eq('report_id', reportId);

    const formattedResponses = (responses || [])
      .map(cr => ({
        is_checked: cr.is_checked,
        item_text: cr.checklist_template ? cr.checklist_template.item_text : '',
        urutan: cr.checklist_template ? cr.checklist_template.urutan : 0
      }))
      .sort((a, b) => a.urutan - b.urutan);

    res.json({
      report: {
        ...report,
        pos_nama: report.pos_piket ? report.pos_piket.nama : '',
        kelompok_nama: (report.pos_piket && report.pos_piket.kelompok_piket) ? report.pos_piket.kelompok_piket.nama : ''
      },
      responses: formattedResponses
    });
  } catch (err) {
    console.error('Error report detail:', err);
    res.status(500).json({ error: 'Gagal mengambil detail laporan.' });
  }
});

// GET /api/dashboard/analitik?dari=YYYY-MM-DD&sampai=YYYY-MM-DD
router.get('/analitik', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  let dari = req.query.dari;
  let sampai = req.query.sampai;

  if (!dari || dari.trim() === '') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    dari = d.toISOString().split('T')[0];
  }
  if (!sampai || sampai.trim() === '') {
    sampai = today;
  }

  try {
    // 1. All pos
    const { data: allPos } = await supabase
      .from('pos_piket')
      .select('id, nama, kelompok_piket(nama)')
      .order('urutan', { ascending: true });

    // 2. All reports in date range
    const { data: reportsInRange } = await supabase
      .from('piket_reports')
      .select('id, pos_id, nama_petugas, tanggal')
      .gte('tanggal', dari)
      .lte('tanggal', sampai);

    const uniqueDays = new Set((reportsInRange || []).map(r => r.tanggal)).size || 1;

    // Kepatuhan per pos
    const kepatuhanPerPos = (allPos || []).map(pos => {
      const posReports = (reportsInRange || []).filter(r => r.pos_id === pos.id);
      const hariLapor = new Set(posReports.map(r => r.tanggal)).size;

      return {
        id: pos.id,
        pos_nama: pos.nama,
        kelompok_nama: pos.kelompok_piket ? pos.kelompok_piket.nama : '',
        hari_lapor: hariLapor,
        total_hari: uniqueDays,
        persentase: Math.round((hariLapor / uniqueDays) * 100)
      };
    });

    // 3. Checklist responses in range for unchecked counts
    const reportIds = (reportsInRange || []).map(r => r.id);
    let uncheckedItems = [];

    if (reportIds.length > 0) {
      const { data: uncheckedRes } = await supabase
        .from('checklist_responses')
        .select('checklist_id, checklist_template(item_text, pos_piket(nama))')
        .in('report_id', reportIds)
        .eq('is_checked', 0);

      const counts = {};
      (uncheckedRes || []).forEach(u => {
        const id = u.checklist_id;
        if (!counts[id]) {
          counts[id] = {
            item_text: u.checklist_template ? u.checklist_template.item_text : '',
            pos_nama: (u.checklist_template && u.checklist_template.pos_piket) ? u.checklist_template.pos_piket.nama : '',
            total_unchecked: 0
          };
        }
        counts[id].total_unchecked += 1;
      });

      uncheckedItems = Object.values(counts)
        .sort((a, b) => b.total_unchecked - a.total_unchecked)
        .slice(0, 10);
    }

    // 4. Rekap petugas
    const petugasMap = {};
    (reportsInRange || []).forEach(r => {
      if (!petugasMap[r.nama_petugas]) {
        petugasMap[r.nama_petugas] = { nama_petugas: r.nama_petugas, total_laporan: 0, dates: new Set() };
      }
      petugasMap[r.nama_petugas].total_laporan += 1;
      petugasMap[r.nama_petugas].dates.add(r.tanggal);
    });

    const rekapPetugas = Object.values(petugasMap)
      .map(p => ({ nama_petugas: p.nama_petugas, total_laporan: p.total_laporan, hari_aktif: p.dates.size }))
      .sort((a, b) => b.total_laporan - a.total_laporan);

    // 5. Tren harian
    const harianMap = {};
    (reportsInRange || []).forEach(r => {
      if (!harianMap[r.tanggal]) {
        harianMap[r.tanggal] = { tanggal: r.tanggal, total_laporan: 0, pos_set: new Set() };
      }
      harianMap[r.tanggal].total_laporan += 1;
      harianMap[r.tanggal].pos_set.add(r.pos_id);
    });

    const trenHarian = Object.values(harianMap)
      .map(h => ({ tanggal: h.tanggal, total_laporan: h.total_laporan, pos_terisi: h.pos_set.size }))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    res.json({
      periode: { dari, sampai },
      total_pos: (allPos || []).length,
      kepatuhan_per_pos: kepatuhanPerPos,
      checklist_sering_unchecked: uncheckedItems,
      rekap_petugas: rekapPetugas,
      tren_harian: trenHarian
    });
  } catch (err) {
    console.error('Error analytics:', err);
    res.status(500).json({ error: 'Gagal mengambil data analitik.' });
  }
});

// GET /api/dashboard/export
router.get('/export', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const dari = req.query.dari || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })();
  const sampai = req.query.sampai || today;

  try {
    let query = supabase
      .from('piket_reports')
      .select('*, pos_piket(nama, kelompok_id, kelompok_piket(nama))')
      .gte('tanggal', dari)
      .lte('tanggal', sampai);

    if (req.query.pos_id) {
      query = query.eq('pos_id', req.query.pos_id);
    }

    const { data: reports } = await query.order('tanggal', { ascending: true });

    let filteredReports = reports || [];

    if (req.query.kelompok_id) {
      filteredReports = filteredReports.filter(r => r.pos_piket && r.pos_piket.kelompok_id == req.query.kelompok_id);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'E-Piket';

    // Sheet 1: Rekap
    const sheetRekap = workbook.addWorksheet('Rekap');
    sheetRekap.mergeCells('A1:F1');
    sheetRekap.getCell('A1').value = 'REKAP MONITORING PEMBIASAAN HARIAN';
    sheetRekap.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFF' } };
    sheetRekap.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };

    sheetRekap.getRow(4).values = ['No', 'Tanggal', 'Kelompok', 'Pos', 'Petugas', 'Waktu Submit'];
    sheetRekap.getRow(4).font = { bold: true };

    sheetRekap.columns = [
      { key: 'no', width: 5 },
      { key: 'tanggal', width: 14 },
      { key: 'kelompok', width: 22 },
      { key: 'pos', width: 35 },
      { key: 'petugas', width: 22 },
      { key: 'waktu', width: 26 }
    ];

    filteredReports.forEach((r, idx) => {
      sheetRekap.addRow({
        no: idx + 1,
        tanggal: r.tanggal,
        kelompok: r.pos_piket && r.pos_piket.kelompok_piket ? r.pos_piket.kelompok_piket.nama : '',
        pos: r.pos_piket ? r.pos_piket.nama : '',
        petugas: r.nama_petugas,
        waktu: formatWaktuSubmit(r.waktu_submit)
      });
    });

    // Sheet 2: Detail
    const sheetDetail = workbook.addWorksheet('Detail');
    sheetDetail.mergeCells('A1:G1');
    sheetDetail.getCell('A1').value = 'DETAIL CHECKLIST MONITORING';
    sheetDetail.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFF' } };
    sheetDetail.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } };

    sheetDetail.getRow(3).values = ['Tanggal', 'Kelompok', 'Pos', 'Petugas', 'Checklist Item', 'Status', 'Catatan'];
    sheetDetail.getRow(3).font = { bold: true };

    sheetDetail.columns = [
      { key: 'tanggal', width: 14 },
      { key: 'kelompok', width: 22 },
      { key: 'pos', width: 35 },
      { key: 'petugas', width: 22 },
      { key: 'item', width: 50 },
      { key: 'status', width: 10 },
      { key: 'catatan', width: 30 }
    ];

    for (const r of filteredReports) {
      const { data: responses } = await supabase
        .from('checklist_responses')
        .select('is_checked, checklist_template(item_text, urutan)')
        .eq('report_id', r.id);

      const sortedResp = (responses || []).sort((a, b) =>
        (a.checklist_template?.urutan || 0) - (b.checklist_template?.urutan || 0)
      );

      sortedResp.forEach((resp, idx) => {
        sheetDetail.addRow({
          tanggal: idx === 0 ? r.tanggal : '',
          kelompok: idx === 0 ? (r.pos_piket?.kelompok_piket?.nama || '') : '',
          pos: idx === 0 ? (r.pos_piket?.nama || '') : '',
          petugas: idx === 0 ? r.nama_petugas : '',
          item: resp.checklist_template?.item_text || '',
          status: resp.is_checked ? '✅' : '❌',
          catatan: idx === 0 ? (r.catatan_lain || '') : ''
        });
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Monitoring_Piket_${dari}_${sampai}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error export Excel:', err);
    res.status(500).json({ error: 'Gagal mengekspor data Excel.' });
  }
});

module.exports = router;
