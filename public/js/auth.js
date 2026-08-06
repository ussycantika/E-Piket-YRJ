/* ============================================
   E-Piket — Auth Logic
   Login, logout, session check
   ============================================ */

// Check auth on dashboard page
document.addEventListener('DOMContentLoaded', () => {
  const isDashboard = window.location.pathname.includes('dashboard');
  const isLogin = window.location.pathname.includes('login');

  if (isDashboard) {
    checkAuth();
  }

  if (isLogin) {
    // If already logged in, redirect to dashboard
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          window.location.href = 'dashboard.html';
        }
      })
      .catch(() => {});
  }
});

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (!data.authenticated) {
      window.location.href = 'login.html';
      return;
    }

    // Set user name
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
      userNameEl.textContent = data.user.nama;
    }
  } catch (err) {
    window.location.href = 'login.html';
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('btnLogin');
  const btnText = btn.querySelector('.btn-text');
  const btnLoading = btn.querySelector('.btn-loading');

  // Reset error
  errorEl.style.display = 'none';

  if (!username || !password) {
    errorEl.textContent = 'Mohon isi username dan password.';
    errorEl.style.display = 'block';
    return;
  }

  // Loading
  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline-flex';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      window.location.href = 'dashboard.html';
    } else {
      errorEl.textContent = data.error || 'Login gagal.';
      errorEl.style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = 'Terjadi kesalahan koneksi.';
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {}
  window.location.href = 'login.html';
}

function togglePassword() {
  const input = document.getElementById('password');
  const btn = document.getElementById('btnTogglePassword');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}
