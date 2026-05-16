// ===== NAVBAR SCROLL EFFECT =====
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.style.background = 'rgba(7, 9, 26, 0.95)';
    navbar.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)';
  } else {
    navbar.style.background = 'rgba(7, 9, 26, 0.8)';
    navbar.style.boxShadow = '';
  }
}, { passive: true });

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
        background: 'rgba(7,9,26,0.98)',
        backdropFilter: 'blur(20px)',
        padding: '1rem',
        borderBottom: '1px solid rgba(0,212,170,0.1)',
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
