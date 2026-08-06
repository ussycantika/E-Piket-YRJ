require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const piketRoutes = require('./routes/piket');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'e-piket-yrj-cilegon-2026-supabase',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 jam
    httpOnly: true
  }
}));

const fs = require('fs');

// Disable cache for static assets to ensure instant updates
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve index.html with pre-filled dynamic date values in server-side HTML response
app.get(['/', '/index.html'], (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  try {
    let html = fs.readFileSync(indexPath, 'utf8');

    const now = new Date();
    const jakartaToday = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const yyyy = jakartaToday.getFullYear();
    const mm = String(jakartaToday.getMonth() + 1).padStart(2, '0');
    const dd = String(jakartaToday.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const thirtyAgo = new Date(jakartaToday.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yyyy2 = thirtyAgo.getFullYear();
    const mm2 = String(thirtyAgo.getMonth() + 1).padStart(2, '0');
    const dd2 = String(thirtyAgo.getDate()).padStart(2, '0');
    const thirtyDaysAgoStr = `${yyyy2}-${mm2}-${dd2}`;

    html = html.replace('id="tanggalDashboard"', `id="tanggalDashboard" value="${todayStr}"`);
    html = html.replace('id="eksporSampai"', `id="eksporSampai" value="${todayStr}"`);
    html = html.replace('id="eksporDari"', `id="eksporDari" value="${thirtyDaysAgoStr}"`);
    html = html.replace('id="analitikSampai"', `id="analitikSampai" value="${todayStr}"`);
    html = html.replace('id="analitikDari"', `id="analitikDari" value="${thirtyDaysAgoStr}"`);
    html = html.replace('id="tanggalPiket"', `id="tanggalPiket" value="${todayStr}"`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (err) {
    res.sendFile(indexPath);
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/piket', piketRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Start server (only if run directly)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🏫 E-Piket Server (Supabase Connected) berjalan di http://localhost:${PORT}`);
    console.log(`📱 App E-Piket Unified: http://localhost:${PORT}/\n`);
  });
}

module.exports = app;
