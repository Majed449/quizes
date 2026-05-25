// ===== NAVBAR SCROLL EFFECT =====
const navbar = document.querySelector('.navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}


// ===== THEME SELECTOR =====
const themeBtn = document.getElementById('themeBtn');
const themeDropdown = document.getElementById('themeDropdown');

if (themeBtn && themeDropdown) {
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle('active');
  });

  themeDropdown.querySelectorAll('.theme-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const theme = opt.dataset.theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      
      themeDropdown.querySelectorAll('.theme-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      themeDropdown.classList.remove('active');
    });
  });

  document.addEventListener('click', () => {
    themeDropdown.classList.remove('active');
  });

  const currentTheme = localStorage.getItem('theme') || 'dark';
  const activeOpt = themeDropdown.querySelector(`.theme-opt[data-theme="${currentTheme}"]`);
  if (activeOpt) {
    activeOpt.classList.add('active');
  }
}

// ===== NAVBAR MOBILE TOGGLE =====
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.textContent = isOpen ? '✕' : '☰';
    if (isOpen) {
      Object.assign(navLinks.style, {
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        top: '68px',
        right: '0',
        left: '0',
        background: 'color-mix(in srgb, var(--bg) 98%, transparent)',
        backdropFilter: 'blur(20px)',
        padding: '1rem',
        borderBottom: '1px solid rgba(var(--accent-rgb), 0.15)',
        zIndex: '99',
        gap: '0.25rem',
        animation: 'fadeInDown 0.25s ease'
      });
    } else {
      navLinks.removeAttribute('style');
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
      navLinks.removeAttribute('style');
      navToggle.textContent = '☰';
    }
  });
}

// ===== ACTIVE NAV LINK =====
const currentPath = window.location.pathname;
document.querySelectorAll('.nav-link').forEach(link => {
  const href = link.getAttribute('href');
  const isActive = (href === '/' && currentPath === '/') ||
                   (href !== '/' && currentPath.startsWith(href));
  if (isActive) {
    link.style.cssText = 'color: var(--accent); background: rgba(0,212,170,0.07);';
  }
});

// ===== SCROLL-IN ANIMATIONS =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }, i * 60);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.quiz-card, .review-card, .step-card').forEach((card, i) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(24px)';
  card.style.transition = `opacity 0.5s ease ${i * 0.05}s, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${i * 0.05}s`;
  observer.observe(card);
});

// ===== RENDER PERSONAL BEST BADGES =====
document.querySelectorAll('.quiz-card').forEach(card => {
  const quizId = card.dataset.quizId;
  if (quizId) {
    const score = localStorage.getItem(`quiz_pb_${quizId}`);
    if (score !== null) {
      const badge = card.querySelector('.quiz-pb-badge');
      if (badge) {
        badge.querySelector('.pb-val').textContent = score + '%';
        badge.style.display = 'inline-flex';
        badge.style.aligenItems = 'center';
        badge.style.gap = '0.05rem';
      }
    }
  }
});

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

// ===== UNIVERSAL CUSTOM SELECT INITIALIZER =====
function initCustomSelects(root = document) {
  root.querySelectorAll('.custom-select-container').forEach(container => {
    // Skip if already initialized
    if (container.dataset.csInit) return;
    container.dataset.csInit = '1';

    const trigger = container.querySelector('.custom-select-trigger');
    const optionsList = container.querySelector('.custom-select-options');
    const valueDisplay = container.querySelector('.custom-select-value');
    const options = container.querySelectorAll('.custom-select-option');

    // Sync with a hidden <input> if data-target is set
    const targetId = container.dataset.target;
    const targetInput = targetId ? document.getElementById(targetId) : null;

    function openSelect() {
      // Close any other open selects first
      document.querySelectorAll('.custom-select-container.open').forEach(other => {
        if (other !== container) {
          other.classList.remove('open');
          other.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
        }
      });
      container.classList.toggle('open');
      const isOpen = container.classList.contains('open');
      trigger.setAttribute('aria-expanded', String(isOpen));
    }

    function selectOption(option) {
      const val = option.dataset.value;
      const label = option.textContent.trim();

      // Update display label
      if (valueDisplay) valueDisplay.textContent = label;

      // Update selected state
      options.forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');

      // Sync hidden input
      if (targetInput) targetInput.value = val;

      // Close
      container.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      openSelect();
    });

    // Keyboard support
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSelect();
      } else if (e.key === 'Escape') {
        container.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        selectOption(option);
      });
    });
  });

  // Global close on outside click (only once)
  if (!document._csOutsideListenerSet) {
    document._csOutsideListenerSet = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-select-container.open').forEach(c => {
        c.classList.remove('open');
        c.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

// Initialize all selects on page load
initCustomSelects();

// Expose so other scripts can call it after dynamic DOM injection
window.initCustomSelects = initCustomSelects;

// ===== INSTANT PAGE TRANSITION LOADER =====
(function() {
  const loaderBar    = document.getElementById('global-loader-bar');
  const pageOverlay  = document.getElementById('global-page-overlay');

  // Prefetch pages on hover so they're cached before the user clicks
  const prefetched = new Set();
  function prefetchHref(href) {
    if (!href || prefetched.has(href)) return;
    prefetched.add(href);
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const link = document.createElement('link');
      link.rel  = 'prefetch';
      link.href = url.pathname;
      document.head.appendChild(link);
    } catch (_) {}
  }

  // Attach prefetch on hover to all navbar links
  document.querySelectorAll('.nav-link, .nav-logo').forEach(a => {
    a.addEventListener('mouseenter', () => prefetchHref(a.getAttribute('href')), { passive: true });
  });

  function showLoader() {
    if (!loaderBar || !pageOverlay) return;
    loaderBar.classList.add('loading');
    pageOverlay.classList.add('loading');
    // Progressive bar stages
    loaderBar.style.width = '15%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        loaderBar.style.width = '55%';
      });
    });
    setTimeout(() => { loaderBar.style.width = '85%'; }, 200);
  }

  function hideLoader() {
    if (!loaderBar || !pageOverlay) return;
    loaderBar.style.width = '100%';
    loaderBar.style.opacity = '0';
    pageOverlay.classList.remove('loading');
    setTimeout(() => {
      loaderBar.classList.remove('loading');
      loaderBar.style.width  = '0%';
      loaderBar.style.opacity = '';
    }, 300);
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    if (
      link.target === '_blank'       ||
      href.startsWith('#')           ||
      href.startsWith('javascript:') ||
      link.hasAttribute('download')  ||
      e.ctrlKey || e.shiftKey || e.metaKey || e.button !== 0
    ) return;

    let targetUrl;
    try { targetUrl = new URL(href, window.location.href); }
    catch (_) { return; }

    if (targetUrl.origin !== window.location.origin) return;

    // Same page — no loader needed
    if (targetUrl.pathname === window.location.pathname && !targetUrl.search) return;

    e.preventDefault();
    showLoader();

    // Navigate immediately — browser will use prefetch cache if available
    window.location.href = href;
  });

  // Hide loader on page reveal (handles bfcache back/forward)
  window.addEventListener('pageshow', hideLoader);
})();

