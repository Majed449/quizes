// ===== MULTIPLAYER BATTLE CONTROLLER =====

let socket = null;
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeElapsed = 0;
let timerInterval = null;
let matchOver = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // LocalStorage Nickname Autofill & Save Persistence
  const nameInput = document.getElementById('playerName');
  if (nameInput) {
    const savedName = localStorage.getItem('battle_nickname');
    if (savedName) {
      nameInput.value = savedName;
    }

    const form = nameInput.closest('form');
    if (form) {
      form.addEventListener('submit', () => {
        if (nameInput.value.trim()) {
          localStorage.setItem('battle_nickname', nameInput.value.trim());
        }
      });
    }
  }

  if (!ROOM_CODE) return; // Not in lobby/arena page

  // Connect to Socket.io
  socket = io();

  // Join the room
  socket.emit('join_room', {
    roomCode: ROOM_CODE,
    playerName: PLAYER_NAME
  });

  // ── SOCKET LISTENERS ────────────────────────────────────

  socket.on('room_update', ({ players }) => {
    updateLobbyUI(players);
  });

  socket.on('match_resume', ({ players, questions: serverQuestions, quizTitle, currentQuestionIndex: serverQuestionIndex, score: serverScore, timeElapsed: serverTimeElapsed }) => {
    questions = serverQuestions;
    currentQuestionIndex = serverQuestionIndex;
    score = serverScore;
    timeElapsed = serverTimeElapsed;
    matchOver = false;

    // Set opponent details
    const opponent = players.find(p => p.id !== socket.id);
    if (opponent) {
      const p2NameEl = document.getElementById('p2Name');
      if (p2NameEl) p2NameEl.textContent = opponent.name;
    }

    // Set score counter
    document.getElementById('p1Score').textContent = score;

    // Update progress bar
    const total = questions.length;
    const percent = Math.min((currentQuestionIndex / total) * 100, 100);
    const p1Bar = document.getElementById('p1ProgressBar');
    if (p1Bar) p1Bar.style.width = `${percent}%`;

    // Hide lobby and show arena
    document.getElementById('lobbyContainer').style.display = 'none';
    document.getElementById('arenaContainer').style.display = 'block';

    if (currentQuestionIndex < questions.length) {
      showQuestion(currentQuestionIndex);
      startTimer();
    } else {
      finishMatch();
    }
  });

  socket.on('match_start', ({ players, questions: serverQuestions, quizTitle }) => {
    questions = serverQuestions;
    currentQuestionIndex = 0;
    score = 0;
    timeElapsed = 0;
    matchOver = false;

    // Set opponent details
    const opponent = players.find(p => p.id !== socket.id);
    if (opponent) {
      const p2NameEl = document.getElementById('p2Name');
      if (p2NameEl) p2NameEl.textContent = opponent.name;
    }

    // Hide lobby and show arena
    document.getElementById('lobbyContainer').style.display = 'none';
    document.getElementById('arenaContainer').style.display = 'block';

    // Show first question
    showQuestion(0);

    // Start timer ticking
    startTimer();
  });

  socket.on('opponent_progress', ({ progress, score: opponentScore }) => {
    const total = questions.length;
    const percent = Math.min((progress / total) * 100, 100);
    
    // Update opponent progress bar and score counter
    const p2Bar = document.getElementById('p2ProgressBar');
    const p2ScoreVal = document.getElementById('p2Score');
    
    if (p2Bar) p2Bar.style.width = `${percent}%`;
    if (p2ScoreVal) p2ScoreVal.textContent = opponentScore;
  });

  socket.on('answer_result', ({ questionIndex, isCorrect, correctAnswer }) => {
    highlightAnswer(isCorrect, correctAnswer);

    if (isCorrect) {
      score++;
      document.getElementById('p1Score').textContent = score;
    }

    // Update progress bar
    const total = questions.length;
    const progress = questionIndex + 1;
    const percent = Math.min((progress / total) * 100, 100);
    const p1Bar = document.getElementById('p1ProgressBar');
    if (p1Bar) p1Bar.style.width = `${percent}%`;

    // Wait 1.5 seconds and load next question
    setTimeout(() => {
      currentQuestionIndex++;
      if (currentQuestionIndex < questions.length) {
        showQuestion(currentQuestionIndex);
      } else {
        finishMatch();
      }
    }, 1500);
  });

  socket.on('opponent_finished', ({ score: opponentScore, timeTaken }) => {
    // Optional: display overlay indicating the opponent finished
    console.log(`Opponent finished with score: ${opponentScore} in ${timeTaken} seconds.`);
  });

  socket.on('match_finished', ({ players, winnerId }) => {
    clearInterval(timerInterval);
    matchOver = true;

    // Hide Arena and show Results
    document.getElementById('arenaContainer').style.display = 'none';
    document.getElementById('resultsContainer').style.display = 'block';

    // Declare winner header
    const headerEl = document.getElementById('resultsHeader');
    const isWinner = winnerId === socket.id;
    const isTie = winnerId === null;

    if (isTie) {
      headerEl.innerHTML = `
        <h2 class="tie">🏆 تعادل مذهل!</h2>
        <p>لقد أحرزتم نفس النتيجة في نفس الوقت بالضبط!</p>
      `;
    } else if (isWinner) {
      headerEl.innerHTML = `
        <h2 class="win">🎉 لقد فزت بالتحدي!</h2>
        <p>عمل رائع! تفوقت على منافسك في السرعة والنتيجة.</p>
      `;
      triggerConfetti();
    } else {
      headerEl.innerHTML = `
        <h2 class="lose">💔 هاردلك!</h2>
        <p>حظاً موفقاً في التحدي القادم. استمر بالمحاولة!</p>
      `;
    }

    // Fill Score Card Table
    const p1 = players.find(p => p.id === socket.id);
    const p2 = players.find(p => p.id !== socket.id);

    if (p1 && p2) {
      // Determine rank badges
      const rankP1El = document.getElementById('rankP1');
      const rankP2El = document.getElementById('rankP2');

      const p1Row = document.getElementById('resultRowP1');
      const p2Row = document.getElementById('resultRowP2');

      const isP1First = winnerId === p1.id || (winnerId === null && p1.timeTaken <= p2.timeTaken);

      if (isP1First) {
        rankP1El.textContent = '#1';
        rankP1El.className = 'rank-badge r1';
        rankP2El.textContent = '#2';
        rankP2El.className = 'rank-badge r2';
        // Order rows (P1 first)
        p1Row.style.order = 1;
        p2Row.style.order = 2;
      } else {
        rankP1El.textContent = '#2';
        rankP1El.className = 'rank-badge r2';
        rankP2El.textContent = '#1';
        rankP2El.className = 'rank-badge r1';
        // Order rows (P2 first)
        p1Row.style.order = 2;
        p2Row.style.order = 1;
      }

      // Populate text fields
      document.getElementById('resP1Name').textContent = p1.name + ' (أنت)';
      document.getElementById('resP1Score').textContent = `${p1.score} / ${questions.length}`;
      document.getElementById('resP1Time').textContent = formatSeconds(p1.timeTaken);

      document.getElementById('resP2Name').textContent = p2.name;
      document.getElementById('resP2Score').textContent = `${p2.score} / ${questions.length}`;
      document.getElementById('resP2Time').textContent = formatSeconds(p2.timeTaken);
    }
  });

  socket.on('opponent_disconnected', ({ message }) => {
    clearInterval(timerInterval);
    showBattleModal('انفصال اللاعب', `⚠️ ${message}`, 'fa-triangle-exclamation', () => {
      window.location.href = '/quiz';
    });
  });

  socket.on('error_message', (msg) => {
    showBattleModal('خطأ في التحدي', `❌ ${msg}`, 'fa-circle-xmark', () => {
      window.location.href = '/battle/join';
    });
  });
});

// ── UTILITIES & RENDERERS ──────────────────────────────────

function updateLobbyUI(players) {
  const p1 = players.find(p => p.id === socket.id);
  const p2 = players.find(p => p.id !== socket.id);

  if (p1) {
    document.getElementById('lobbyP1Name').textContent = p1.name + ' (أنت)';
  }

  const p2Row = document.getElementById('lobbyP2Row');
  const p2NameEl = document.getElementById('lobbyP2Name');

  if (p2) {
    p2Row.classList.remove('empty');
    p2NameEl.textContent = p2.name;
    p2Row.querySelector('.player-avatar').innerHTML = '<i class="fa-solid fa-user-ninja"></i>';
    p2Row.querySelector('.player-status-lobby').textContent = 'جاهز للعب';
    p2Row.querySelector('.player-status-lobby').className = 'player-status-lobby ready';
  } else {
    p2Row.classList.add('empty');
    p2NameEl.textContent = 'بانتظار المنافس...';
    p2Row.querySelector('.player-avatar').innerHTML = '<i class="fa-solid fa-hourglass-start"></i>';
    p2Row.querySelector('.player-status-lobby').textContent = 'ينتظر';
    p2Row.querySelector('.player-status-lobby').className = 'player-status-lobby waiting';
  }
}

function startTimer() {
  const timerValEl = document.getElementById('timerVal');
  timerInterval = setInterval(() => {
    timeElapsed++;
    if (timerValEl) {
      timerValEl.textContent = formatSeconds(timeElapsed);
    }
  }, 1000);
}

function formatSeconds(totalSecs) {
  const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
  const secs = (totalSecs % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function showQuestion(index) {
  const q = questions[index];
  if (!q) return;

  // Set metadata headers
  document.getElementById('currentQuestionNum').textContent = index + 1;
  document.getElementById('totalQuestionsNum').textContent = questions.length;
  document.getElementById('arenaQuestionText').textContent = q.question;

  const optionsGrid = document.getElementById('arenaOptionsGrid');
  optionsGrid.innerHTML = '';

  // Render options based on quiz type
  if (q.type === 'truefalse') {
    const options = ['صح', 'خطأ'];
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'arena-opt-btn';
      btn.innerHTML = `<span>${opt}</span> <i class="fa-regular fa-circle-dot" style="color: var(--text-dim);"></i>`;
      btn.addEventListener('click', () => submitAnswer(index, opt === 'صح'));
      optionsGrid.appendChild(btn);
    });
  } else if (q.type === 'multiple') {
    q.options.forEach((opt, oIdx) => {
      const btn = document.createElement('button');
      btn.className = 'arena-opt-btn';
      btn.innerHTML = `<span>${opt}</span> <span class="opt-letter" style="color:var(--text-dim);font-weight:700;">${String.fromCharCode(65 + oIdx)}</span>`;
      btn.addEventListener('click', () => submitAnswer(index, oIdx));
      optionsGrid.appendChild(btn);
    });
  }
}

function submitAnswer(questionIndex, selectedAnswer) {
  // Lock all buttons from clicks
  const buttons = document.querySelectorAll('.arena-opt-btn');
  buttons.forEach(btn => {
    btn.disabled = true;
  });

  // Find selected button and add selected class
  const optionsGrid = document.getElementById('arenaOptionsGrid');
  const clickedBtn = Array.from(optionsGrid.children).find(btn => {
    if (questions[questionIndex].type === 'truefalse') {
      const isTrueVal = btn.querySelector('span').textContent === 'صح';
      return isTrueVal === selectedAnswer;
    } else {
      const optLetter = btn.querySelector('.opt-letter').textContent;
      const index = optLetter.charCodeAt(0) - 65;
      return index === selectedAnswer;
    }
  });

  if (clickedBtn) {
    clickedBtn.classList.add('selected');
  }

  // Send answer to server for verification
  socket.emit('submit_answer', {
    questionIndex,
    selectedAnswer
  });
}

function highlightAnswer(isCorrect, correctAnswer) {
  const optionsGrid = document.getElementById('arenaOptionsGrid');
  const buttons = Array.from(optionsGrid.children);

  buttons.forEach(btn => {
    let matchesCorrect = false;
    let matchesSelected = btn.classList.contains('selected');

    if (questions[currentQuestionIndex].type === 'truefalse') {
      const isTrueVal = btn.querySelector('span').textContent === 'صح';
      matchesCorrect = isTrueVal === correctAnswer;
    } else {
      const optLetter = btn.querySelector('.opt-letter').textContent;
      const index = optLetter.charCodeAt(0) - 65;
      matchesCorrect = index === correctAnswer;
    }

    if (matchesCorrect) {
      btn.classList.add('correct');
      btn.querySelector('span').insertAdjacentHTML('beforeend', ' <i class="fa-solid fa-circle-check" style="margin-right:0.4rem"></i>');
    } else if (matchesSelected && !isCorrect) {
      btn.classList.add('incorrect');
      btn.querySelector('span').insertAdjacentHTML('beforeend', ' <i class="fa-solid fa-circle-xmark" style="margin-right:0.4rem"></i>');
    }
  });
}

function finishMatch() {
  clearInterval(timerInterval);
  // Tell server we completed our run
  socket.emit('player_finished');
}

// Click to Copy Lobby Room Code
window.copyRoomCode = function() {
  const code = document.getElementById('roomCodeVal').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showBattleModal('نسخ الكود', '✅ تم نسخ كود الغرفة بنجاح!', 'fa-circle-check');
  }).catch(err => {
    console.error('Failed to copy room code:', err);
  });
};

// Custom Battle Modal display handler
function showBattleModal(title, message, iconClass = 'fa-circle-info', callback = null) {
  const modal = document.getElementById('battleModal');
  const titleEl = document.getElementById('battleModalTitle');
  const msgEl = document.getElementById('battleModalMessage');
  const iconEl = document.getElementById('battleModalIcon');

  if (!modal) return;

  titleEl.textContent = title;
  msgEl.textContent = message;
  iconEl.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;

  if (iconClass.includes('exclamation') || iconClass.includes('xmark')) {
    iconEl.style.color = '#ef4444';
  } else if (iconClass.includes('check')) {
    iconEl.style.color = '#10b981';
  } else {
    iconEl.style.color = 'var(--accent)';
  }

  modal.style.display = 'flex';

  window.closeBattleModal = function() {
    modal.style.display = 'none';
    if (callback) callback();
  };
}

// Fun confetti effect for winning players
function triggerConfetti() {
  // Simple check for canvas-confetti library, otherwise append particles dynamically
  const container = document.body;
  for (let i = 0; i < 40; i++) {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.zIndex = '9999';
    div.style.width = '8px';
    div.style.height = '8px';
    div.style.background = ['var(--accent)', '#a855f7', '#f59e0b', '#3b82f6', '#10b981'][Math.floor(Math.random() * 5)];
    div.style.left = Math.random() * 100 + 'vw';
    div.style.top = '-10px';
    div.style.borderRadius = Math.random() > 0.5 ? '50%' : '0px';
    div.style.opacity = Math.random().toString();
    div.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(div);

    const animation = div.animate([
      { top: '-10px', transform: `translate(0, 0) rotate(0deg)` },
      { top: '105vh', transform: `translate(${(Math.random() - 0.5) * 200}px, 0) rotate(${Math.random() * 720}deg)` }
    ], {
      duration: 1500 + Math.random() * 2000,
      easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)'
    });

    animation.onfinish = () => div.remove();
  }
}
