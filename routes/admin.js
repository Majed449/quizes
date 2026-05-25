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

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (await db.verifyAdmin(username, password)) {
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
router.get('/', requireAuth, async (req, res) => {
  try {
    const quizzes = await db.getQuizzes();
    const reviews = await db.getReviews();
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
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// ══════════════════════════════════════════════════════════
// QUIZ CRUD
// ══════════════════════════════════════════════════════════

// List quizzes
router.get('/quizzes', requireAuth, async (req, res) => {
  try {
    res.render('admin/quizzes', { title: 'إدارة الاختبارات', quizzes: await db.getQuizzes() });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// New quiz form
router.get('/quizzes/new', requireAuth, (req, res) => {
  res.render('admin/quiz-form', { title: 'إضافة اختبار جديد', quiz: null, mode: 'create' });
});

// Create quiz
router.post('/quizzes', requireAuth, async (req, res) => {
  try {
    const { title, description, icon, color, questions } = req.body;
    const parsedQuestions = parseQuestions(questions);
    await db.createQuiz({ title, description, icon: icon || '📝', color: color || '#00d4aa', questions: parsedQuestions });
    res.redirect('/admin/quizzes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// ── Import quiz from CSV (must be BEFORE /quizzes/:id routes) ─────────────
// Format per line:
//   صح/خطأ | نص السؤال | صح أو خطأ | شرح (اختياري)
//   اختيار  | نص السؤال | خيار1 | خيار2 | خيار3 | خيار4 | رقم الإجابة | شرح (اختياري)
router.post('/quizzes/import-csv', requireAuth, async (req, res) => {
  const { csvData, title, icon, color } = req.body;
  if (!csvData || !title) {
    return res.status(400).json({ error: 'بيانات ناقصة (العنوان ومحتوى الملف مطلوبان)' });
  }

  try {
    const lines = csvData.trim().split(/\r?\n/);
    const questions = [];
    const seenInUpload = new Map(); // normalized question text -> line number

    // Get all existing questions in the DB to prevent duplicates (Anime Ziadah style)
    const existingQuizzes = await db.getQuizzes();
    const existingQuestions = new Set();
    existingQuizzes.forEach(qz => {
      qz.questions.forEach(q => {
        existingQuestions.add(q.question.trim().toLowerCase().replace(/\s+/g, ' '));
      });
    });

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue; // skip empty & comment lines

      const parts = line.split('|').map(p => p.trim());
      if (parts.length < 3) {
        return res.status(400).json({ 
          error: `السطر ${lineNum}: تنسيق غير صحيح. يجب أن يحتوي السطر على 3 حقول على الأقل مفصولة بـ '|'` 
        });
      }

      const typePart = parts[0].toLowerCase();
      const isTrueFalse = typePart.includes('صح') || typePart.includes('true') || typePart.includes('tf');
      const isMultiple = typePart.includes('اختيار') || typePart.includes('multiple') || typePart.includes('mc');

      if (!isTrueFalse && !isMultiple) {
        return res.status(400).json({ 
          error: `السطر ${lineNum}: نوع السؤال غير معروف "${parts[0]}". استخدم "صح/خطأ" أو "اختيار"` 
        });
      }

      const questionText = parts[1];
      if (!questionText) {
        return res.status(400).json({ error: `السطر ${lineNum}: نص السؤال فارغ` });
      }

      const normQuestion = questionText.toLowerCase().replace(/\s+/g, ' ');

      // 1. Check for duplicates in the current uploaded file
      if (seenInUpload.has(normQuestion)) {
        return res.status(400).json({ 
          error: `السطر ${lineNum}: تكرار للسؤال المذكور في السطر ${seenInUpload.get(normQuestion)} في نفس الملف!` 
        });
      }

      // 2. Check for duplicates in the entire DB (Anime Ziadah protection)
      if (existingQuestions.has(normQuestion)) {
        return res.status(400).json({ 
          error: `السطر ${lineNum}: هذا السؤال موجود بالفعل في قاعدة البيانات تحت اختبار آخر لحماية الفكرة ومنع التكرار!` 
        });
      }

      seenInUpload.set(normQuestion, lineNum);

      if (isTrueFalse) {
        // صح/خطأ | السؤال | الإجابة (صح/خطأ/true/false) | شرح
        const answerRaw = (parts[2] || '').toLowerCase();
        if (answerRaw !== 'صح' && answerRaw !== 'خطأ' && answerRaw !== 'true' && answerRaw !== 'false') {
          return res.status(400).json({ 
            error: `السطر ${lineNum}: إجابة الصح والخطأ غير صالحة "${parts[2]}". يجب أن تكون "صح" أو "خطأ"` 
          });
        }
        const answer = answerRaw === 'صح' || answerRaw === 'true';
        const explanation = parts[3] || '';

        questions.push({
          id: 'q-' + Date.now() + '-' + i,
          type: 'truefalse',
          question: questionText,
          answer,
          explanation
        });
      } else {
        // اختيار | السؤال | خيار1 | خيار2 | خيار3 | خيار4 | رقم الإجابة | شرح
        if (parts.length < 5) {
          return res.status(400).json({ 
            error: `السطر ${lineNum}: سؤال الاختيار من متعدد يحتاج إلى خيارين على الأقل ورقم إجابة صحيح` 
          });
        }

        let optionEnd = parts.length - 1;
        let explanation = '';
        let answerIdx = 0;

        // Check if the last part is a non-numeric explanation
        if (isNaN(parts[parts.length - 1]) && parts.length >= 5) {
          explanation = parts[parts.length - 1];
          optionEnd = parts.length - 2;
        }

        const answerPart = parts[optionEnd];
        if (isNaN(answerPart) || answerPart.trim() === '') {
          return res.status(400).json({ 
            error: `السطر ${lineNum}: رقم الإجابة الصحيحة يجب أن يكون رقماً صالحاً` 
          });
        }

        answerIdx = parseInt(answerPart, 10) - 1;
        optionEnd -= 1;

        const options = parts.slice(2, optionEnd + 1).filter(o => o.trim() !== '');
        if (options.length < 2) {
          return res.status(400).json({ 
            error: `السطر ${lineNum}: يجب توفير خيارين غير فارغين على الأقل` 
          });
        }

        if (answerIdx < 0 || answerIdx >= options.length) {
          return res.status(400).json({ 
            error: `السطر ${lineNum}: رقم الإجابة (${answerIdx + 1}) غير صالح. يجب أن يكون بين 1 و ${options.length}` 
          });
        }

        questions.push({
          id: 'q-' + Date.now() + '-' + i,
          type: 'multiple',
          question: questionText,
          options,
          answer: answerIdx,
          explanation
        });
      }
    }

    if (questions.length === 0) {
      return res.status(400).json({ error: 'لم يتم العثور على أسئلة صالحة للاستيراد' });
    }

    await db.createQuiz({
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
router.get('/quizzes/:id/edit', requireAuth, async (req, res) => {
  try {
    const quiz = await db.getQuiz(req.params.id);
    if (!quiz) return res.redirect('/admin/quizzes');
    res.render('admin/quiz-form', { title: 'تعديل الاختبار', quiz, mode: 'edit' });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/quizzes');
  }
});

// Clone quiz
router.post('/quizzes/:id/clone', requireAuth, async (req, res) => {
  try {
    const quiz = await db.getQuiz(req.params.id);
    if (!quiz) return res.redirect('/admin/quizzes');

    const clonedQuiz = {
      title: `${quiz.title} (نسخة)`,
      description: quiz.description,
      icon: quiz.icon,
      color: quiz.color,
      questions: JSON.parse(JSON.stringify(quiz.questions))
    };
    await db.createQuiz(clonedQuiz);
    res.redirect('/admin/quizzes');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/quizzes');
  }
});

// Delete quiz
router.post('/quizzes/:id/delete', requireAuth, async (req, res) => {
  try {
    await db.deleteQuiz(req.params.id);
    res.redirect('/admin/quizzes');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/quizzes');
  }
});

// Update quiz  (keep last among POST /quizzes/:id* to avoid shadowing)
router.post('/quizzes/:id', requireAuth, async (req, res) => {
  try {
    const { title, description, icon, color, questions } = req.body;
    const parsedQuestions = parseQuestions(questions);
    await db.updateQuiz(req.params.id, { title, description, icon: icon || '📝', color: color || '#00d4aa', questions: parsedQuestions });
    res.redirect('/admin/quizzes');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/quizzes');
  }
});

// ── API: get quiz JSON for editor ─────────────────────────
router.get('/api/quiz/:id', requireAuth, async (req, res) => {
  try {
    const quiz = await db.getQuiz(req.params.id);
    res.json(quiz || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
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

router.get('/reviews', requireAuth, async (req, res) => {
  try {
    res.render('admin/reviews', { title: 'إدارة المراجعات', reviews: await db.getReviews() });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/reviews/new', requireAuth, (req, res) => {
  res.render('admin/review-form', { title: 'إضافة مراجعة جديدة', review: null, mode: 'create' });
});

router.post('/reviews', requireAuth, async (req, res) => {
  try {
    const { title, subject, icon, color, description, sections } = req.body;
    const parsedSections = parseSections(sections);
    await db.createReview({ title, subject, icon: icon || '📚', color: color || '#00d4aa', description, sections: parsedSections });
    res.redirect('/admin/reviews');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/reviews/:id/edit', requireAuth, async (req, res) => {
  try {
    const review = await db.getReview(req.params.id);
    if (!review) return res.redirect('/admin/reviews');
    res.render('admin/review-form', { title: 'تعديل المراجعة', review, mode: 'edit' });
  } catch (err) {
    console.error(err);
    res.redirect('/admin/reviews');
  }
});

router.post('/reviews/:id', requireAuth, async (req, res) => {
  try {
    const { title, subject, icon, color, description, sections } = req.body;
    const parsedSections = parseSections(sections);
    await db.updateReview(req.params.id, { title, subject, icon: icon || '📚', color: color || '#00d4aa', description, sections: parsedSections });
    res.redirect('/admin/reviews');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/reviews');
  }
});

router.post('/reviews/:id/delete', requireAuth, async (req, res) => {
  try {
    await db.deleteReview(req.params.id);
    res.redirect('/admin/reviews');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/reviews');
  }
});

// ══════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════
router.get('/settings', requireAuth, async (req, res) => {
  try {
    res.render('admin/settings', { title: 'الإعدادات', success: null, error: null, settings: await db.getSettings() });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/settings/password', requireAuth, async (req, res) => {
  try {
    const { current, newPass, confirm } = req.body;
    if (!await db.verifyAdmin(req.session.username, current)) {
      return res.render('admin/settings', { title: 'الإعدادات', error: 'كلمة المرور الحالية غير صحيحة', success: null, settings: await db.getSettings() });
    }
    if (newPass !== confirm) {
      return res.render('admin/settings', { title: 'الإعدادات', error: 'كلمتا المرور غير متطابقتين', success: null, settings: await db.getSettings() });
    }
    if (newPass.length < 6) {
      return res.render('admin/settings', { title: 'الإعدادات', error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', success: null, settings: await db.getSettings() });
    }
    await db.updateAdminPassword(newPass);
    res.render('admin/settings', { title: 'الإعدادات', success: 'تم تغيير كلمة المرور بنجاح', error: null, settings: await db.getSettings() });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/settings/general', requireAuth, async (req, res) => {
  try {
    const allowCustomQuestionCount = req.body.allowCustomQuestionCount === 'true' || req.body.allowCustomQuestionCount === 'on';
    await db.updateSettings({ allowCustomQuestionCount });
    res.render('admin/settings', { title: 'الإعدادات', success: 'تم تحديث الإعدادات بنجاح', error: null, settings: await db.getSettings() });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════
function parseQuestions(raw) {
  if (!raw) return [];
  let questions = [];
  try {
    if (typeof raw === 'string') questions = JSON.parse(raw);
    else questions = raw;
  } catch { return []; }

  if (!Array.isArray(questions)) return [];

  return questions.map((q, idx) => {
    const sanitized = {
      id: q.id || 'q-' + Date.now() + '-' + idx,
      type: q.type === 'truefalse' ? 'truefalse' : 'multiple',
      question: typeof q.question === 'string' ? q.question.trim() : '',
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : ''
    };

    if (sanitized.type === 'truefalse') {
      sanitized.answer = q.answer === true || q.answer === 'true';
    } else {
      const rawOptions = Array.isArray(q.options) ? q.options : [];
      sanitized.options = rawOptions.map(opt => {
        if (Array.isArray(opt)) return opt.join(' و').trim();
        return typeof opt === 'string' ? opt.trim() : String(opt || '').trim();
      });
      const parsedAns = parseInt(q.answer, 10);
      sanitized.answer = (!isNaN(parsedAns) && parsedAns >= 0 && parsedAns < sanitized.options.length) ? parsedAns : 0;
    }
    return sanitized;
  });
}

function parseSections(raw) {
  if (!raw) return [];
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw;
  } catch { return []; }
}

module.exports = router;
