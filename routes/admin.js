const express = require('express');
const router = express.Router();
const db = require('../data/db');

// ── AUTH MIDDLEWARE ───────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin/login');
}

// ── LOGIN ─────────────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { title: 'تسجيل دخول الإدارة', error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (db.verifyAdmin(username, password)) {
    req.session.isAdmin = true;
    req.session.username = username;
    return res.redirect('/admin');
  }
  res.render('admin/login', { title: 'تسجيل دخول الإدارة', error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ── DASHBOARD ─────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const quizzes = db.getQuizzes();
  const reviews = db.getReviews();
  res.render('admin/dashboard', {
    title: 'لوحة التحكم',
    quizzes,
    reviews,
    stats: {
      totalQuizzes: quizzes.length,
      totalReviews: reviews.length,
      totalQuestions: quizzes.reduce((a, q) => a + q.questions.length, 0),
      totalEssays: reviews.reduce((a, r) => a + r.sections.reduce((b, s) => b + s.questions.length, 0), 0)
    }
  });
});

// ══════════════════════════════════════════════════════════
// QUIZ CRUD
// ══════════════════════════════════════════════════════════

// List quizzes
router.get('/quizzes', requireAuth, (req, res) => {
  res.render('admin/quizzes', { title: 'إدارة الاختبارات', quizzes: db.getQuizzes() });
});

// New quiz form
router.get('/quizzes/new', requireAuth, (req, res) => {
  res.render('admin/quiz-form', { title: 'إضافة اختبار جديد', quiz: null, mode: 'create' });
});

// Create quiz
router.post('/quizzes', requireAuth, (req, res) => {
  const { title, description, icon, color, questions } = req.body;
  const parsedQuestions = parseQuestions(questions);
  db.createQuiz({ title, description, icon: icon || '📝', color: color || '#00d4aa', questions: parsedQuestions });
  res.redirect('/admin/quizzes');
});

// ── Import quiz from CSV (must be BEFORE /quizzes/:id routes) ─────────────
// Format per line:
//   صح/خطأ | نص السؤال | صح أو خطأ | شرح (اختياري)
//   اختيار  | نص السؤال | خيار1 | خيار2 | خيار3 | خيار4 | رقم الإجابة | شرح (اختياري)
router.post('/quizzes/import-csv', requireAuth, (req, res) => {
  const { csvData, title, icon, color } = req.body;
  if (!csvData || !title) {
    return res.status(400).json({ error: 'بيانات ناقصة' });
  }

  try {
    const lines = csvData.trim().split('\n');
    const questions = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue; // skip empty & comment lines

      const parts = line.split('|').map(p => p.trim());
      if (parts.length < 2) continue;

      const typePart = parts[0].toLowerCase();
      const isTrueFalse = typePart.includes('صح') || typePart.includes('true');
      const question = parts[1];

      if (isTrueFalse) {
        // صح/خطأ | السؤال | الإجابة (صح/خطأ/true/false) | شرح
        const answerRaw = (parts[2] || '').toLowerCase();
        const answer = answerRaw === 'صح' || answerRaw === 'true';
        const explanation = parts[3] || '';
        questions.push({
          id: 'q-' + Date.now() + '-' + i,
          type: 'truefalse',
          question,
          answer,
          explanation
        });
      } else {
        // اختيار | السؤال | خيار1 | خيار2 | خيار3 | خيار4 | رقم الإجابة | شرح
        // Minimum: type + question + 2 options + answer index = 5 parts
        if (parts.length < 5) continue;

        // Collect options: everything from index 2 up to the last two parts
        // Last part may be explanation (non-numeric), second-to-last is answer index (numeric)
        let optionEnd = parts.length - 1;
        let explanation = '';
        let answerIdx = 0;

        // Check if the last part is a non-numeric explanation
        if (isNaN(parts[parts.length - 1]) && parts.length >= 5) {
          explanation = parts[parts.length - 1];
          optionEnd = parts.length - 2;
        }

        // Answer index is the last remaining part (should be a number)
        if (!isNaN(parts[optionEnd])) {
          answerIdx = parseInt(parts[optionEnd], 10) - 1;
          optionEnd -= 1;
        }

        const options = parts.slice(2, optionEnd + 1).filter(o => o);
        if (options.length < 2) continue; // need at least 2 options

        const safeIdx = Math.max(0, Math.min(answerIdx, options.length - 1));
        questions.push({
          id: 'q-' + Date.now() + '-' + i,
          type: 'multiple',
          question,
          options,
          answer: safeIdx,
          explanation
        });
      }
    }

    if (questions.length === 0) {
      return res.status(400).json({ error: 'لم يتم العثور على أسئلة صحيحة في البيانات المدخلة' });
    }

    db.createQuiz({
      title,
      description: 'مستورد من CSV',
      icon: icon || '📝',
      color: color || '#00d4aa',
      questions
    });

    res.json({ success: true, count: questions.length });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(400).json({ error: 'خطأ في معالجة البيانات: ' + err.message });
  }
});

// Edit quiz form
router.get('/quizzes/:id/edit', requireAuth, (req, res) => {
  const quiz = db.getQuiz(req.params.id);
  if (!quiz) return res.redirect('/admin/quizzes');
  res.render('admin/quiz-form', { title: 'تعديل الاختبار', quiz, mode: 'edit' });
});

// Clone quiz
router.post('/quizzes/:id/clone', requireAuth, (req, res) => {
  const quiz = db.getQuiz(req.params.id);
  if (!quiz) return res.redirect('/admin/quizzes');

  const clonedQuiz = {
    title: `${quiz.title} (نسخة)`,
    description: quiz.description,
    icon: quiz.icon,
    color: quiz.color,
    questions: JSON.parse(JSON.stringify(quiz.questions))
  };
  db.createQuiz(clonedQuiz);
  res.redirect('/admin/quizzes');
});

// Delete quiz
router.post('/quizzes/:id/delete', requireAuth, (req, res) => {
  db.deleteQuiz(req.params.id);
  res.redirect('/admin/quizzes');
});

// Update quiz  (keep last among POST /quizzes/:id* to avoid shadowing)
router.post('/quizzes/:id', requireAuth, (req, res) => {
  const { title, description, icon, color, questions } = req.body;
  const parsedQuestions = parseQuestions(questions);
  db.updateQuiz(req.params.id, { title, description, icon: icon || '📝', color: color || '#00d4aa', questions: parsedQuestions });
  res.redirect('/admin/quizzes');
});

// ── API: get quiz JSON for editor ─────────────────────────
router.get('/api/quiz/:id', requireAuth, (req, res) => {
  const quiz = db.getQuiz(req.params.id);
  res.json(quiz || {});
});

// Get question templates
router.get('/api/templates', requireAuth, (req, res) => {
  const templates = [
    {
      id: 'template-1',
      name: 'أسئلة صح/خطأ عامة',
      type: 'truefalse',
      questions: [
        { type: 'truefalse', question: '', answer: true, explanation: '' }
      ]
    },
    {
      id: 'template-2',
      name: 'اختيار متعدد (4 خيارات)',
      type: 'multiple',
      questions: [
        { type: 'multiple', question: '', options: ['', '', '', ''], answer: 0, explanation: '' }
      ]
    },
    {
      id: 'template-3',
      name: 'مزيج (صح/خطأ + اختيار)',
      type: 'mixed',
      questions: [
        { type: 'truefalse', question: '', answer: true, explanation: '' },
        { type: 'multiple', question: '', options: ['', '', '', ''], answer: 0, explanation: '' }
      ]
    }
  ];
  res.json(templates);
});

// ══════════════════════════════════════════════════════════
// REVIEW CRUD
// ══════════════════════════════════════════════════════════

router.get('/reviews', requireAuth, (req, res) => {
  res.render('admin/reviews', { title: 'إدارة المراجعات', reviews: db.getReviews() });
});

router.get('/reviews/new', requireAuth, (req, res) => {
  res.render('admin/review-form', { title: 'إضافة مراجعة جديدة', review: null, mode: 'create' });
});

router.post('/reviews', requireAuth, (req, res) => {
  const { title, subject, icon, color, description, sections } = req.body;
  const parsedSections = parseSections(sections);
  db.createReview({ title, subject, icon: icon || '📚', color: color || '#00d4aa', description, sections: parsedSections });
  res.redirect('/admin/reviews');
});

router.get('/reviews/:id/edit', requireAuth, (req, res) => {
  const review = db.getReview(req.params.id);
  if (!review) return res.redirect('/admin/reviews');
  res.render('admin/review-form', { title: 'تعديل المراجعة', review, mode: 'edit' });
});

router.post('/reviews/:id', requireAuth, (req, res) => {
  const { title, subject, icon, color, description, sections } = req.body;
  const parsedSections = parseSections(sections);
  db.updateReview(req.params.id, { title, subject, icon: icon || '📚', color: color || '#00d4aa', description, sections: parsedSections });
  res.redirect('/admin/reviews');
});

router.post('/reviews/:id/delete', requireAuth, (req, res) => {
  db.deleteReview(req.params.id);
  res.redirect('/admin/reviews');
});

// ══════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════
router.get('/settings', requireAuth, (req, res) => {
  res.render('admin/settings', { title: 'الإعدادات', success: null, error: null });
});

router.post('/settings/password', requireAuth, (req, res) => {
  const { current, newPass, confirm } = req.body;
  if (!db.verifyAdmin(req.session.username, current)) {
    return res.render('admin/settings', { title: 'الإعدادات', error: 'كلمة المرور الحالية غير صحيحة', success: null });
  }
  if (newPass !== confirm) {
    return res.render('admin/settings', { title: 'الإعدادات', error: 'كلمتا المرور غير متطابقتين', success: null });
  }
  if (newPass.length < 6) {
    return res.render('admin/settings', { title: 'الإعدادات', error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', success: null });
  }
  db.updateAdminPassword(newPass);
  res.render('admin/settings', { title: 'الإعدادات', success: 'تم تغيير كلمة المرور بنجاح', error: null });
});

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════
function parseQuestions(raw) {
  if (!raw) return [];
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw;
  } catch { return []; }
}

function parseSections(raw) {
  if (!raw) return [];
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw;
  } catch { return []; }
}

module.exports = router;
