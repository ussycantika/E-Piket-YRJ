const express = require('express');
const { supabase } = require('../db/database');

const router = express.Router();

// GET /api/piket/kelompok — Ambil semua kelompok + pos
router.get('/kelompok', async (req, res) => {
  try {
    const { data: kelompokList, error: kErr } = await supabase
      .from('kelompok_piket')
      .select('*')
      .order('urutan', { ascending: true });

    if (kErr) throw kErr;

    const { data: posList, error: pErr } = await supabase
      .from('pos_piket')
      .select('*')
      .order('urutan', { ascending: true });

    if (pErr) throw pErr;

    const result = kelompokList.map(k => ({
      ...k,
      posList: posList.filter(p => p.kelompok_id === k.id)
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching kelompok:', err);
    res.status(500).json({ error: 'Gagal mengambil data kelompok piket.' });
  }
});

// GET /api/piket/pos/:id/checklist — Ambil checklist template per pos
router.get('/pos/:id/checklist', async (req, res) => {
  const posId = req.params.id;

  try {
    const { data: pos, error: posErr } = await supabase
      .from('pos_piket')
      .select('id, nama, kelompok_id, kelompok_piket(nama)')
      .eq('id', posId)
      .single();

    if (posErr || !pos) {
      return res.status(404).json({ error: 'Pos tidak ditemukan.' });
    }

    const { data: checklist, error: cErr } = await supabase
      .from('checklist_template')
      .select('id, item_text, urutan')
      .eq('pos_id', posId)
      .order('urutan', { ascending: true });

    if (cErr) throw cErr;

    res.json({
      pos: {
        id: pos.id,
        nama: pos.nama,
        kelompok_id: pos.kelompok_id,
        kelompok_nama: pos.kelompok_piket ? pos.kelompok_piket.nama : ''
      },
      checklist
    });
  } catch (err) {
    console.error('Error fetching checklist:', err);
    res.status(500).json({ error: 'Gagal mengambil checklist.' });
  }
});

// POST /api/piket/reports — Submit laporan piket (tanpa auth)
router.post('/reports', async (req, res) => {
  const { pos_id, nama_petugas, tanggal, checklist_items, catatan_lain } = req.body;

  if (!pos_id || !nama_petugas || !tanggal) {
    return res.status(400).json({ error: 'pos_id, nama_petugas, dan tanggal harus diisi.' });
  }

  try {
    // 1. Check pos exists
    const { data: pos, error: posErr } = await supabase
      .from('pos_piket')
      .select('id')
      .eq('id', pos_id)
      .single();

    if (posErr || !pos) {
      return res.status(404).json({ error: 'Pos tidak ditemukan.' });
    }

    // 2. Insert piket_report
    const { data: reportData, error: rErr } = await supabase
      .from('piket_reports')
      .insert([{
        pos_id: parseInt(pos_id),
        nama_petugas,
        tanggal,
        catatan_lain: catatan_lain || null
      }])
      .select();

    if (rErr) throw rErr;
    const reportId = reportData[0].id;

    // 3. Get all checklist items for this pos
    const { data: allItems, error: itemsErr } = await supabase
      .from('checklist_template')
      .select('id')
      .eq('pos_id', pos_id);

    if (itemsErr) throw itemsErr;

    const checkedIds = new Set((checklist_items || []).map(Number));

    const responsesToInsert = allItems.map(item => ({
      report_id: reportId,
      checklist_id: item.id,
      is_checked: checkedIds.has(item.id) ? 1 : 0
    }));

    const { error: respErr } = await supabase
      .from('checklist_responses')
      .insert(responsesToInsert);

    if (respErr) throw respErr;

    res.json({ success: true, reportId });
  } catch (err) {
    console.error('Error submitting report:', err);
    res.status(500).json({ error: 'Gagal menyimpan laporan.' });
  }
});

module.exports = router;
