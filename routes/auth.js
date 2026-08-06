const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../db/database');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password harus diisi.' });
  }

  try {
    const { data: user, error } = await supabase
      .from('supervisors')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.nama = user.nama;

    res.json({
      success: true,
      user: { id: user.id, username: user.username, nama: user.nama }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan sistem.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Gagal logout.' });
    res.json({ success: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        nama: req.session.nama
      }
    });
  }
  res.json({ authenticated: false });
});

module.exports = router;
