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

// Disable cache for static assets to ensure instant updates
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
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
