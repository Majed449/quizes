const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');

// ── NAME COLLECTION STATE ──────────────────────────────────────────────────
let awaitingName = false;

/**
 * Extracts the real name from phrases like:
 *   "اسمي هو احمد صابر" → "احمد صابر"
 *   "أنا احمد"          → "احمد"
 *   "احمد صابر"         → "احمد صابر"
 * Strips common Arabic intro words, keeps only the name part.
 */
function extractNameFromInput(raw) {
  let text = raw.trim();

  // Remove common leading name-intro phrases (order matters — longest first)
  const prefixes = [
    'اسمي هو', 'اسمي هي', 'اسمي', 'أنا اسمي', 'انا اسمي',
    'أنا', 'انا', 'يمكنك مناداتي', 'نادني', 'ناديني',
    'اسم المستخدم', 'الاسم هو', 'الاسم', 'هو', 'هي'
  ];

  for (const prefix of prefixes) {
    const pattern = new RegExp(`^${prefix}\\s*`, 'i');
    text = text.replace(pattern, '').trim();
  }

  // Remove leading/trailing punctuation
  text = text.replace(/^[،,.:؟?!]+|[،,.:؟?!]+$/g, '').trim();

  return text;
}

/** Show the name-request prompt in the chat */
function askForName() {
  awaitingName = true;
  userInput.placeholder = 'اكتب اسمك هنا...';
  appendMessage('bot', 'مرحباً بك! 👋 قبل أن نبدأ، ما اسمك؟ أودّ مناداتك بشكل صحيح!');
}

/** Save the name and greet the user */
function saveNameAndGreet(rawInput) {
  const name = extractNameFromInput(rawInput);

  // Validate: at least 2 chars, no numbers, not empty
  if (!name || name.length < 2 || /^\d+$/.test(name)) {
    appendMessage('bot', 'لم أتمكن من تمييز الاسم بوضوح 😅 هل يمكنك كتابة اسمك فقط؟ مثال: **احمد صابر**');
    return;
  }

  // Store
  localStorage.setItem('battle_nickname', name);
  awaitingName = false;
  userInput.placeholder = 'اكتب إجابتك أو رسالتك هنا...';

  // Sync with backend
  syncPlayerNickname(name);

  // Update the greeting span if still visible
  const el = document.getElementById('chatPlayerName');
  if (el) el.textContent = name;

  appendMessage('bot', `أهلاً وسهلاً يا **${name}**! 🎉 يسعدني مرافقتك في رحلة المذاكرة. اضغط على **"سؤال عشوائي 🎲"** أو **"بطاقات تفاعلية 🎴"** لنبدأ!`);
}


// Mobile Sidebar Drawer Toggle Logic
function toggleSidebar() {
  const sidebar = document.getElementById('chatSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  }
}

// ── CHAT SELECT INITIALIZATION ─────────────────────────────────────────────
// Uses the global custom-select-container system, with localStorage sync
// and paired syncing between header ↔ drawer selects via data-cs-chat attribute

function loadChatSelectFromStorage(container, storageKey) {
  const savedValue = localStorage.getItem(storageKey);
  if (!savedValue) return;
  const options = container.querySelectorAll('.custom-select-option');
  const valueDisplay = container.querySelector('.custom-select-value');
  const targetOption = Array.from(options).find(o => o.dataset.value === savedValue);
  if (targetOption) {
    options.forEach(o => o.classList.remove('selected'));
    targetOption.classList.add('selected');
    if (valueDisplay) valueDisplay.textContent = targetOption.textContent.trim();
    container.dataset.value = savedValue;
  }
}

function syncChatSelect(chatType, value) {
  // Sync all containers with the same data-cs-chat attribute
  document.querySelectorAll(`[data-cs-chat="${chatType}"]`).forEach(container => {
    const options = container.querySelectorAll('.custom-select-option');
    const valueDisplay = container.querySelector('.custom-select-value');
    const targetOption = Array.from(options).find(o => o.dataset.value === value);
    if (targetOption) {
      options.forEach(o => o.classList.remove('selected'));
      targetOption.classList.add('selected');
      if (valueDisplay) valueDisplay.textContent = targetOption.textContent.trim();
      container.dataset.value = value;
    }
  });
}

// Called from main.js initCustomSelects — we hook in AFTER global init runs
// by overriding option click handlers on chat-specific selects
function initChatSelects() {
  const storageKeys = {
    personality: 'chat_bot_personality',
    filter: 'chat_question_filter'
  };

  document.querySelectorAll('[data-cs-chat]').forEach(container => {
    const chatType = container.dataset.csChatType || container.dataset.csChat;
    const storageKey = storageKeys[chatType];

    // Load saved value from localStorage
    if (storageKey) loadChatSelectFromStorage(container, storageKey);

    // Patch each option to also sync peers and save to storage
    container.querySelectorAll('.custom-select-option').forEach(option => {
      option.addEventListener('click', () => {
        const val = option.dataset.value;
        if (storageKey) localStorage.setItem(storageKey, val);
        // Sync all paired selects (header ↔ drawer)
        syncChatSelect(chatType, val);
      });
    });
  });
}

// Initialize after DOM ready
function syncPlayerNickname(savedName) {
  fetch('/chat/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName: savedName })
  }).catch(err => console.error('Nickname sync error:', err));
}

// Initialize after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (window.initCustomSelects) window.initCustomSelects();
  initChatSelects();
  
  // Retrieve saved nickname and update greeting text if element exists
  const chatPlayerNameEl = document.getElementById('chatPlayerName');
  const savedName = localStorage.getItem('battle_nickname');

  if (savedName) {
    if (chatPlayerNameEl) chatPlayerNameEl.textContent = savedName;
    syncPlayerNickname(savedName);
  } else {
    // No name stored — clear the greeting and ask for name after a short delay
    if (chatPlayerNameEl) {
      chatPlayerNameEl.closest('.message-wrapper')?.remove();
    }
    setTimeout(askForName, 600);
  }
});

// Also run immediately for cases where DOM is already ready
if (document.readyState !== 'loading') {
  if (window.initCustomSelects) window.initCustomSelects();
  initChatSelects();

  const savedName = localStorage.getItem('battle_nickname');
  const chatPlayerNameEl = document.getElementById('chatPlayerName');

  if (savedName) {
    if (chatPlayerNameEl) chatPlayerNameEl.textContent = savedName;
    syncPlayerNickname(savedName);
  } else {
    if (chatPlayerNameEl) chatPlayerNameEl.closest('.message-wrapper')?.remove();
    setTimeout(askForName, 600);
  }
}



// Utility to format simple markdown-like text and line breaks safely
function formatMessageText(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// Scroll chat log to bottom
function scrollToBottom() {
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Clear the entire chat log, keeping only a fresh greetings prompt
function clearChatLog() {
  const savedName = localStorage.getItem('battle_nickname') || 'طالبنا العزيز';
  chatMessages.innerHTML = `
    <div class="message-wrapper incoming">
      <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="message-bubble">
        <p>تم إعادة تهيئة المحادثة. 🔄</p>
        <p>أهلاً بك يا <strong id="chatPlayerName">${formatMessageText(savedName)}</strong>! 👋</p>
        <p>كيف يمكنني مساعدتك الآن؟ اضغط على **"سؤال عشوائي 🎲"** أو **"بطاقات تفاعلية 🎴"** لنبدأ!</p>
      </div>
    </div>
  `;
  scrollToBottom();
}

// Render a message bubble in the chat log
function appendMessage(sender, text) {
  const isBot = sender === 'bot';
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${isBot ? 'incoming' : 'outgoing'}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = isBot ? '<i class="fa-solid fa-robot"></i>' : '<i class="fa-solid fa-user"></i>';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = formatMessageText(text);

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
}

// Render a flashcard widget
function appendFlashcard(flashcardData, isSpaced = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper incoming';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = '<i class="fa-solid fa-robot"></i>';

  const cardId = 'card_' + Date.now();

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble flashcard-bubble';
  bubble.style.background = 'transparent';
  bubble.style.border = 'none';
  bubble.style.padding = '0';
  bubble.style.boxShadow = 'none';

  // Build the actions panel based on card mode
  let actionsHtml = '';
  if (isSpaced) {
    actionsHtml = `
      <div class="flashcard-actions spaced-actions" onclick="event.stopPropagation()">
        <button class="btn-flashcard no" style="background: #ef4444; color: #fff;" onclick="handleSpacedGrade('${flashcardData.id}', 0, this)">نسيت ❌</button>
        <button class="btn-flashcard no" style="background: #f59e0b; color: #fff;" onclick="handleSpacedGrade('${flashcardData.id}', 3, this)">صعب ⚠️</button>
        <button class="btn-flashcard yes" style="background: #10b981; color: #fff;" onclick="handleSpacedGrade('${flashcardData.id}', 4, this)">جيد 👍</button>
        <button class="btn-flashcard yes" style="background: #3b82f6; color: #fff;" onclick="handleSpacedGrade('${flashcardData.id}', 5, this)">سهل 🚀</button>
        <button class="btn-flashcard mastered-btn" onclick="handleSpacedGrade('${flashcardData.id}', 6, this)">أتقنته تماماً! 🏆</button>
      </div>
    `;
  } else {
    actionsHtml = `
      <div class="flashcard-actions" onclick="event.stopPropagation()">
        <button class="btn-flashcard yes" onclick="handleFlashcardAction('${cardId}', true)">عرفته ✅</button>
        <button class="btn-flashcard no" onclick="handleFlashcardAction('${cardId}', false)">أحتاج لمراجعته ❌</button>
      </div>
    `;
  }

  const badgeText = isSpaced ? 'تكرار متباعد 📅' : 'بطاقة مراجعة 🎴';

  bubble.innerHTML = `
    <div class="flashcard-container" id="${cardId}" onclick="this.classList.toggle('flipped')" 
         data-question-id="${flashcardData.id || ''}" 
         data-question-type="${flashcardData.type || ''}" 
         data-question-data='${JSON.stringify(flashcardData).replace(/'/g, "&apos;")}'>
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <span class="flashcard-badge">${badgeText}</span>
          <p class="flashcard-text">${formatMessageText(flashcardData.question)}</p>
          <span class="flashcard-hint"><i class="fa-solid fa-rotate"></i> انقر لقلب البطاقة وكشف الحل</span>
        </div>
        <div class="flashcard-back">
          <span class="flashcard-badge">الإجابة النموذجية 💡</span>
          <p class="flashcard-text">${formatMessageText(flashcardData.answer)}</p>
          ${flashcardData.explanation ? `<p class="flashcard-explanation">${formatMessageText(flashcardData.explanation)}</p>` : ''}
          ${actionsHtml}
        </div>
      </div>
    </div>
  `;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
}

// Handle flashcard action (button clicks on flip side of casual flashcards)
function handleFlashcardAction(cardId, known) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const buttons = card.querySelectorAll('.btn-flashcard');
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  });

  const msg = known ? 'عرفت إجابة البطاقة! ✅' : 'أحتاج لمراجعة البطاقة! ❌';
  appendMessage('user', msg);
  showTypingIndicator();

  // If the user forgot, sync it to database
  if (!known) {
    const questionId = card.getAttribute('data-question-id');
    const questionType = card.getAttribute('data-question-type');
    const questionDataRaw = card.getAttribute('data-question-data');
    const playerName = localStorage.getItem('battle_nickname');

    if (playerName && questionId && questionType && questionDataRaw) {
      try {
        const questionData = JSON.parse(questionDataRaw);
        fetch('/chat/spaced/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName, questionId, questionType, questionData })
        })
        .then(res => res.json())
        .then(data => {
          removeTypingIndicator();
          if (data.success) {
            appendMessage('bot', 'عادي جداً يا بطل! تم إضافة السؤال لحافظة التكرار المتباعد الخاصة بك 📅. هنراجعه تاني في المرات الجاية لحد ما تتقنه تماماً!');
          } else {
            appendMessage('bot', 'ولا يهمك يا صاحبي! كرر قراءة الإجابة، المرة الجاية هتقفلها. 😉');
          }
        })
        .catch(err => {
          console.error(err);
          removeTypingIndicator();
          appendMessage('bot', 'ولا يهمك يا صاحبي! كرر قراءة الإجابة، المرة الجاية هتقفلها. 😉');
        });
      } catch (e) {
        console.error(e);
        removeTypingIndicator();
        appendMessage('bot', 'ولا يهمك يا صاحبي! كرر قراءة الإجابة، المرة الجاية هتقفلها. 😉');
      }
    } else {
      removeTypingIndicator();
      appendMessage('bot', 'ولا يهمك يا صاحبي! كرر قراءة الإجابة، المرة الجاية هتقفلها. 😉');
    }
  } else {
    // If they knew it, send it to chatbot normally
    fetch('/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        filter: 'all',
        personality: 'default',
        playerName: localStorage.getItem('battle_nickname')
      })
    })
    .then(res => res.json())
    .then(data => {
      removeTypingIndicator();
      if (data.reply) appendMessage('bot', data.reply);
    })
    .catch(err => {
      console.error(err);
      removeTypingIndicator();
    });
  }
}

// Handle Spaced Repetition Grading
function handleSpacedGrade(cardDbId, grade, btnEl) {
  const container = btnEl.closest('.flashcard-actions');
  if (!container) return;

  const buttons = container.querySelectorAll('.btn-flashcard');
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
  });

  const playerName = localStorage.getItem('battle_nickname');
  if (!playerName) {
    appendMessage('bot', '❌ عذراً، يجب عليك تعيين اسم مستخدم أولاً لبدء حفظ المراجعات.');
    return;
  }

  const gradeLabels = {
    0: 'نسيت الإجابة ❌',
    3: 'كان صعباً ⚠️',
    4: 'جيد 👍',
    5: 'سهل جداً 🚀',
    6: 'أتقنته تماماً! 🏆'
  };

  appendMessage('user', `تقييمي للبطاقة: ${gradeLabels[grade] || 'مراجعة'}`);
  showTypingIndicator();

  fetch('/chat/spaced/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: cardDbId, grade, playerName })
  })
  .then(res => res.json())
  .then(data => {
    removeTypingIndicator();
    if (data.success) {
      appendMessage('bot', data.reply);
      
      // If there is another due card, show it after a small delay to make it feel natural
      if (data.nextCard) {
        showTypingIndicator();
        setTimeout(() => {
          removeTypingIndicator();
          
          // Format next card answer
          let ansText = '';
          const qType = data.nextCard.question_type;
          const qData = data.nextCard.question_data;
          if (qType === 'truefalse') {
            const isTrue = qData.answer === true || qData.answer === 'true';
            ansText = isTrue ? 'صح (صحيح) ☑️' : 'خطأ (خاطئ) ❌';
          } else if (qType === 'multiple') {
            const idx = parseInt(qData.answer, 10);
            ansText = (Array.isArray(qData.options) && !isNaN(idx)) ? (qData.options[idx] || qData.answer) : qData.answer;
          } else {
            ansText = qData.answer;
          }

          const nextFlashcardData = {
            id: data.nextCard.id,
            type: qType,
            question: qData.question,
            answer: ansText,
            explanation: qData.explanation || '',
            source: qData.source || 'تكرار متباعد'
          };
          
          appendFlashcard(nextFlashcardData, true);
        }, 1200);
      }
    } else {
      appendMessage('bot', '❌ حدث خطأ أثناء معالجة التقييم.');
    }
  })
  .catch(err => {
    console.error(err);
    removeTypingIndicator();
    appendMessage('bot', '❌ حدث خطأ أثناء الاتصال بالخادم.');
  });
}

// Render a temporary typing indicator block
function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'message-wrapper incoming';
  indicator.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = '<i class="fa-solid fa-robot"></i>';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;

  indicator.appendChild(avatar);
  indicator.appendChild(bubble);
  chatMessages.appendChild(indicator);
  scrollToBottom();
}

// Remove the typing indicator block
function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.remove();
  }
}

// Send user message to route handler via POST request
async function sendMessage(messageText) {
  if (!messageText.trim()) return;

  // 1. Display user's message bubble
  appendMessage('user', messageText);

  // 2. Show thinking/typing state
  showTypingIndicator();

  // Read current filter and personality values from the custom select attributes
  const pHeader = document.getElementById('personalitySelectHeader');
  const pDrawer = document.getElementById('personalitySelectDrawer');
  const fHeader = document.getElementById('filterSelectHeader');
  const fDrawer = document.getElementById('filterSelectDrawer');
  
  const selectedPersonality = (pHeader ? pHeader.getAttribute('data-value') : '') || (pDrawer ? pDrawer.getAttribute('data-value') : '') || 'default';
  const selectedFilter = (fHeader ? fHeader.getAttribute('data-value') : '') || (fDrawer ? fDrawer.getAttribute('data-value') : '') || 'all';

  try {
    const response = await fetch('/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message: messageText,
        filter: selectedFilter,
        personality: selectedPersonality,
        playerName: localStorage.getItem('battle_nickname')
      })
    });

    const data = await response.json();
    removeTypingIndicator();

    // 3. Render bot's reply bubble
    if (data.reply) {
      appendMessage('bot', data.reply);
    }
    
    // 4. Render Flashcard if present in response
    if (data.status === 'flashcard' && data.flashcard) {
      appendFlashcard(data.flashcard, false);
    } else if (data.status === 'spaced_flashcard' && data.flashcard) {
      appendFlashcard(data.flashcard, true);
    }
    
    if (!data.reply && data.status !== 'flashcard' && data.status !== 'spaced_flashcard') {
      appendMessage('bot', 'عذراً، لم أستطع فهم طلبك بشكل صحيح.');
    }
  } catch (error) {
    console.error('Chat error:', error);
    removeTypingIndicator();
    appendMessage('bot', '❌ حدث خطأ أثناء الاتصال بالخادم. الرجاء التحقق من جودة اتصالك بالشبكة.');
  }
}

// Triggers an immediate action when clicking instruction/pill elements
function triggerQuickAction(commandText) {
  sendMessage(commandText);
}

// Form submit event handler
if (chatForm) {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;
    userInput.value = '';

    // ── NAME COLLECTION MODE ──
    if (awaitingName) {
      appendMessage('user', text);
      saveNameAndGreet(text);
      return;
    }

    sendMessage(text);
  });
}


// Auto scroll on load
scrollToBottom();
