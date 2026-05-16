// ── SIDEBAR TOGGLE ───────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.querySelector('.topbar-toggle');
  if (sidebar && !sidebar.contains(e.target) && toggle && !toggle.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

// ── CONFIRM DELETE ────────────────────────────────────────
function confirmDelete(msg) {
  return confirm(msg || 'هل أنت متأكد من الحذف؟ لا يمكن التراجع عن هذا.');
}

// ── COLOR PICKER SYNC ─────────────────────────────────────
const colorPicker = document.getElementById('colorPicker');
const colorText   = document.getElementById('colorText');
if (colorPicker && colorText) {
  colorPicker.addEventListener('input', () => { colorText.value = colorPicker.value; });
  colorText.addEventListener('input', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(colorText.value)) {
      colorPicker.value = colorText.value;
    }
  });
}
