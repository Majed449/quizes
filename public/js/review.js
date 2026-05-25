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
        link.style.color = link.getAttribute('href') === '#' + id ? 'var(--accent)' : '';
        if (link.getAttribute('href') === '#' + id) {
          link.querySelector('.toc-num').style.background = 'var(--accent)';
          link.querySelector('.toc-num').style.color = 'var(--bg)';
        } else {
          link.querySelector('.toc-num').style.background = '';
          link.querySelector('.toc-num').style.color = '';
        }
      });
    }
  });
}, { threshold: 0.3 });

sections.forEach(s => sectionObserver.observe(s));

// ===== AUTO-RESIZE TEXTAREA & SAVE TO LOCALSTORAGE =====
const topicId = window.location.pathname.split('/').pop();

document.querySelectorAll('.essay-question-card').forEach(card => {
  const qId = card.id;
  const textarea = card.querySelector('.student-textarea');
  if (qId && textarea) {
    const storageKey = `review_ans_${topicId}_${qId}`;
    
    // Load saved value
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      textarea.value = saved;
      setTimeout(() => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      }, 50);
    }

    // Save on input & resize
    textarea.addEventListener('input', () => {
      localStorage.setItem(storageKey, textarea.value);
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });
  }
});
