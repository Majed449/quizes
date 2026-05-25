// ── STATE ─────────────────────────────────────────────────
let questions = [];
const LETTERS = ['أ', 'ب', 'ج', 'د'];
let autoSaveTimer = null;
let lastSaveTime = Date.now();

// ── INIT ──────────────────────────────────────────────────
if (INITIAL_QUIZ && INITIAL_QUIZ.questions) {
  questions = JSON.parse(JSON.stringify(INITIAL_QUIZ.questions));
}
renderAll();
setupKeyboardShortcuts();
loadAutoSave();

// ── AUTO SAVE & KEYBOARD SHORTCUTS ───────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+S or Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveQuizDraft();
    }
    // Alt+T to add True/False
    if (e.altKey && e.key === 't') {
      e.preventDefault();
      addQuestion('truefalse');
    }
    // Alt+M to add Multiple Choice
    if (e.altKey && e.key === 'm') {
      e.preventDefault();
      addQuestion('multiple');
    }
  });
}

function autoSaveQuiz() {
  if (questions.length > 0) {
    const quizData = {
      title: document.querySelector('[name="title"]')?.value || 'بدون عنوان',
      description: document.querySelector('[name="description"]')?.value || '',
      icon: document.querySelector('[name="icon"]')?.value || '📝',
      color: document.querySelector('[name="color"]')?.value || '#00d4aa',
      questions: questions,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('quizDraft', JSON.stringify(quizData));
    showSaveIndicator('تم الحفظ التلقائي ✓');
  }
}

function loadAutoSave() {
  const draft = localStorage.getItem('quizDraft');
  if (!INITIAL_QUIZ && draft) {
    const data = JSON.parse(draft);
    const savedTime = new Date(data.savedAt).toLocaleTimeString('ar-SA');
    if (confirm(`تم العثور على مسودة محفوظة من ${savedTime}. هل تريد استعادتها؟`)) {
      questions = data.questions;
      document.querySelector('[name="title"]').value = data.title;
      document.querySelector('[name="description"]').value = data.description;
      document.querySelector('[name="icon"]').value = data.icon;
      document.querySelector('[name="color"]').value = data.color;
      renderAll();
    }
  }
}

function saveQuizDraft() {
  autoSaveQuiz();
}

function showSaveIndicator(msg) {
  const div = document.createElement('div');
  div.className = 'save-indicator';
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, 2000);
}

// Auto save every 30 seconds
setInterval(() => {
  autoSaveQuiz();
}, 30000);

// ── RENDER ────────────────────────────────────────────────
function renderAll() {
  const container = document.getElementById('questionsBuilder');
  const emptyMsg  = document.getElementById('emptyMsg');
  const qCount    = document.getElementById('qCount');

  qCount.textContent = questions.length;

  if (questions.length === 0) {
    container.innerHTML = '';
    container.appendChild(createEmptyMsg());
    return;
  }

  container.innerHTML = '';
  questions.forEach((q, i) => {
    container.appendChild(buildQuestionCard(q, i));
  });
}

function createEmptyMsg() {
  const div = document.createElement('div');
  div.className = 'questions-empty';
  div.id = 'emptyMsg';
  div.innerHTML = '<span>❓</span> لم تضف أي أسئلة بعد — اضغط على أحد الأزرار أعلاه للبدء';
  return div;
}

// ── BUILD QUESTION CARD ───────────────────────────────────
function buildQuestionCard(q, index) {
  const card = document.createElement('div');
  card.className = 'q-builder-card';
  card.dataset.index = index;

  const isTF = q.type === 'truefalse';
  const badgeClass = isTF ? 'q-type-badge-tf' : 'q-type-badge-mc';
  const badgeLabel = isTF ? '✓ صح أم خطأ' : '🎯 اختيار متعدد';

  card.innerHTML = `
    <div class="q-builder-header">
      <div class="q-builder-num">${index + 1}</div>
      <span class="${badgeClass}">${badgeLabel}</span>
      <div class="q-builder-actions">
        ${index > 0 ? `<button type="button" class="q-del-btn" title="تحريك لأعلى" onclick="moveQuestion(${index}, -1)">↑</button>` : ''}
        ${index < questions.length - 1 ? `<button type="button" class="q-del-btn" title="تحريك لأسفل" onclick="moveQuestion(${index}, 1)">↓</button>` : ''}
        <button type="button" class="q-del-btn" onclick="deleteQuestion(${index})" title="حذف">🗑️</button>
      </div>
    </div>
    <div class="q-builder-body">
      <!-- Question Text -->
      <div class="form-group">
        <label class="form-label">نص السؤال *</label>
        <textarea class="form-textarea" rows="2" placeholder="اكتب السؤال هنا..."
          onchange="updateQuestion(${index}, 'question', this.value)">${escHtml(q.question || '')}</textarea>
      </div>

      <!-- Options / TF -->
      ${isTF ? buildTFOptions(q, index) : buildMCOptions(q, index)}

      <!-- Explanation -->
      <div class="form-group">
        <label class="form-label">شرح الإجابة (اختياري)</label>
        <input type="text" class="form-input" placeholder="سيظهر بعد الإجابة..."
          value="${escHtml(q.explanation || '')}"
          onchange="updateQuestion(${index}, 'explanation', this.value)">
      </div>
    </div>
  `;
  return card;
}

function buildTFOptions(q, index) {
  const isTrue  = q.answer === true;
  const isFalse = q.answer === false;
  return `
    <div class="form-group">
      <label class="form-label">الإجابة الصحيحة</label>
      <div class="tf-answer-wrap">
        <div class="tf-radio-option" style="${isTrue ? 'border-color:#00d4aa;background:rgba(0,212,170,0.08)' : ''}">
          <input type="radio" name="tf_${index}" id="tf_true_${index}" ${isTrue ? 'checked' : ''}
            onchange="updateTFAnswer(${index}, true)">
          <label for="tf_true_${index}" style="color:#00d4aa">✓ صح</label>
        </div>
        <div class="tf-radio-option" style="${isFalse ? 'border-color:#ff6b6b;background:rgba(255,107,107,0.08)' : ''}">
          <input type="radio" name="tf_${index}" id="tf_false_${index}" ${isFalse ? 'checked' : ''}
            onchange="updateTFAnswer(${index}, false)">
          <label for="tf_false_${index}" style="color:#ff6b6b">✗ خطأ</label>
        </div>
      </div>
    </div>`;
}

function buildMCOptions(q, index) {
  const opts = (q.options && q.options.length > 0) ? q.options : ['', '', '', ''];
  while (opts.length < 2) opts.push('');

  let html = `
    <div class="form-group">
      <label class="form-label">الخيارات والإجابة الصحيحة</label>
      <div class="options-builder" id="opts_${index}">
  `;

  opts.forEach((opt, oi) => {
    const isCorrect = q.answer === oi;
    html += `
      <div class="option-row" data-opt="${oi}">
        <div class="option-letter-badge">${LETTERS[oi] || (oi + 1)}</div>
        <input type="text" class="form-input" style="flex:1" placeholder="نص الخيار ${oi + 1}"
          value="${escHtml(opt)}"
          onchange="updateOption(${index}, ${oi}, this.value)">
        <div class="option-correct-radio">
          <input type="radio" name="correct_${index}" id="correct_${index}_${oi}" ${isCorrect ? 'checked' : ''}
            onchange="updateQuestion(${index}, 'answer', ${oi})">
          <label for="correct_${index}_${oi}">صحيح</label>
        </div>
        ${opts.length > 2 ? `<button type="button" class="q-del-btn" onclick="removeOption(${index},${oi})" title="حذف الخيار">✕</button>` : ''}
      </div>`;
  });

  if (opts.length < 6) {
    html += `
      <button type="button" class="btn-sm btn-green" style="align-self:flex-start;margin-top:0.25rem"
        onclick="addOption(${index})">➕ خيار جديد</button>`;
  }

  html += `</div></div>`;
  return html;
}

// ── MUTATIONS ─────────────────────────────────────────────
function addQuestion(type) {
  const q = { id: 'q-' + Date.now(), type, question: '', explanation: '' };
  if (type === 'truefalse') { q.answer = true; }
  else { q.options = ['', '', '', '']; q.answer = 0; }
  questions.push(q);
  renderAll();
  autoSaveQuiz();
  // Scroll to last card
  setTimeout(() => {
    const cards = document.querySelectorAll('.q-builder-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);
}

function addQuestionFromTemplate(template) {
  if (template.questions) {
    template.questions.forEach(q => {
      const newQ = JSON.parse(JSON.stringify(q));
      newQ.id = 'q-' + Date.now() + Math.random();
      questions.push(newQ);
    });
  }
  renderAll();
  autoSaveQuiz();
  // closeTemplateModal();
}

function deleteQuestion(index) {
  if (!confirm('حذف هذا السؤال؟')) return;
  questions.splice(index, 1);
  renderAll();
  autoSaveQuiz();
}

function moveQuestion(index, dir) {
  const newIdx = index + dir;
  if (newIdx < 0 || newIdx >= questions.length) return;
  [questions[index], questions[newIdx]] = [questions[newIdx], questions[index]];
  renderAll();
  autoSaveQuiz();
}

function updateQuestion(index, field, value) {
  questions[index][field] = value;
  autoSaveQuiz();
}

function updateTFAnswer(index, value) {
  questions[index].answer = value;
  renderAll();
  autoSaveQuiz();
}

function updateOption(index, optIndex, value) {
  if (!questions[index].options) questions[index].options = [];
  questions[index].options[optIndex] = value;
  autoSaveQuiz();
}

function addOption(index) {
  if (!questions[index].options) questions[index].options = [];
  questions[index].options.push('');
  renderAll();
  autoSaveQuiz();
}

function removeOption(index, optIndex) {
  questions[index].options.splice(optIndex, 1);
  if (questions[index].answer >= questions[index].options.length) {
    questions[index].answer = 0;
  }
  renderAll();
  autoSaveQuiz();
}

// ── TEMPLATES ─────────────────────────────────────────────
function openTemplateModal() {
  const modal = document.getElementById('templateModal');
  if (!modal) return;
  loadTemplates();
  modal.style.display = 'flex';
}

function closeTemplateModal() {
  const modal = document.getElementById('templateModal');
  if (modal) modal.style.display = 'none';
}

async function loadTemplates() {
  try {
    const res = await fetch('/admin/api/templates');
    const templates = await res.json();
    const container = document.getElementById('templatesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    templates.forEach(t => {
      const div = document.createElement('div');
      div.className = 'template-card';
      div.innerHTML = `
        <div class="template-name">${t.name}</div>
        <div class="template-type">${t.type === 'truefalse' ? '✓ صح/خطأ' : '🎯 اختيار متعدد'}</div>
        <button onclick="addQuestionFromTemplate(${JSON.stringify(t).replace(/"/g, '&quot;')})">
          ➕ إضافة
        </button>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Error loading templates:', err);
  }
}

// ── SUBMIT ────────────────────────────────────────────────
function prepareSubmit() {
  // Validate
  if (questions.length === 0) {
    alert('يرجى إضافة سؤال واحد على الأقل');
    return false;
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.question.trim()) {
      alert(`يرجى كتابة نص السؤال رقم ${i + 1}`);
      return false;
    }
    if (q.type === 'multiple') {
      const nonEmpty = (q.options || []).filter(o => o.trim());
      if (nonEmpty.length < 2) {
        alert(`السؤال رقم ${i + 1} يجب أن يحتوي على خيارين على الأقل`);
        return false;
      }
      if (q.answer === undefined || q.answer === null || q.answer < 0 || q.answer >= q.options.length) {
        alert(`يرجى اختيار الإجابة الصحيحة للسؤال رقم ${i + 1}`);
        return false;
      }
      if (!q.options[q.answer] || !q.options[q.answer].trim()) {
        alert(`الإجابة الصحيحة المحددة للسؤال رقم ${i + 1} لا يمكن أن تكون خياراً فارغاً`);
        return false;
      }
    } else if (q.type === 'truefalse') {
      if (q.answer !== true && q.answer !== false) {
        alert(`يرجى تحديد الإجابة الصحيحة (صح أو خطأ) للسؤال رقم ${i + 1}`);
        return false;
      }
    }
  }
  document.getElementById('questionsInput').value = JSON.stringify(questions);
  return true;
}

// ── HELPERS ───────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
