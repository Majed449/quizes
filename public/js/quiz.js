// ===== QUIZ STATE =====
let currentQuestion = 0;
let quizQuestions = QUIZ_DATA.questions;
let totalQuestions = quizQuestions.length;
let answers = new Array(totalQuestions).fill(null);
let quizSubmitted = false;
let isRetryMode = false;

// ===== AUDIO & TIMER & CONFETTI SYSTEMS =====
let audioMuted = localStorage.getItem('quiz_audio_muted') === 'true';
let timerInterval = null;
let secondsRemaining = 0;
let timerMode = 'unlimited';
let timerStarted = false;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration) {
  if (audioMuted) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.error('Audio play error:', e);
  }
}

function playSelectionSound() {
  playTone(587.33, 'sine', 0.08); // D5 soft blip
}

function playCompletionSound(pct) {
  if (pct >= 80) {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 'triangle', 0.18), idx * 100);
    });
  } else {
    const notes = [392.00, 329.63, 261.63];
    notes.forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 'sine', 0.25), idx * 130);
    });
  }
}

function startTimer() {
  if (timerStarted) return;
  timerStarted = true;

  // Read from the start screen's hidden input (synced by custom select widget)
  // Fall back to the header's timerSelect for compatibility
  const startInput  = document.getElementById('startTimerSelect');
  const headerSelect = document.getElementById('timerSelect');
  const display = document.getElementById('timerDisplay');

  // Determine value: prefer startTimerSelect (set by custom select)
  let val = 'unlimited';
  if (startInput) val = startInput.value;
  else if (headerSelect) val = headerSelect.value;

  if (val === 'unlimited') {
    timerMode = 'unlimited';
    secondsRemaining = 0;
  } else {
    timerMode = 'countdown';
    secondsRemaining = parseInt(val);
  }

  if (display) {
    display.style.display = 'inline-block';
    updateTimerDisplay();
  }

  // Hide the native header select if present
  if (headerSelect) headerSelect.style.display = 'none';

  timerInterval = setInterval(() => {
    if (timerMode === 'countdown') {
      secondsRemaining--;
      if (secondsRemaining <= 0) {
        clearInterval(timerInterval);
        submitQuiz();
        alert('⌛ انتهى الوقت المحدد للاختبار! تم تقديم إجاباتك تلقائياً.');
      }
    } else {
      secondsRemaining++;
    }
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  if (!display) return;
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  display.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  
  if (timerMode === 'countdown' && secondsRemaining < 60) {
    display.style.color = 'var(--accent-2)';
    display.style.textShadow = '0 0 8px rgba(255, 107, 107, 0.6)';
    display.classList.add('pulse-warning');
  }
}

function triggerConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '9999';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const colors = ['#00d4aa', '#a78bfa', '#ff6b6b', '#fbbf24', '#38bdf8'];
  const confettiCount = 120;
  const confetti = [];

  class Confetto {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * -height - 20;
      this.size = Math.random() * 8 + 6;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.speed = Math.random() * 3 + 3;
      this.angle = Math.random() * Math.PI * 2;
      this.rotationSpeed = Math.random() * 0.15 - 0.075;
      this.wobble = Math.random() * 10;
      this.wobbleSpeed = Math.random() * 0.04 + 0.02;
    }
    update() {
      this.y += this.speed;
      this.angle += this.rotationSpeed;
      this.wobble += this.wobbleSpeed;
      this.x += Math.sin(this.wobble) * 0.4;
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = this.color;
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
      ctx.restore();
    }
  }

  for (let i = 0; i < confettiCount; i++) {
    confetti.push(new Confetto());
  }

  let startTime = Date.now();
  function animate() {
    ctx.clearRect(0, 0, width, height);
    let active = false;
    confetti.forEach(c => {
      c.update();
      c.draw();
      if (c.y < height) active = true;
    });

    if (active && Date.now() - startTime < 3500) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }
  animate();
}

function loadPersonalBest() {
  const pbWidget = document.getElementById('personalBestWidget');
  const pbScore = document.getElementById('personalBestScore');
  if (!pbWidget || !pbScore) return;
  const key = `quiz_pb_${QUIZ_DATA.id}`;
  const best = localStorage.getItem(key);
  if (best) {
    pbScore.textContent = best + '%';
    pbWidget.style.display = 'flex';
  } else {
    pbWidget.style.display = 'none';
  }
}

function savePersonalBest(percentage) {
  const key = `quiz_pb_${QUIZ_DATA.id}`;
  const currentBest = parseInt(localStorage.getItem(key)) || 0;
  if (percentage > currentBest) {
    localStorage.setItem(key, percentage);
  }
}

// ===== DOM ELEMENTS (static, never change) =====
const progressFill    = document.getElementById('progressFill');
const progressText    = document.getElementById('progressText');
const progressPercent = document.getElementById('progressPercent');
const prevBtn         = document.getElementById('prevBtn');
const nextBtn         = document.getElementById('nextBtn');
// resultsSlide lives inside questionsContainer — use getter so it always returns the live element
function getResultsSlide() { return document.getElementById('resultsSlide'); }

// ===== LIVE REFERENCES — updated after DOM rebuild =====
// These are functions so they always return the current DOM state
function getSlides()       { return document.querySelectorAll('.question-slide:not(.results-slide)'); }
function getQuestionDots() { return document.querySelectorAll('.q-dot'); }

// ===== INITIALIZE =====
function init() {
  const wrongQuestionsRaw = sessionStorage.getItem('retryWrongQuestions');

  if (wrongQuestionsRaw) {
    // ── RETRY MODE ──
    const startSlide = document.getElementById('startSlide');
    if (startSlide) {
      startSlide.style.display = 'none';
      startSlide.classList.remove('active');
    }

    const progressFillBar = document.getElementById('quizProgressBarContainer');
    if (progressFillBar) progressFillBar.style.display = 'block';

    const progressInfo = document.getElementById('quizProgressInfoContainer');
    if (progressInfo) progressInfo.style.display = 'flex';

    const quizNav = document.getElementById('quizNav');
    if (quizNav) quizNav.style.display = 'flex';

    isRetryMode = true;
    quizQuestions = JSON.parse(wrongQuestionsRaw);
    quizQuestions.forEach((q, idx) => {
      q.originalIndex = idx;
    });
    totalQuestions = quizQuestions.length;
    answers = new Array(totalQuestions).fill(null);
    sessionStorage.removeItem('retryWrongQuestions');

    // Badge
    const header = document.querySelector('.quiz-header-info');
    if (header) {
      const badge = document.createElement('span');
      badge.className = 'retry-mode-badge';
      badge.textContent = '🎯 إعادة محاولة الأسئلة الخاطئة';
      badge.style.cssText = 'display:inline-block;background:#ff6b6b;color:white;padding:0.4rem 0.8rem;border-radius:20px;font-size:0.85rem;margin-top:0.5rem;font-weight:600';
      header.appendChild(badge);
    }

    // Run the rest of init normally
    runActualInit('all');
    startTimer();
  } else {
    // ── NORMAL MODE ──
    // Load personal best & audio system early so they're ready on start screen
    loadPersonalBest();
    setupAudioToggleBtn();
  }
}

function setupAudioToggleBtn() {
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  if (audioToggleBtn) {
    audioToggleBtn.innerHTML = audioMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
    // Clear old listeners if any by replacing the node (avoids double execution)
    const newBtn = audioToggleBtn.cloneNode(true);
    audioToggleBtn.parentNode.replaceChild(newBtn, audioToggleBtn);
    newBtn.addEventListener('click', () => {
      audioMuted = !audioMuted;
      localStorage.setItem('quiz_audio_muted', audioMuted);
      newBtn.innerHTML = audioMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
    });
  }
}

function startQuizChallenge() {
  // 1. Get chosen question count
  const countSelect = document.getElementById('questionCountSelect');
  const chosenCount = countSelect ? countSelect.value : 'all';

  // 2. Get chosen timer value
  const startTimerSelect = document.getElementById('startTimerSelect');
  if (startTimerSelect) {
    const timerVal = startTimerSelect.value;
    const mainTimerSelect = document.getElementById('timerSelect');
    if (mainTimerSelect) {
      mainTimerSelect.value = timerVal;
    }
  }

  // 3. Remove/hide Start Slide
  const startSlide = document.getElementById('startSlide');
  if (startSlide) {
    startSlide.style.display = 'none';
    startSlide.classList.remove('active');
  }

  // 4. Show quiz progress and footer navigation elements
  const progressFillBar = document.getElementById('quizProgressBarContainer');
  if (progressFillBar) progressFillBar.style.display = 'block';

  const progressInfo = document.getElementById('quizProgressInfoContainer');
  if (progressInfo) progressInfo.style.display = 'flex';

  const quizNav = document.getElementById('quizNav');
  if (quizNav) quizNav.style.display = 'flex';

  // 5. Initialize the quiz questions based on chosenCount!
  runActualInit(chosenCount);

  // 6. Start the timer!
  startTimer();
}

// Export startQuizChallenge globally just in case
window.startQuizChallenge = startQuizChallenge;

function runActualInit(chosenCount) {
  if (!isRetryMode) {
    // ── NORMAL MODE: Shuffle questions ──
    quizQuestions = QUIZ_DATA.questions.map((q, idx) => ({ ...q, originalIndex: idx }));
    for (let i = quizQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [quizQuestions[i], quizQuestions[j]] = [quizQuestions[j], quizQuestions[i]];
    }

    // Slicing questions to the chosen count
    if (chosenCount && chosenCount !== 'all') {
      const limit = parseInt(chosenCount, 10);
      if (!isNaN(limit)) {
        quizQuestions = quizQuestions.slice(0, limit);
      }
    }

    totalQuestions = quizQuestions.length;
    answers = new Array(totalQuestions).fill(null);
  }

  // Fix score denominator (was server-rendered with original count)
  const scoreDenom = document.querySelector('.score-denom');
  if (scoreDenom) scoreDenom.textContent = '/' + totalQuestions;

  // ── Rebuild questions in DOM ──
  const container = document.getElementById('questionsContainer');
  
  // ⚠️ CRITICAL: Save resultsSlide BEFORE clearing — it lives inside this container!
  const savedResultsSlide = document.getElementById('resultsSlide');
  container.innerHTML = '';

  quizQuestions.forEach((q, index) => {
    const slide = document.createElement('div');
    slide.className = `question-slide ${index === 0 ? 'active' : ''}`;
    slide.dataset.index = index;

    const optionsHtml = q.type === 'truefalse'
      ? `<div class="options-grid tf-grid">
          <button class="option-btn tf-btn" data-value="true"  data-index="${index}" title="تحديد صح (True) كإجابة لهذا السؤال">
            <span class="option-icon"><i class="fa-solid fa-check"></i></span><span>صح</span>
          </button>
          <button class="option-btn tf-btn" data-value="false" data-index="${index}" title="تحديد خطأ (False) كإجابة لهذا السؤال">
            <span class="option-icon"><i class="fa-solid fa-xmark"></i></span><span>خطأ</span>
          </button>
        </div>`
      : `<div class="options-grid mc-grid">
          ${(q.options || []).map((opt, optIndex) => `
            <button class="option-btn mc-btn" data-value="${optIndex}" data-index="${index}" title="تحديد هذا الخيار كإجابة لهذا السؤال">
              <span class="option-letter">${['أ','ب','ج','د'][optIndex]}</span>
              <span class="option-text">${Array.isArray(opt) ? opt.join(' و') : opt}</span>
            </button>`).join('')}
        </div>`;

    slide.innerHTML = `
      <div class="question-number">السؤال ${index + 1}</div>
      <div class="question-type-badge ${q.type === 'truefalse' ? 'badge-tf' : 'badge-mc'}">
        ${q.type === 'truefalse' ? '<i class="fa-solid fa-circle-check" style="margin-left: 0.4rem;"></i> صح أم خطأ' : '<i class="fa-solid fa-list-ul" style="margin-left: 0.4rem;"></i> اختيار من متعدد'}
      </div>
      <h2 class="question-text">${q.question}</h2>
      ${optionsHtml}
    `;
    container.appendChild(slide);
  });

  // Re-append resultsSlide back into the container after rebuilding questions
  if (savedResultsSlide) {
    container.appendChild(savedResultsSlide);
  }

  // ── Rebuild question dots ──
  const dotsContainer = document.getElementById('questionDots');
  dotsContainer.innerHTML = '';
  for (let i = 0; i < totalQuestions; i++) {
    const dot = document.createElement('div');
    dot.className = `q-dot ${i === 0 ? 'active' : ''}`;
    dot.dataset.index = i;
    dotsContainer.appendChild(dot);
  }

  // ── Load personal best ──
  loadPersonalBest();

  // ── Setup audio toggle ──
  setupAudioToggleBtn();

  // ── Attach listeners (always run after DOM is ready) ──
  attachOptionListeners();
  attachDotListeners();

  updateProgress();
  updateNavButtons();
}

// ===== ATTACH LISTENERS =====
let autoAdvanceTimer = null;

function attachOptionListeners() {
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => handleAnswer(btn));
  });
}

function attachDotListeners() {
  document.querySelectorAll('.q-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.dataset.index);
      if (idx !== currentQuestion) {
        goToQuestion(idx, idx > currentQuestion ? 'forward' : 'reverse');
      }
    });
  });
}

// ===== HANDLE ANSWER =====
function handleAnswer(btn) {
  if (quizSubmitted) return;

  // Start timer on first interaction
  if (!timerStarted) {
    startTimer();
  }

  // Play selection tone
  playSelectionSound();

  const questionIndex = parseInt(btn.dataset.index);
  const value = btn.dataset.value;

  answers[questionIndex] = value;

  // Visual: deselect all in this question's slide, select clicked
  const allSlides = getSlides();
  const slide = allSlides[questionIndex];
  if (slide) {
    slide.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
  }
  btn.classList.add('selected');

  // Mark dot as answered
  const dots = getQuestionDots();
  if (dots[questionIndex]) {
    dots[questionIndex].classList.add('answered');
  }

  updateNavButtons();

  // Auto-advance to next question
  if (questionIndex < totalQuestions - 1) {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = setTimeout(() => {
      goToQuestion(questionIndex + 1, 'forward');
    }, 520);
  }
}

// ===== NAVIGATION =====
function nextQuestion() {
  if (currentQuestion < totalQuestions - 1) {
    goToQuestion(currentQuestion + 1, 'forward');
  } else if (answers.every(a => a !== null) && !quizSubmitted) {
    submitQuiz();
  }
}

function prevQuestion() {
  if (currentQuestion > 0) {
    goToQuestion(currentQuestion - 1, 'reverse');
  }
}

function goToQuestion(index, direction = 'forward') {
  const allSlides = getSlides();
  if (allSlides[currentQuestion]) allSlides[currentQuestion].classList.remove('active');
  currentQuestion = index;
  const slide = allSlides[currentQuestion];
  if (slide) {
    slide.classList.remove('slide-reverse');
    if (direction === 'reverse') slide.classList.add('slide-reverse');
    slide.classList.add('active');
  }
  updateProgress();
  updateNavButtons();
}

// ===== UPDATE UI =====
function updateProgress() {
  const answered = answers.filter(a => a !== null).length;
  const percent  = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;
  progressFill.style.width  = percent + '%';
  progressText.textContent  = `السؤال ${currentQuestion + 1} من ${totalQuestions}`;
  progressPercent.textContent = percent + '%';

  // Update dots
  getQuestionDots().forEach((dot, i) => {
    dot.classList.toggle('active', i === currentQuestion);
  });
}

function updateNavButtons() {
  prevBtn.disabled = currentQuestion === 0;

  const currentAnswered = answers[currentQuestion] !== null;
  const allAnswered     = answers.every(a => a !== null);

  if (currentQuestion < totalQuestions - 1) {
    nextBtn.disabled    = !currentAnswered;
    nextBtn.textContent = 'التالي';
  } else {
    nextBtn.disabled    = !allAnswered;
    nextBtn.textContent = allAnswered ? '🏁 إنهاء الاختبار' : 'أجب على جميع الأسئلة';
  }
}

// ===== SUBMIT LOADER =====
function showSubmitLoader() {
  let overlay = document.getElementById('submitLoaderOverlay');
  if (overlay) { overlay.style.display = 'flex'; return; }

  overlay = document.createElement('div');
  overlay.id = 'submitLoaderOverlay';
  overlay.innerHTML = `
    <div class="submit-loader-card">
      <div class="submit-loader-spinner">
        <svg viewBox="0 0 50 50" class="spinner-svg">
          <circle class="spinner-track" cx="25" cy="25" r="20" fill="none" stroke-width="4"/>
          <circle class="spinner-arc"   cx="25" cy="25" r="20" fill="none" stroke-width="4"
                  stroke-dasharray="90 220" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="submit-loader-title">جارٍ تحليل إجاباتك…</p>
      <p class="submit-loader-sub">يتم فحص الإجابات وحساب النتيجة</p>
      <div class="submit-loader-dots"><span></span><span></span><span></span></div>
    </div>
  `;
  document.body.appendChild(overlay);
  // Double rAF ensures the element is painted before the transition starts
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));
}

function hideSubmitLoader() {
  const overlay = document.getElementById('submitLoaderOverlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  setTimeout(() => overlay.remove(), 350);
}

// ===== SUBMIT QUIZ =====
function submitQuiz() {
  quizSubmitted = true;

  // Show processing loader immediately
  showSubmitLoader();

  const playerName = localStorage.getItem('battle_nickname') || null;

  // Evaluate all active questions (quizQuestions) locally for fallback
  const fallbackResults = quizQuestions.map((q, index) => {
    const userAnswer = answers[index];
    let isCorrect = false;

    if (q.type === 'truefalse') {
      isCorrect = (userAnswer === 'true' || userAnswer === 'false') && (userAnswer === 'true') === Boolean(q.answer);
    } else {
      isCorrect = (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') && parseInt(userAnswer) === parseInt(q.answer);
    }

    return {
      id:            q.id,
      type:          q.type,
      question:      q.question,
      options:       q.options || null,
      userAnswer:    userAnswer,
      correctAnswer: q.answer,
      isCorrect:     isCorrect,
      explanation:   q.explanation || null
    };
  });

  const score      = fallbackResults.filter(r => r.isCorrect).length;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const fallbackData = { score, total: totalQuestions, percentage, results: fallbackResults };

  // Ensure loader shows for at least 400ms (fast but visible)
  const loaderStart = Date.now();
  const MIN_LOADER_MS = 400;

  fetch(`/quiz/${QUIZ_DATA.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, playerName, questions: quizQuestions })
  })
  .then(res => {
    if (!res.ok) throw new Error('Network response not ok');
    return res.json();
  })
  .then(data => {
    const elapsed = Date.now() - loaderStart;
    const delay = Math.max(0, MIN_LOADER_MS - elapsed);
    setTimeout(() => { hideSubmitLoader(); showResults(data); }, delay);
  })
  .catch(err => {
    console.warn('Backend sync failed, falling back to client evaluation:', err);
    const elapsed = Date.now() - loaderStart;
    const delay = Math.max(0, MIN_LOADER_MS - elapsed);
    setTimeout(() => { hideSubmitLoader(); showResults(fallbackData); }, delay);
  });
}

// ===== SHOW RESULTS =====
function showResults(data) {
  // Clear timer
  clearInterval(timerInterval);

  // Confetti & Sound
  playCompletionSound(data.percentage);
  if (data.percentage >= 80) {
    triggerConfetti();
  }

  // Save personal best score
  if (!isRetryMode) {
    savePersonalBest(data.percentage);
  }

  const allSlides = getSlides();
  if (allSlides[currentQuestion]) allSlides[currentQuestion].classList.remove('active');
  
  const resultsSlide = getResultsSlide();
  if (!resultsSlide) {
    console.error('resultsSlide not found in DOM!');
    return;
  }
  resultsSlide.classList.add('active');
  document.getElementById('quizNav').style.display = 'none';

  const scoreNumEl  = document.getElementById('scoreNum');
  const scorePercEl = document.getElementById('scorePercent');
  const scoreMsgEl  = document.getElementById('scoreMessage');
  const correctEl   = document.getElementById('correctCount');
  const wrongEl     = document.getElementById('wrongCount');
  const breakdownEl = document.getElementById('resultsBreakdown');
  const ringFill    = document.getElementById('ringFill');

  // Update denominator dynamically (fixes the server-rendered value)
  const scoreDenom = document.querySelector('.score-denom');
  if (scoreDenom) scoreDenom.textContent = '/' + data.total;

  const correct = data.score;
  const wrong   = data.results.length - correct;
  const pct     = data.percentage;

  // ── Pick theme colour based on score ──
  let colour, emoji, msg;
  if (pct >= 80) {
    colour = '#00d4aa'; emoji = '🌟';
    msg    = 'ممتاز! أداء رائع جداً، استمر على هذا المستوى!';
  } else if (pct >= 60) {
    colour = '#fbbf24'; emoji = '👍';
    msg    = 'جيد! تستطيع تحسين أدائك بمزيد من المراجعة.';
  } else {
    colour = '#ff6b6b'; emoji = '💪';
    msg    = 'لا بأس! راجع المادة وأعد المحاولة.';
  }

  ringFill.style.stroke = colour;
  scoreNumEl.style.color = colour;
  document.getElementById('resultsTrophy').textContent = emoji;

  // Animate ring
  const offset = 314 - (pct / 100) * 314;
  setTimeout(() => {
    ringFill.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
    ringFill.style.strokeDashoffset = offset;
  }, 200);

  // Animate score counter
  let count = 0;
  const step = Math.ceil(correct / 20) || 1;
  const interval = setInterval(() => {
    count = Math.min(count + step, correct);
    scoreNumEl.textContent = count;
    if (count >= correct) clearInterval(interval);
  }, 60);

  // Animate percentage
  let p = 0;
  const pStep = Math.ceil(pct / 25) || 1;
  const pInt  = setInterval(() => {
    p = Math.min(p + pStep, pct);
    scorePercEl.textContent = p + '%';
    if (p >= pct) clearInterval(pInt);
  }, 40);

  animateCounter(correctEl, correct, 800);
  animateCounter(wrongEl, wrong, 800);

  scorePercEl.style.color = colour;
  scoreMsgEl.textContent  = msg;

  // ── Build accordion cards ──
  breakdownEl.innerHTML = ''; // clear any previous results
  data.results.forEach((result, i) => {
    const card = buildResultCard(result, i);
    breakdownEl.appendChild(card);
    setTimeout(() => card.classList.add('visible'), 80 + i * 70);
  });

  updateFilterCounts(data.results);

  // Update dots
  getQuestionDots().forEach((dot, i) => {
    const result = data.results[i];
    if (result) {
      dot.classList.remove('answered');
      dot.classList.add(result.isCorrect ? 'correct' : 'wrong');
    }
  });

  progressFill.style.width     = '100%';
  progressText.textContent     = 'اكتمل الاختبار';
  progressPercent.textContent  = pct + '%';

  // ── Save wrong questions for retry ──
  const wrongResults = data.results.filter(r => !r.isCorrect);
  const retakeWrongBtn = document.getElementById('retakeWrongBtn');

  if (wrongResults.length > 0) {
    // Map back to the question structure expected by init()
    const wrongQuestionsToRetry = wrongResults.map(r => ({
      id:          r.id,
      type:        r.type,
      question:    r.question,
      answer:      r.correctAnswer,   // boolean or number — the correct answer
      options:     r.options || null,
      explanation: r.explanation || null
    }));
    sessionStorage.setItem('retryWrongQuestions', JSON.stringify(wrongQuestionsToRetry));
    if (retakeWrongBtn) retakeWrongBtn.style.display = '';
  } else {
    // All correct — no retry button
    sessionStorage.removeItem('retryWrongQuestions');
    if (retakeWrongBtn) retakeWrongBtn.style.display = 'none';
  }
}

// ── Build a single accordion result card ──
function buildResultCard(result, index) {
  const letters = ['أ','ب','ج','د'];
  const card    = document.createElement('div');
  card.className = `rc-card ${result.isCorrect ? 'rc-correct' : 'rc-wrong'}`;
  card.dataset.filter = result.isCorrect ? 'correct' : 'wrong';

  // Header
  const header = document.createElement('div');
  header.className = 'rc-header';
  header.innerHTML = `
    <div class="rc-status-icon">${result.isCorrect ? '✅' : '❌'}</div>
    <div class="rc-question-text">${index + 1}. ${result.question}</div>
    <div class="rc-chevron">›</div>
  `;
  header.addEventListener('click', () => toggleCard(card));

  // Body
  const body = document.createElement('div');
  body.className = 'rc-body';

  let yourAnswerHtml = '';

  if (result.type === 'truefalse') {
    const userVal = result.userAnswer === true || result.userAnswer === 'true';
    const corrVal = result.correctAnswer === true || result.correctAnswer === 'true';
    yourAnswerHtml = `
      <div class="rc-answer-row ${result.isCorrect ? 'rc-ans-correct' : 'rc-ans-wrong'}">
        <span class="rc-ans-label">إجابتك:</span>
        <span class="rc-ans-value">${userVal ? '✓ صح' : '✗ خطأ'}</span>
      </div>
      ${!result.isCorrect ? `
      <div class="rc-answer-row rc-ans-correct">
        <span class="rc-ans-label">الإجابة الصحيحة:</span>
        <span class="rc-ans-value">${corrVal ? '✓ صح' : '✗ خطأ'}</span>
      </div>` : ''}
    `;
  } else if (result.options) {
    const userIdx = parseInt(result.userAnswer);
    const corrIdx = parseInt(result.correctAnswer);
    const userOpt = result.options[userIdx];
    const corrOpt = result.options[corrIdx];
    yourAnswerHtml = `
      <div class="rc-answer-row ${result.isCorrect ? 'rc-ans-correct' : 'rc-ans-wrong'}">
        <span class="rc-ans-label">إجابتك:</span>
        <span class="rc-ans-value">${letters[userIdx] || '؟'} — ${Array.isArray(userOpt) ? userOpt.join(' و') : (userOpt || '—')}</span>
      </div>
      ${!result.isCorrect ? `
      <div class="rc-answer-row rc-ans-correct">
        <span class="rc-ans-label">الإجابة الصحيحة:</span>
        <span class="rc-ans-value">${letters[corrIdx] || '؟'} — ${Array.isArray(corrOpt) ? corrOpt.join(' و') : (corrOpt || '—')}</span>
      </div>` : ''}
    `;
  }

  const expHtml = result.explanation
    ? `<div class="rc-explanation"><span class="rc-exp-icon">💡</span><span>${result.explanation}</span></div>`
    : '';

  body.innerHTML = yourAnswerHtml + expHtml;
  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function toggleCard(card) {
  const isOpen = card.classList.contains('rc-open');
  document.querySelectorAll('.rc-card.rc-open').forEach(c => c.classList.remove('rc-open'));
  if (!isOpen) card.classList.add('rc-open');
}

// ── Filter tabs ──
function filterResults(btn) {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const filter = btn.dataset.filter;
  document.querySelectorAll('.rc-card').forEach(card => {
    if (filter === 'all' || card.dataset.filter === filter) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
      card.classList.remove('rc-open');
    }
  });
}

function updateFilterCounts(results) {
  const correct = results.filter(r => r.isCorrect).length;
  const wrong   = results.length - correct;
  const tabs    = document.querySelectorAll('.filter-tab');
  if (tabs[0]) tabs[0].textContent = `الكل (${results.length})`;
  if (tabs[1]) tabs[1].innerHTML   = `✅ صحيح <span class="tab-count">${correct}</span>`;
  if (tabs[2]) tabs[2].innerHTML   = `❌ خطأ <span class="tab-count">${wrong}</span>`;
}

function animateCounter(el, target, duration) {
  let start = null;
  const step = (ts) => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    el.textContent = Math.round(progress * target);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ===== RETAKE QUIZ =====
function retakeQuiz() {
  sessionStorage.removeItem('retryWrongQuestions'); // clear retry data
  window.location.reload();
}

// ===== RETAKE WRONG QUESTIONS =====
function retakeWrongQuestions() {
  // Data is already saved in sessionStorage by showResults()
  // Just reload — init() will detect the sessionStorage key and enter retry mode
  window.scrollTo(0, 0);
  window.location.reload();
}

// ===== START =====
init();