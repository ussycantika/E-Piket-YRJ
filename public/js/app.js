/* ============================================
   E-Piket — Single Page Application (SPA) Controller
   Unified Public Access & Top Navigation
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  let hash = window.location.hash.replace('#', '') || 'dashboard';
  if (hash === 'harian' || hash === 'analitik') hash = 'dashboard';
  switchTab(hash);
});

function switchTab(tabName) {
  const validTabs = ['form', 'dashboard'];
  let currentTab = validTabs.includes(tabName) ? tabName : 'dashboard';

  validTabs.forEach(t => {
    const navBtn = document.getElementById(`nav-${t}`);
    if (navBtn) navBtn.classList.remove('active');
    const mobileNavBtn = document.getElementById(`mobile-nav-${t}`);
    if (mobileNavBtn) mobileNavBtn.classList.remove('active');
  });

  const targetNav = document.getElementById(`nav-${currentTab}`);
  if (targetNav) targetNav.classList.add('active');

  const targetMobileNav = document.getElementById(`mobile-nav-${currentTab}`);
  if (targetMobileNav) targetMobileNav.classList.add('active');

  showTabSection(`tab-${currentTab}`);
  window.location.hash = currentTab;

  if (currentTab === 'dashboard') {
    if (typeof loadDashboardHarian === 'function') loadDashboardHarian();
  }
}

function showTabSection(sectionId) {
  const allSections = document.querySelectorAll('.tab-content');
  allSections.forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active');
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }
}

function toggleMobileSidebar() {
  const drawer = document.getElementById('mobile-sidebar-drawer');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  if (drawer && overlay) {
    drawer.classList.toggle('open');
    overlay.classList.toggle('open');
  }
}

function closeMobileSidebar() {
  const drawer = document.getElementById('mobile-sidebar-drawer');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  if (drawer && overlay) {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  }
}
