// ===== TOGGLE MODEL ANSWER =====
function toggleAnswer(questionId) {
  const answerEl = document.getElementById('answer-' + questionId);
  const btn = answerEl.previousElementSibling.querySelector('.reveal-btn');
  
  if (answerEl.classList.contains('visible')) {
    answerEl.classList.remove('visible');
    btn.innerHTML = '<span class="reveal-icon">👁️</span> عرض نموذج الإجابة';
  } else {
    answerEl.classList.add('visible');
    btn.innerHTML = '<span class="reveal-icon">🙈</span> إخفاء الإجابة';
    // Smooth scroll to answer
    setTimeout(() => {
      answerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
}

// ===== SMOOTH SCROLL FOR TOC =====
document.querySelectorAll('.toc-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = link.getAttribute('href').slice(1);
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ===== HIGHLIGHT ACTIVE SECTION IN TOC =====
const sections = document.querySelectorAll('.review-section');
const tocLinks = document.querySelectorAll('.toc-link');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      tocLinks.forEach(link => {
        link.style.color = link.getAttribute('href') === '#' + id ? '#00d4aa' : '';
        if (link.getAttribute('href') === '#' + id) {
          link.querySelector('.toc-num').style.background = '#00d4aa';
          link.querySelector('.toc-num').style.color = '#0a0f1e';
        } else {
          link.querySelector('.toc-num').style.background = '';
          link.querySelector('.toc-num').style.color = '';
        }
      });
    }
  });
}, { threshold: 0.3 });

sections.forEach(s => sectionObserver.observe(s));

// ===== AUTO-RESIZE TEXTAREA =====
document.querySelectorAll('.student-textarea').forEach(textarea => {
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  });
});
