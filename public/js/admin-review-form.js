// ── STATE ─────────────────────────────────────────────────
let sections = [];

// ── INIT ──────────────────────────────────────────────────
if (INITIAL_REVIEW && INITIAL_REVIEW.sections) {
  sections = JSON.parse(JSON.stringify(INITIAL_REVIEW.sections));
}
renderAll();

// ── RENDER ────────────────────────────────────────────────
function renderAll() {
  const container = document.getElementById('sectionsBuilder');
  const count = document.getElementById('sectionCount');
  count.textContent = sections.length;

  if (sections.length === 0) {
    container.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'questions-empty';
    empty.innerHTML = '<span>📂</span> لم تضف أي أقسام بعد — اضغط على "إضافة قسم" للبدء';
    container.appendChild(empty);
    return;
  }

  container.innerHTML = '';
  sections.forEach((sec, si) => container.appendChild(buildSectionCard(sec, si)));
}

// ── BUILD SECTION CARD ────────────────────────────────────
function buildSectionCard(sec, si) {
  const card = document.createElement('div');
  card.className = 'section-builder-card';

  card.innerHTML = `
    <div class="section-builder-header">
      <div class="section-num-badge">${si + 1}</div>
      <span style="font-weight:700;color:#a78bfa;font-size:0.9rem">📂 قسم</span>
      <div class="q-builder-actions" style="margin-right:auto;display:flex;gap:0.4rem">
        ${si > 0 ? `<button type="button" class="q-del-btn" onclick="moveSection(${si},-1)">↑</button>` : ''}
        ${si < sections.length - 1 ? `<button type="button" class="q-del-btn" onclick="moveSection(${si},1)">↓</button>` : ''}
        <button type="button" class="q-del-btn" onclick="deleteSection(${si})">🗑️</button>
      </div>
    </div>

    <div class="section-builder-body">
      <!-- Section title -->
      <div class="form-group">
        <label class="form-label">عنوان القسم *</label>
        <input type="text" class="form-input" placeholder="مثال: الحركة والقوى"
          value="${escHtml(sec.title || '')}"
          onchange="updateSection(${si}, 'title', this.value)">
      </div>

      <!-- Section content -->
      <div class="form-group">
        <label class="form-label">ملخص / محتوى القسم</label>
        <textarea class="form-textarea" rows="3" placeholder="اكتب ملخصاً أو شرحاً للموضوع..."
          onchange="updateSection(${si}, 'content', this.value)">${escHtml(sec.content || '')}</textarea>
      </div>

      <!-- Essay Questions -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
          <label class="form-label">✍️ الأسئلة المقالية (${(sec.questions || []).length})</label>
          <button type="button" class="btn-sm btn-purple" onclick="addEssayQ(${si})">➕ سؤال مقالي</button>
        </div>
        <div class="essay-builder-list" id="essays_${si}">
          ${(sec.questions || []).map((q, qi) => buildEssayCard(q, si, qi)).join('')}
          ${(!sec.questions || sec.questions.length === 0) ? `<div style="color:#3a4d6a;font-size:0.85rem;padding:0.5rem 0">لا توجد أسئلة مقالية في هذا القسم بعد</div>` : ''}
        </div>
      </div>
    </div>`;

  return card;
}

function buildEssayCard(q, si, qi) {
  return `
    <div class="essay-builder-card">
      <div class="essay-builder-header">
        <span>✍️</span> سؤال مقالي ${qi + 1}
        <button type="button" class="q-del-btn" style="margin-right:auto"
          onclick="deleteEssayQ(${si}, ${qi})">🗑️</button>
      </div>
      <div class="form-group" style="margin-bottom:0.75rem">
        <label class="form-label">نص السؤال *</label>
        <textarea class="form-textarea" rows="2" placeholder="اكتب السؤال المقالي..."
          onchange="updateEssayQ(${si}, ${qi}, 'question', this.value)">${escHtml(q.question || '')}</textarea>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">نموذج الإجابة *</label>
        <textarea class="form-textarea" rows="4" placeholder="اكتب نموذج الإجابة الكاملة..."
          onchange="updateEssayQ(${si}, ${qi}, 'answer', this.value)">${escHtml(q.answer || '')}</textarea>
      </div>
    </div>`;
}

// ── MUTATIONS ─────────────────────────────────────────────
function addSection() {
  sections.push({ id: 'sec-' + Date.now(), title: '', content: '', questions: [] });
  renderAll();
  setTimeout(() => {
    const cards = document.querySelectorAll('.section-builder-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function deleteSection(si) {
  if (!confirm('حذف هذا القسم وكل أسئلته؟')) return;
  sections.splice(si, 1);
  renderAll();
}

function moveSection(si, dir) {
  const ni = si + dir;
  if (ni < 0 || ni >= sections.length) return;
  [sections[si], sections[ni]] = [sections[ni], sections[si]];
  renderAll();
}

function updateSection(si, field, value) {
  sections[si][field] = value;
}

function addEssayQ(si) {
  if (!sections[si].questions) sections[si].questions = [];
  sections[si].questions.push({ id: 'eq-' + Date.now(), question: '', answer: '' });
  renderAll();
}

function deleteEssayQ(si, qi) {
  if (!confirm('حذف هذا السؤال؟')) return;
  sections[si].questions.splice(qi, 1);
  renderAll();
}

function updateEssayQ(si, qi, field, value) {
  sections[si].questions[qi][field] = value;
}

// ── SUBMIT ────────────────────────────────────────────────
function prepareSubmit() {
  if (sections.length === 0) {
    alert('يرجى إضافة قسم واحد على الأقل');
    return false;
  }
  for (let si = 0; si < sections.length; si++) {
    if (!sections[si].title.trim()) {
      alert(`يرجى كتابة عنوان القسم رقم ${si + 1}`);
      return false;
    }
    const qs = sections[si].questions || [];
    for (let qi = 0; qi < qs.length; qi++) {
      if (!qs[qi].question.trim() || !qs[qi].answer.trim()) {
        alert(`يرجى إكمال السؤال المقالي ${qi + 1} في القسم ${si + 1}`);
        return false;
      }
    }
  }
  document.getElementById('sectionsInput').value = JSON.stringify(sections);
  return true;
}

// ── HELPERS ───────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
