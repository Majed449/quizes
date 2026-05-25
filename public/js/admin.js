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

// ── NATIVE SELECT WRAPPER (Admin-only: wraps native <select> into custom UI) ──
function initNativeSelectWrappers() {
  document.querySelectorAll('select.form-select').forEach(select => {
    // If already converted, skip
    if (select.dataset.nativeWrapped) return;
    select.dataset.nativeWrapped = '1';

    const container = document.createElement('div');
    container.className = 'custom-select-container';
    if (select.id) container.id = 'custom-select-' + select.id;

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.title = select.title || '';
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-expanded', 'false');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'custom-select-value';
    const selectedOption = select.options[select.selectedIndex] || select.options[0];
    labelSpan.textContent = selectedOption ? selectedOption.textContent : '';

    const arrowIcon = document.createElement('i');
    arrowIcon.className = 'fa-solid fa-chevron-down';

    trigger.appendChild(labelSpan);
    trigger.appendChild(arrowIcon);
    container.appendChild(trigger);

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'custom-select-options';
    optionsWrap.setAttribute('role', 'listbox');

    const buildOptions = () => {
      optionsWrap.innerHTML = '';
      Array.from(select.options).forEach((opt, idx) => {
        const optDiv = document.createElement('div');
        optDiv.className = 'custom-select-option';
        if (select.selectedIndex === idx) optDiv.classList.add('selected');
        optDiv.textContent = opt.textContent;
        optDiv.dataset.value = opt.value;
        optDiv.setAttribute('role', 'option');

        optDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          select.value = opt.value;
          select.selectedIndex = idx;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          labelSpan.textContent = opt.textContent;
          optionsWrap.querySelectorAll('.custom-select-option').forEach((o, i) => {
            o.classList.toggle('selected', i === idx);
          });
          container.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
        });

        optionsWrap.appendChild(optDiv);
      });
    };

    buildOptions();
    container.appendChild(optionsWrap);

    // Hide original select but keep it for form submits
    select.style.display = 'none';
    select.parentNode.insertBefore(container, select.nextSibling);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select-container.open').forEach(c => {
        if (c !== container) {
          c.classList.remove('open');
          c.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
        }
      });
      const isOpen = container.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(isOpen));
    });

    select.addEventListener('change', () => {
      const activeOption = select.options[select.selectedIndex];
      labelSpan.textContent = activeOption ? activeOption.textContent : '';
      optionsWrap.querySelectorAll('.custom-select-option').forEach((optDiv, idx) => {
        optDiv.classList.toggle('selected', select.selectedIndex === idx);
      });
    });

    const observer = new MutationObserver(() => {
      buildOptions();
      const activeOption = select.options[select.selectedIndex];
      labelSpan.textContent = activeOption ? activeOption.textContent : '';
    });
    observer.observe(select, { childList: true });
  });
}

// Initialize native select wrappers on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initNativeSelectWrappers();
});
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initNativeSelectWrappers();
}

// NOTE: window.initCustomSelects is set by main.js — do NOT override it here.

// ===== CUSTOM TOAST ALERT OVERRIDE =====
window.alert = function(message) {
  let container = document.getElementById('custom-alert-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'custom-alert-container';
    container.className = 'custom-alert-container';
    document.body.appendChild(container);
  }

  const alertBox = document.createElement('div');
  alertBox.className = 'custom-alert-box';

  let icon = '🔔';
  if (message.includes('⌛') || message.includes('وقت')) icon = '⌛';
  else if (message.includes('خطأ') || message.includes('يرجى') || message.includes('عفواً')) icon = '⚠️';
  else if (message.includes('نجاح') || message.includes('تم')) icon = '✅';

  alertBox.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <span style="font-size: 1.25rem; flex-shrink: 0;">${icon}</span>
      <span>${message}</span>
    </div>
    <button class="custom-alert-close" type="button">✕</button>
  `;

  const dismiss = () => {
    if (alertBox.classList.contains('dismissing')) return;
    alertBox.classList.add('dismissing');
    alertBox.addEventListener('animationend', () => {
      alertBox.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    });
  };

  alertBox.querySelector('.custom-alert-close').addEventListener('click', dismiss);

  container.appendChild(alertBox);

  // Auto-dismiss after 4.5 seconds
  setTimeout(dismiss, 4500);
};
