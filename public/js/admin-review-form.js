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
      <span style="font-weight:700;color:var(--accent);font-size:0.9rem">📂 قسم تلخيص / شرح</span>
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

      <!-- Section elements (Essay, Table, Math) -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem">
          <label class="form-label">📝 عناصر هذا القسم (${(sec.questions || []).length})</label>
          <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
            <button type="button" class="btn-sm btn-purple" onclick="addEssayQ(${si})" title="إضافة سؤال مقالي تقليدي"><i class="fa-solid fa-pen-nib"></i> سؤال مقالي</button>
            <button type="button" class="btn-sm btn-blue" onclick="addTableQ(${si})" title="إضافة جدول مقارنة تفاعلي"><i class="fa-solid fa-table"></i> جدول مقارنة</button>
            <button type="button" class="btn-sm btn-green" onclick="addMathQ(${si})" title="إضافة مسألة رياضية أو حسابية"><i class="fa-solid fa-square-root-variable"></i> مسألة رياضية</button>
          </div>
        </div>
        <div class="essay-builder-list" id="essays_${si}">
          ${(sec.questions || []).map((q, qi) => buildQuestionCard(q, si, qi)).join('')}
          ${(!sec.questions || sec.questions.length === 0) ? `<div style="color:var(--text-dim);font-size:0.85rem;padding:0.5rem 0">لا توجد عناصر مضافة في هذا القسم بعد. اضغط على أزرار الإضافة أعلاه للبدء.</div>` : ''}
        </div>
      </div>
    </div>`;

  return card;
}

function buildQuestionCard(q, si, qi) {
  const type = q.type || 'essay';

  if (type === 'table') {
    return `
      <div class="essay-builder-card table-builder-card" style="border-right: 4px solid #38bdf8">
        <div class="essay-builder-header">
          <span>📊 جدول مقارنة ${qi + 1}</span>
          <button type="button" class="q-del-btn" style="margin-right:auto"
            onclick="deleteEssayQ(${si}, ${qi})">🗑️</button>
        </div>
        <div class="form-group" style="margin-bottom:0.75rem">
          <label class="form-label">عنوان الجدول *</label>
          <input type="text" class="form-input" placeholder="مثال: مقارنة الخلايا النباتية والحيوانية"
            value="${escHtml(q.question || '')}"
            onchange="updateEssayQ(${si}, ${qi}, 'question', this.value)">
        </div>
        <div class="form-group" style="margin-bottom:0.75rem">
          <label class="form-label">رؤوس الأعمدة (مفصولة بـ |) *</label>
          <input type="text" class="form-input" placeholder="وجه المقارنة | الخلية النباتية | الخلية الحيوانية"
            value="${escHtml(q.headers || '')}"
            onchange="updateEssayQ(${si}, ${qi}, 'headers', this.value)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">الصفوف (كل صف في سطر، الخلايا مفصولة بـ |) *</label>
          <textarea class="form-textarea" rows="4" placeholder="الجدار الخلوي | يوجد | لا يوجد&#10;البلاستيدات الخضراء | توجد | لا توجد" 
            onchange="updateEssayQ(${si}, ${qi}, 'rows', this.value)">${escHtml(q.rows || '')}</textarea>
        </div>
      </div>`;
  }

  if (type === 'math') {
    return `
      <div class="essay-builder-card math-builder-card" style="border-right: 4px solid #34d399">
        <div class="essay-builder-header">
          <span>📐 مسألة رياضية ${qi + 1}</span>
          <button type="button" class="q-del-btn" style="margin-right:auto"
            onclick="deleteEssayQ(${si}, ${qi})">🗑️</button>
        </div>
        <div class="form-group" style="margin-bottom:0.75rem">
          <label class="form-label">نص المسألة الرياضية / العلمية *</label>
          <textarea class="form-textarea" rows="2" placeholder="اكتب المسألة الرياضية (مثال: احسب تسارع جسم كتلته 5 كجم...)" 
            onchange="updateEssayQ(${si}, ${qi}, 'question', this.value)">${escHtml(q.question || '')}</textarea>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">خطوات الحل ونموذج الإجابة *</label>
          <textarea class="form-textarea" rows="4" placeholder="اكتب القوانين وخطوات الحل والناتج النهائي..." 
            onchange="updateEssayQ(${si}, ${qi}, 'answer', this.value)">${escHtml(q.answer || '')}</textarea>
        </div>
      </div>`;
  }

  // Standard essay
  return `
    <div class="essay-builder-card" style="border-right: 4px solid var(--accent)">
      <div class="essay-builder-header">
        <span>✍️ سؤال مقالي ${qi + 1}</span>
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
  sections[si].questions.push({ id: 'eq-' + Date.now(), type: 'essay', question: '', answer: '' });
  renderAll();
}

function addTableQ(si) {
  if (!sections[si].questions) sections[si].questions = [];
  sections[si].questions.push({ id: 'eq-' + Date.now(), type: 'table', question: '', headers: '', rows: '' });
  renderAll();
}

function addMathQ(si) {
  if (!sections[si].questions) sections[si].questions = [];
  sections[si].questions.push({ id: 'eq-' + Date.now(), type: 'math', question: '', answer: '' });
  renderAll();
}

function deleteEssayQ(si, qi) {
  if (!confirm('حذف هذا العنصر؟')) return;
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
      const q = qs[qi];
      if (q.type === 'table') {
        if (!q.question.trim() || !q.headers.trim() || !q.rows.trim()) {
          alert(`يرجى إكمال جدول المقارنة ${qi + 1} في القسم ${si + 1}`);
          return false;
        }
      } else {
        if (!q.question.trim() || !q.answer.trim()) {
          alert(`يرجى إكمال السؤال ${qi + 1} في القسم ${si + 1}`);
          return false;
        }
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
