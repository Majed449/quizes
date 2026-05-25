const express = require('express');
const router = express.Router();
const db = require('../data/db');
const { calculateSimilarity } = require('../utils/similarity');

// Common Arabic insults and rude phrases
const insults = [
  'غبي', 'حمار', 'كلب', 'يا غبي', 'يا حمار', 'غباء', 'زفت', 'غلس', 'فاشل', 'تفه', 'تفو', 'حيوان', 'يا حيوان', 'اهبل', 'أهبل', 'رخم', 'يا رخم', 'يا اهبل', 'غبى', 'فاشله', 'فاشلة', 'وسخ', 'يا وسخ'
];

// Egyptian Arabic Persona Responses Map
const personas = {
  default: {
    name: 'المساعد الافتراضي',
    greet: (name) => `أهلاً بك يا ${name || 'طالبنا العزيز'}! 👋 أنا مساعدك الدراسي الذكي 🤖. أنا هنا لمساعدتك في اختبار معلوماتك ومراجعة الدروس بذكاء وسرعة. 💡`,
    correct: '🎉 **إجابة صحيحة وممتازة!** 👏 الله ينور عليك يا بطل. كمل كدا!',
    incorrect: '❌ **إجابة خاطئة.** حاول مرة أخرى، أو اكتب **"عرض الحل"** لمعرفة الإجابة الصحيحة مع التفسير! 💡',
    revealed: (ans) => `💡 الإجابة الصحيحة هي: **${ans}**`,
    essaySuccess: (score, ans) => `🎉 **إجابة صحيحة وممتازة!** 👏 نسبة تطابق إجابتك هي **${score}%**!\n\n✍️ **الإجابة النموذجية:**\n${ans}`,
    essayLow: (score) => `❌ **إجابتك غير دقيقة تماماً.** (نسبة التقارب مع الإجابة النموذجية هي **${score}%**).\n\nحاول صياغة الإجابة بشكل أوضح، أو اكتب **"عرض الحل"** لكشف الإجابة النموذجية مباشرة! 💡`,
    insult: 'اهدى كدا يا عمنا وصلي على النبي.. أنا مجرد ذكاء اصطناعي غلبان هنا عشان أساعدك تذاكر، فخلينا حبايب كدا وماتشتمش! 😉🌸',
    foreign: 'أنا مابتكلمش غير عربي يا صاحبي! كلمني بالعربي كدا الله يكرمك عشان نفهم بعض. 😉',
    defaultReply: (msg) => `لقد استلمت رسالتك: "${msg}" 💬. أنا هنا لمساعدتك في المذاكرة عبر الأسئلة. اكتب **"سؤال عشوائي"** أو **"بطاقات تفاعلية"** للبدء! 🎲`
  },
  encouraging: {
    name: 'الصديق المشجع',
    greet: (name) => `يا هلا بيك يا ${name || 'بطل'}! 👋 صديقك الصدوق والوحش الدراسي وصل! 🤖🔥 أنا هنا عشان نشجع بعض ونقفل الامتحانات سوا.. يالا بينا نذاكر بجد وبكل حماس!`,
    correct: '🎉 **عاش يا وحش! إجابة صحيحة 100%!** 🚀 أنت عبقري النهاردة وماحدش قدك! كمل كدا يا بطل ووريهم شطارتك. 💪✨',
    incorrect: '❌ **ولا يهمك يا صاحبي!** المحاولة شرف.. جرب تاني وأكيد المرة الجاية هتقفلها، أو اكتب **"عرض الحل"** عشان تتعلم وتكبر! 😉💡',
    revealed: (ans) => `💡 ولا يهمك يا صاحبي، الإجابة النموذجية هي: **${ans}**.. اتعلمها عشان لما تيجي تاني تفرمها فرم!`,
    essaySuccess: (score, ans) => `🎉 **يا راسي! إجابة ممتازة جداً!** التطابق عالي جداً بنسبة **${score}%**! بجد فخور بيك وبذكائك.\n\n✍️ **الإجابة النموذجية للتعلم:**\n${ans}`,
    essayLow: (score) => `❌ **قربت جداً يا بطل!** (التقارب **${score}%**). فكر تاني وصيغها بأسلوبك الجميل ده، أو اكتب **"عرض الحل"** وبص عليه بصة سريعة! 😉`,
    insult: 'عيب كدا يا زميلي ما يصحش! خلينا نركز في المذاكرة أحسن عشان نشلحف المواد دي.. احنا إخوات وأصحاب برضه! 😉📚',
    foreign: 'يا عمنا اتكلم عربي يهديك ربنا! أنا لغتي عربية ومصرية مية مية عشان نفهم بعضينا. 😉',
    defaultReply: (msg) => `يا بطل أنا معاك وسامعك! 💬 رسالتك بتقول "${msg}". اكتب **"سؤال عشوائي"** أو **"بطاقات تفاعلية"** وخلينا نبهر الدنيا بشطارتنا! 🚀`
  },
  strict: {
    name: 'المعلم الصارم',
    greet: (name) => `مرحباً يا ${name || 'طالب'}. 👨‍🏫 أنا معلمك الصارم هنا. الدراسة والاجتهاد أساس النجاح، ومفيش مكان للكسل والتهريج. ركز معايا ووريني شطارتك!`,
    correct: '🎉 **إجابة صحيحة.** 👏 هذا هو المستوى المطلوب منك، ولكن استمر في التركيز ولا تتكاسل مطلقاً.',
    incorrect: '❌ **الإجابة خاطئة تماماً!** ركز ولا تتسرع في كتابة الحل. فكر مجدداً أو اكتب **"عرض الحل"** لتتعلم من خطئك فورا! 👨‍🏫',
    revealed: (ans) => `💡 الإجابة الصحيحة التي كان يجب أن تعرفها هي: **${ans}**.. سجلها عندك عشان ما تغلطش فيها تاني!`,
    essaySuccess: (score, ans) => `🎉 **إجابة مقبولة وصحيحة.** نسبة الدقة اللغوية هي **${score}%**.\n\n✍️ **الإجابة النموذجية للحفظ والاستذكار:**\n${ans}`,
    essayLow: (score) => `❌ **إجابة غير كافية وناقصة!** (نسبة الدقة **${score}%** فقط). أعد الصياغة بالمعاني العلمية الصحيحة، أو اكتب **"عرض الحل"** والتزم به! 👨‍🏫`,
    insult: 'الزم الأدب يا طالب! ⚠️ أنا هنا لتعليمك وتدريبك، الاحترام متبادل والجدية هي أساس حصتنا. خلينا نرجع للدرس فورا.',
    foreign: 'اكتب باللغة العربية! لا نستخدم لغات أخرى هنا للتعلم، ركز في دراستك.',
    defaultReply: (msg) => `يا طالب، ركز في دراستك! ⚠️ رسالتك "${msg}" خارج سياق المذاكرة. اكتب **"سؤال عشوائي"** أو **"بطاقات تفاعلية"** وابدأ العمل الآن!`
  }
};

// Generates a gradual hint based on active question and hint index (0, 1, 2)
function getGradualHint(activeQ, hintIndex, personaName) {
  let hintText = '';
  if (activeQ.type === 'truefalse') {
    const isTrue = activeQ.answer === true || activeQ.answer === 'true';
    if (hintIndex === 0) {
      hintText = `السؤال ده بيختبر مدى صحة مفهوم متعلق بـ: **[${activeQ.source.split(':')[1]?.trim() || 'هذا الموضوع'}]**. فكر في المفهوم العام للعبارة.`;
    } else if (hintIndex === 1) {
      hintText = `ركز جداً في صياغة العبارة، هل هناك أي كلمة تنفي المعنى أو تغير السياق العلمي الصحيح؟`;
    } else {
      hintText = isTrue 
        ? `العبارة تتطابق تماماً مع القواعد والمفاهيم العلمية الصحيحة دون أي تغيير أو تلاعب بالكلمات.`
        : `العبارة تحتوي على خطأ بسيط أو تبديل في المصطلحات يجعل المعنى العلمي غير صحيح.`;
    }
  } else if (activeQ.type === 'multiple') {
    if (!Array.isArray(activeQ.options) || activeQ.options.length === 0) {
      hintText = `هذا السؤال لا يحتوي على خيارات محددة، حاول التفكير في الإجابة مباشرة! 💡`;
    } else {
      const correctIndex = parseInt(activeQ.answer, 10);
      const wrongIndices = activeQ.options
        .map((_, idx) => idx)
        .filter(idx => idx !== correctIndex);
      
      if (hintIndex === 0) {
        const eliminated = wrongIndices[0];
        hintText = `هحذفلك خيار غلط عشان أسهلها عليك: الخيار رقم (${eliminated + 1}) '**${activeQ.options[eliminated]}**' ليس هو الإجابة الصحيحة! ❌`;
      } else if (hintIndex === 1) {
        const eliminated = wrongIndices[1] !== undefined ? wrongIndices[1] : wrongIndices[0];
        hintText = `هساعدك أكتر وأشيلك خيار غلط تاني: الخيار رقم (${eliminated + 1}) '**${activeQ.options[eliminated]}**' برضه مش صح! 😉`;
      } else {
        const correctText = (activeQ.options && !isNaN(correctIndex)) ? (activeQ.options[correctIndex] || activeQ.answer) : activeQ.answer;
        const firstWord = correctText ? correctText.split(' ')[0] : '';
        hintText = `تلميح قوي أخير: الإجابة الصحيحة تبدأ بكلمة: '**${firstWord}**'. فكر كدا واختار! 💡`;
      }
    }
  } else if (activeQ.type === 'essay') {
    const wordsCount = activeQ.answer.split(/\s+/).filter(Boolean).length;
    if (hintIndex === 0) {
      hintText = `الإجابة النموذجية تتكون تقريباً من **${wordsCount}** كلمات. حاول صياغة إجابة مختصرة ومركزة!`;
    } else if (hintIndex === 1) {
      const stopWords = ['في', 'من', 'على', 'إلى', 'عن', 'هذا', 'التي', 'الذي', 'أن', 'أو', 'مع', 'هذه', 'بين', 'عند', 'كان', 'تم', 'كل', 'بعد', 'قبل', 'لقد', 'قد', 'ثم', 'حتى', 'أنه', 'إن'];
      const words = activeQ.answer.split(/[\s،,._\-\(\)]+/).filter(w => w.length > 3 && !stopWords.includes(w));
      const uniqueWords = [...new Set(words)].slice(0, 3);
      const keywordHint = uniqueWords.length > 0 ? uniqueWords.join(' و ') : 'مفاهيم الدرس الأساسية';
      hintText = `تلميح 2: الإجابة النموذجية تحتوي على كلمات مفتاحية مثل: '**${keywordHint}**'. حاول استخدامها في صياغتك!`;
    } else {
      const first3Words = activeQ.answer.split(/\s+/).slice(0, 3).join(' ');
      hintText = `تلميح ذهبي أخير: الإجابة النموذجية تبدأ بعبارة: '**${first3Words}...**'. أكمل الباقي بأسلوبك! 💡`;
    }
  }
  
  if (personaName === 'encouraging') {
    return `💡 **تلميح صديقك المشجع (${hintIndex + 1}/3):** ${hintText}`;
  } else if (personaName === 'strict') {
    return `👨‍🏫 **إرشاد المعلم الصارم (${hintIndex + 1}/3):** ${hintText}`;
  } else {
    return `💡 **تلميح المساعد الذكي (${hintIndex + 1}/3):** ${hintText}`;
  }
}

// GET /chat - Render the main Chat Assistant view
router.get('/', (req, res) => {
  res.render('chat', { 
    title: 'المساعد الدراسي الذكي', 
    playerName: req.session.playerName || '' 
  });
});

// POST /chat/message - Chat API endpoint
router.post('/message', async (req, res) => {
  const userMsg = (req.body.message || '').trim();
  const filter = req.body.filter || 'all'; // 'all', 'multiple', 'truefalse', 'essay'
  const personality = req.body.personality || 'default'; // 'default', 'encouraging', 'strict'
  const activeQ = req.session.activeChatQuestion;

  // Sync playerName to session if provided by the client
  if (req.body.playerName) {
    req.session.playerName = req.body.playerName;
  }

  const activePersona = personas[personality] || personas.default;

  if (!userMsg) {
    return res.json({ reply: 'الرجاء كتابة رسالة صالحة.' });
  }

  const normalizedMsg = userMsg.toLowerCase().replace(/[.،؟?]/g, '').trim();

  // 1. Guardrail Check: Insults & Profanity
  const containsInsult = insults.some(insult => {
    const wordPattern = new RegExp(`(^|\\s)${insult}(\\s|$)`, 'i');
    return wordPattern.test(userMsg);
  });

  if (containsInsult) {
    return res.json({ reply: activePersona.insult, status: 'warning' });
  }

  // 2. Guardrail Check: Foreign Language (Latin characters only without Arabic)
  const hasLatin = /[a-zA-Z]/.test(userMsg);
  const hasArabic = /[\u0600-\u06FF]/.test(userMsg);
  if (hasLatin && !hasArabic) {
    return res.json({ reply: activePersona.foreign, status: 'warning' });
  }

  // Helper function to build a pool of available questions with filter
  const getQuestionPool = async (typeFilter = 'all') => {
    const pool = [];

    // Add quiz questions (true/false & multiple choice)
    const quizzes = await db.getQuizzes();
    quizzes.forEach(quiz => {
      quiz.questions.forEach(q => {
        if (q.type === 'truefalse' || q.type === 'multiple') {
          if (typeFilter === 'all' || 
              (typeFilter === 'multiple' && q.type === 'multiple') ||
              (typeFilter === 'truefalse' && q.type === 'truefalse')) {
            pool.push({
              id: q.id,
              type: q.type,
              question: q.question,
              answer: q.answer,
              options: q.options || null,
              explanation: q.explanation || '',
              source: `اختبار: ${quiz.title}`
            });
          }
        }
      });
    });

    // Add review essay questions
    const reviews = await db.getReviews();
    reviews.forEach(review => {
      review.sections.forEach(sec => {
        (sec.questions || []).forEach(q => {
          if (q.type === 'essay') {
            if (typeFilter === 'all' || typeFilter === 'essay') {
              pool.push({
                id: q.id,
                type: 'essay',
                question: q.question,
                answer: q.answer,
                explanation: '',
                source: `مراجعة: ${review.title} - ${sec.title}`
              });
            }
          }
        });
      });
    });

    return pool;
  };

  // ── COMMAND: Skip or Reveal Answer ────────────────────────────────
  if (activeQ && (normalizedMsg === 'عرض الحل' || normalizedMsg === 'الحل' || normalizedMsg === 'skip' || normalizedMsg === 'تخطي')) {
    let answerText = '';
    if (activeQ.type === 'truefalse') {
      const isTrue = activeQ.answer === true || activeQ.answer === 'true';
      answerText = isTrue ? 'صح (صحيح)' : 'خطأ (خاطئ)';
    } else if (activeQ.type === 'multiple') {
      const idx = parseInt(activeQ.answer, 10);
      answerText = (Array.isArray(activeQ.options) && !isNaN(idx)) ? (activeQ.options[idx] || activeQ.answer) : activeQ.answer;
    } else {
      answerText = activeQ.answer;
    }

    req.session.activeChatQuestion = null; // Clear question state

    let reply = activePersona.revealed(answerText);
    if (activeQ.explanation && activeQ.explanation.trim()) {
      reply += `\n\n**الشرح والتوضيح:** ${activeQ.explanation}`;
    }
    
    if (personality === 'encouraging') {
      reply += `\n\nاكتب **'سؤال عشوائي'** أو اضغط على الزر بالأسفل ويالا ندخل التحدي الجديد سوا! 🎲`;
    } else if (personality === 'strict') {
      reply += `\n\nاكتب **'سؤال عشوائي'** لتبدأ حلاً جديداً بتركيز كافٍ.`;
    } else {
      reply += `\n\nاكتب **'سؤال عشوائي'** أو اضغط على الزر بالأسفل للحصول على سؤال جديد! 🎲`;
    }

    return res.json({ reply, status: 'revealed' });
  }

  // ── COMMAND: Active Flashcards Mode (Interactive Flashcards) ───────
  if (normalizedMsg === 'بطاقات تفاعلية' || normalizedMsg === 'بطاقات' || normalizedMsg === 'فلاش كارد' || normalizedMsg === 'بطاقة تفاعلية') {
    const pool = await getQuestionPool(filter);
    if (pool.length === 0) {
      return res.json({ reply: 'عذراً، لا يوجد أسئلة متوفرة في قاعدة البيانات حالياً تماشي هذا الاختيار.' });
    }

    const randomQ = pool[Math.floor(Math.random() * pool.length)];

    let ansText = '';
    if (randomQ.type === 'truefalse') {
      const isTrue = randomQ.answer === true || randomQ.answer === 'true';
      ansText = isTrue ? 'صح (صحيح) ☑️' : 'خطأ (خاطئ) ❌';
    } else if (randomQ.type === 'multiple') {
      const idx = parseInt(randomQ.answer, 10);
      ansText = (Array.isArray(randomQ.options) && !isNaN(idx)) ? (randomQ.options[idx] || randomQ.answer) : randomQ.answer;
    } else {
      ansText = randomQ.answer;
    }

    let introMsg = '';
    if (personality === 'encouraging') {
      introMsg = `يالا يا بطل الأبطال! 💪 سحبتلك بطاقة مراجعة ممتازة من **[${randomQ.source}]**.. فكر كويس كدا بتركيز، واضغط على الكارت عشان يتقلب وتشوف الإجابة النموذجية! 😉🔥`;
    } else if (personality === 'strict') {
      introMsg = `إليك بطاقة تعليمية للمذاكرة والمراجعة من **[${randomQ.source}]**. فكر بعمق في ذهنك أولاً، ثم اقلب البطاقة لمقارنة جوابك بالجواب النموذجي. لا تتكاسل! 👨‍🏫`;
    } else {
      introMsg = `سحبتلك بطاقة تعليمية للمراجعة السريعة من **[${randomQ.source}]**! 🎴 فكر في الحل واضغط على البطاقة عشان تتقلب وتكشف الإجابة النموذجية والتعليق. 👇`;
    }

    return res.json({
      reply: introMsg,
      status: 'flashcard',
      flashcard: {
        id: randomQ.id,
        type: randomQ.type,
        question: randomQ.question,
        answer: ansText,
        explanation: randomQ.explanation || '',
        source: randomQ.source,
        options: randomQ.options || null
      }
    });
  }

  // ── COMMAND: Flashcard Feedback responses ─────────────────────────
  if (normalizedMsg.includes('عرفت إجابة البطاقة') || normalizedMsg.includes('عرفت الإجابة للبطاقة')) {
    let feedbackReply = '';
    if (personality === 'encouraging') {
      feedbackReply = 'الله يا وحش! كفو عليك يا بطل، عارف إنك قدها ومفيش معلومة تقف قدامك! 🔥🚀 اضغط على **"بطاقات تفاعلية"** تانية وخلينا نكمل السلسلة!';
    } else if (personality === 'strict') {
      feedbackReply = 'جيد جداً. طالما عرفتها، استمر ولا تتفاخر. أمامنا الكثير لمراجعته ودراسته. 👨‍🏫';
    } else {
      feedbackReply = 'ممتاز جداً! كدة نضمن إن المعلومة ثبتت في دماغك. يالا بينا نشوف بطاقة تانية أو سؤال جديد! 🚀';
    }
    return res.json({ reply: feedbackReply });
  }

  if (normalizedMsg.includes('أحتاج لمراجعة البطاقة') || normalizedMsg.includes('احتاج لمراجعة البطاقة')) {
    let feedbackReply = '';
    if (personality === 'encouraging') {
      feedbackReply = 'عادي جداً يا صاحبي، الغلط هو أول خطوة للصح! اقرأ التفسير بتمعن وجرب تاني، أنا معاك وفي ضهرك! 💪✨ اضغط **"بطاقات تفاعلية"** وخلينا نجرب واحدة تانية!';
    } else if (personality === 'strict') {
      feedbackReply = 'يجب عليك كتابة هذه المعلومة ومراجعتها فوراً! الإهمال يؤدي للفشل. احفظها جيداً لتتجنب تكرار الخطأ. 👨‍🏫';
    } else {
      feedbackReply = 'ولا يهمك، المذاكرة تكرار! اكتب المعلومة دي في كشكولك وركز عليها المرة الجاية. تحب ناخد بطاقة تانية؟ 📝';
    }
    return res.json({ reply: feedbackReply });
  }

  // ── SMART INTENTS: Mastery, Explanation, and Stats ───────────────
  
  // 0. Save Question to Spaced Repetition Intent
  const isSaveRequest = [
    'ضيف السؤال ده', 'احفظ السؤال ده', 'حطه في المراجعة', 'ضيفه للتكرار', 
    'أضف هذا السؤال', 'سيف ده', 'عايز اراجعه تاني', 'ضيفه للمراجعة',
    'احفظه', 'ضيف ده'
  ].some(kw => normalizedMsg.includes(kw));

  if (isSaveRequest) {
    const pName = req.session.playerName || req.body.playerName;
    if (!pName) {
      return res.json({ reply: 'عذراً، يجب عليك تسجيل اسم مستخدم في المنصة أولاً لإضافة الأسئلة إلى التكرار المتباعد! ⚠️' });
    }
    const activeQ = req.session.activeChatQuestion;
    if (activeQ) {
      await db.addSpacedCard(pName, activeQ.id, activeQ.type, activeQ);
      let replyText = '';
      if (personality === 'encouraging') {
        replyText = '🎉 **من عيوني يا بطل!** تم إضافة السؤال ده لصندوق المراجعة والتكرار المتباعد 📅 عشان يظهرلك تاني ونضمن إنك تذاكره وتثبته كويس! كمل كدا! 💪🔥';
      } else if (personality === 'strict') {
        replyText = '👨‍🏫 **تمت الإضافة.** قمنا بحفظ هذا السؤال في مراجعاتك المجدولة لمراجعته بجدية لاحقاً. لا تهمله.';
      } else {
        replyText = '🎉 **تمت الإضافة بنجاح!** تم حفظ هذا السؤال في صندوق المراجعة والتكرار المتباعد 📅. ستتمكن من مراجعته في المرات القادمة.';
      }
      return res.json({ reply: replyText });
    } else {
      let noActiveReply = '';
      if (personality === 'encouraging') {
        noActiveReply = 'يا بطل، عشان أضيفلك سؤال للمراجعة لازم تسحب **"سؤال عشوائي"** وتجاوب عليه الأول أو يكون السؤال لسه نشط قدامنا! 😉✨';
      } else if (personality === 'strict') {
        noActiveReply = 'لا يوجد سؤال نشط حالياً لإضافته لجدول المراجعة المتباعد.';
      } else {
        noActiveReply = 'عذراً، يجب أن يكون هناك سؤال نشط في الشات لتتمكن من إضافته إلى التكرار المتباعد! 📅';
      }
      return res.json({ reply: noActiveReply });
    }
  }

  // 1. Mastery/Graduation Intent
  const isMasteryRequest = [
    'أتقنت السؤال', 'أتقنت هذا السؤال', 'خلاص حفظته', 'حفظته خلاص', 
    'أتقنته', 'أتقنتها', 'شيله من المراجعة', 'شيل السؤال ده', 
    'مش عايز أشوف السؤال ده تاني', 'مش عايز الكارت ده', 'خلاص عرفته', 'عرفته خلاص'
  ].some(kw => normalizedMsg.includes(kw));

  if (isMasteryRequest) {
    const pName = req.session.playerName || req.body.playerName;
    const activeSpacedId = req.session.activeSpacedCardId;
    const activeQ = req.session.activeChatQuestion;

    if (activeSpacedId && pName) {
      await db.pool.query('UPDATE spaced_repetition SET mastered = TRUE WHERE id = $1', [activeSpacedId]);
      req.session.activeSpacedCardId = null;
      
      let replyText = '';
      if (personality === 'encouraging') {
        replyText = '🎉 **يا بطل الأبطال!** أحييك على إتقانك للسؤال ده! 🏆 تم إزالته من صندوق المراجعة نهائياً عشان ما يكررش عليك تاني أبداً ونركز في الباقي! كمل كدا وسيطر! 💪🔥';
      } else if (personality === 'strict') {
        replyText = '👨‍🏫 **تم تسجيل إتقانك للمعلومة.** لقد قمنا باستبعاد هذا السؤال من مراجعاتك المجدولة نهائياً لثقتنا في مستواك الحالي. استمر بالتركيز.';
      } else {
        replyText = '🎉 **رائع جداً!** تم وضع علامة "متقن 🏆" على هذا السؤال وإزالته من صندوق المراجعة المتباعد بشكل نهائي. لن يتكرر لك مرة أخرى!';
      }
      return res.json({ reply: replyText, status: 'graduated' });
    } else if (activeQ && pName) {
      await db.addSpacedCard(pName, activeQ.id, activeQ.type, activeQ);
      await db.pool.query('UPDATE spaced_repetition SET mastered = TRUE WHERE player_name = $1 AND question_id = $2', [pName, activeQ.id]);
      req.session.activeChatQuestion = null;
      
      let replyText = '';
      if (personality === 'encouraging') {
        replyText = '🎉 **عاش!** علمتلك على السؤال العشوائي ده إنه متقن ومحفوظ 🏆 عشان لو انضاف للمراجعة بعدين ما يظهرلكش ويضيع وقتك! بطل بجد! 🚀';
      } else if (personality === 'strict') {
        replyText = '👨‍🏫 **حسناً.** تم تصنيف السؤال النشط كسؤال متقن مسبقاً، ولن يظهر لك في جولات المراجعة المستقبلية.';
      } else {
        replyText = '🎉 **جميل جداً!** تم تسجيل السؤال النشط كـ "متقن 🏆" في حسابك، ولن يدخل ضمن كروت المراجعة المكررة لك أبداً.';
      }
      return res.json({ reply: replyText, status: 'graduated' });
    } else {
      let noActiveReply = '';
      if (personality === 'encouraging') {
        noActiveReply = 'يا بطل، عشان أعلم على سؤال إنه متقن، لازم تفتح **"مراجعة التكرار"** الأول وتكون البطاقة ظاهرة قدامك، أو يكون في **سؤال نشط** بتجاوبه! 😉✨';
      } else if (personality === 'strict') {
        noActiveReply = 'لا يوجد بطاقة مراجعة نشطة أو سؤال مفتوح حالياً لتعديل حالته. افتح المراجعة أولاً.';
      } else {
        noActiveReply = 'عذراً، يجب أن يكون هناك سؤال نشط في الشات أو كارت مراجعة مفتوح لتتمكن من تعليمه كـ "متقن" وإزالته من التكرار! 📅';
      }
      return res.json({ reply: noActiveReply });
    }
  }

  // 2. Explanation Retrieval Intent
  const isExplanationRequest = [
    'اشرح السؤال', 'وضح أكتر', 'مش فاهم', 'شرح', 'شرح الإجابة', 'اشرحلي', 'اشرح'
  ].some(kw => normalizedMsg.includes(kw));

  if (isExplanationRequest) {
    const activeQ = req.session.activeChatQuestion;
    const activeSpacedId = req.session.activeSpacedCardId;

    if (activeQ) {
      let replyText = `💡 **شرح وتوضيح السؤال النشط:**\n\n`;
      if (activeQ.explanation && activeQ.explanation.trim()) {
        replyText += activeQ.explanation;
      } else {
        let modelAns = '';
        if (activeQ.type === 'truefalse') {
          modelAns = (activeQ.answer === true || activeQ.answer === 'true') ? 'صح (عبارة صحيحة)' : 'خطأ (عبارة خاطئة)';
        } else if (activeQ.type === 'multiple') {
          const idx = parseInt(activeQ.answer, 10);
          modelAns = (Array.isArray(activeQ.options) && !isNaN(idx)) ? (activeQ.options[idx] || activeQ.answer) : activeQ.answer;
        } else {
          modelAns = activeQ.answer;
        }
        replyText += `الإجابة النموذجية هي: **${modelAns}**.\n\nتأكد من فهم الموضوع جيداً وإذا كان لديك استفسار آخر أنا هنا لمساعدتك!`;
      }
      return res.json({ reply: replyText });
    } else if (activeSpacedId) {
      const cardRes = await db.pool.query('SELECT * FROM spaced_repetition WHERE id = $1', [activeSpacedId]);
      if (cardRes.rows.length > 0) {
        const card = cardRes.rows[0];
        const qData = card.question_data;
        let replyText = `💡 **شرح وتوضيح سؤال المراجعة:**\n\n`;
        if (qData.explanation && qData.explanation.trim()) {
          replyText += qData.explanation;
        } else {
          let modelAns = '';
          if (card.question_type === 'truefalse') {
            modelAns = (qData.answer === true || qData.answer === 'true') ? 'صح' : 'خطأ';
          } else if (card.question_type === 'multiple') {
            const idx = parseInt(qData.answer, 10);
            modelAns = (Array.isArray(qData.options) && !isNaN(idx)) ? (qData.options[idx] || qData.answer) : qData.answer;
          } else {
            modelAns = qData.answer;
          }
          replyText += `الإجابة النموذجية المخزنة هي: **${modelAns}**.`;
        }
        return res.json({ reply: replyText });
      }
    }

    let noQReply = '';
    if (personality === 'encouraging') {
      noQReply = 'يا بطل، مفيش سؤال شغال دلوقتي عشان أشرحهولك! اسحب **"سؤال عشوائي"** الأول وخلينا نجربه سوا! 😉🚀';
    } else if (personality === 'strict') {
      noQReply = 'لا يوجد سؤال نشط حالياً لتقديم شرح له. يرجى طلب سؤال أولاً.';
    } else {
      noQReply = 'لا يوجد أي سؤال نشط حالياً لتقديم شرحه وتفاصيله. اكتب **"سؤال عشوائي"** لطلب سؤال جديد! 🎲';
    }
    return res.json({ reply: noQReply });
  }

  // 3. Spaced Repetition stats and rules query
  const isStatsRequest = [
    'كيف يعمل التكرار', 'التكرار المتباعد', 'صندوق المراجعة', 'إحصائيات', 'إحصائيات المراجعة',
    'احصائيات', 'كيف تكرر', 'نظام المراجعة'
  ].some(kw => normalizedMsg.includes(kw));

  if (isStatsRequest) {
    const pName = req.session.playerName || req.body.playerName;
    if (!pName) {
      return res.json({ reply: 'عذراً، يجب عليك تسجيل اسم مستخدم في المنصة أولاً لعرض إحصائيات التكرار المتباعد! ⚠️' });
    }

    const stats = await db.getSpacedStats(pName);
    let replyText = '';
    
    if (personality === 'encouraging') {
      replyText = `📅 **إحصائيات التكرار المتباعد الخاص بك يا بطل:**\n\n` +
        `📚 إجمالي الكروت في مجموعتك: **${stats.total_cards}** كارت\n` +
        `⌛ الكروت المستحقة للمراجعة اليوم: **${stats.due_cards}** كارت\n` +
        `🏆 الكروت التي أتقنتها تماماً: **${stats.mastered_cards}** كارت\n\n` +
        `💡 **كيف يعمل هذا النظام الذكي ويحميك من التكرار اللانهائي؟**\n` +
        `- أي سؤال بتجاوب عليه غلط أو تضغط "نسيت" بيتحرك للصندوق الأول وبيظهرلك بعد 24 ساعة.\n` +
        `- أول ما تتحسن وتجاوبه صح **3 مرات ورا بعض**، أو تضغط على **"سهل"** أو **"أتقنته تماماً"**، الكارت بيتحول لـ **"متقن 🏆"** وبيطلع برة المراجعة للأبد!\n` +
        `- كدة نضمن إنك تذاكر بس اللي محتاجه، ومفيش أي تكرار ممل للأسئلة اللي بقيت شاطر فيها! 😉🚀`;
    } else if (personality === 'strict') {
      replyText = `👨‍🏫 **تقرير إحصائيات نظام التكرار المتباعد (SM2):**\n\n` +
        `- إجمالي البطاقات المسجلة: **${stats.total_cards}**\n` +
        `- البطاقات المطلوبة للمراجعة اليوم: **${stats.due_cards}**\n` +
        `- البطاقات المتقنة التي تم استبعادها: **${stats.mastered_cards}**\n\n` +
        `💡 **قواعد التكرار والاستبعاد:**\n` +
        `1. البطاقات الخاطئة يتم إعادة جدولتها للمراجعة بعد يوم واحد.\n` +
        `2. بمجرد الإجابة الصحيحة المتتالية لـ 3 مرات، أو تقييمها كـ 'سهل' أو 'متقن'، يتم استبعادها نهائياً كحالة 'متقنة' ولن تتكرر أبداً لتوفير وقتك وزيادة الإنتاجية.`;
    } else {
      replyText = `📅 **إحصائيات التكرار المتباعد لمجموعتك:**\n\n` +
        `🎴 إجمالي بطاقات المراجعة: **${stats.total_cards}**\n` +
        `📅 البطاقات المستحقة اليوم: **${stats.due_cards}**\n` +
        `🏆 البطاقات المتقنة تماماً: **${stats.mastered_cards}**\n\n` +
        `💡 **طريقة تنظيم التكرار ومنع التكرار اللانهائي:**\n` +
        `- البطاقات الخاطئة تراجع بعد 24 ساعة لتنشيط الذاكرة.\n` +
        `- بمجرد تحسن مستواك وإجابة البطاقة بشكل صحيح 3 مرات متتالية، أو تقييمها كـ **سهل** أو **أتقنته تماماً**، يتم ترقيتها إلى **متقنة** وتخرج من صندوق المراجعات ولا تتكرر نهائياً!`;
    }
    return res.json({ reply: replyText });
  }

  // ── COMMAND: Fifty-Fifty Helper (MCQ Option Elimination) ──────────
  const isFiftyFiftyRequest = [
    'محتار', 'احذف خيارين', '50-50', '٥٠'
  ].some(kw => normalizedMsg.includes(kw));

  if (isFiftyFiftyRequest) {
    if (!activeQ) {
      let noQReply = '';
      if (personality === 'encouraging') {
        noQReply = 'يا بطل الأبطال، اطلب سؤال عشوائي الأول عشان أقدر أحذفلك خيارين! 🎲✨';
      } else if (personality === 'strict') {
        noQReply = 'لا يوجد سؤال نشط حالياً لاستبعاد خيارات. اطلب سؤالاً عشوائياً أولاً. 👨‍🏫';
      } else {
        noQReply = 'لا يوجد سؤال نشط حالياً. الرجاء كتابة **"سؤال عشوائي"** أولاً! 🎲';
      }
      return res.json({ reply: noQReply });
    }
    if (activeQ.type !== 'multiple') {
      let notMcqReply = '';
      if (personality === 'encouraging') {
        notMcqReply = 'يا بطل، خاصية الـ 50-50 بتشتغل مع الأسئلة الاختيارية بس! ده سؤال مقالي أو صح وغلط. 😉';
      } else if (personality === 'strict') {
        notMcqReply = 'ميزة حذف الخيارات متاحة فقط للأسئلة متعددة الاختيارات. 👨‍🏫';
      } else {
        notMcqReply = 'هذه الميزة متاحة فقط للأسئلة متعددة الاختيارات! ⚠️';
      }
      return res.json({ reply: notMcqReply });
    }

    const hintMessage = getGradualHint(activeQ, 1, personality);
    req.session.activeHintIndex = 2; // Advance hint index to final hint
    return res.json({ reply: hintMessage, status: 'hint' });
  }

  // ── COMMAND: Request a Hint (Gradual Hints) ──────────────────────
  const isHintRequest = [
    'تلميح', 'مساعدة', 'ساعدني', 'تلميخ', 'غششني', 'مش عارف', 'مش عارف الحل', 
    'صعب', 'صعبة', 'سهلها', 'hint', 'help'
  ].some(kw => normalizedMsg.includes(kw));

  if (isHintRequest) {
    if (!activeQ) {
      let noQReply = '';
      if (personality === 'encouraging') {
        noQReply = 'يا بطل الأبطال، اطلب سؤال عشوائي الأول عشان أقدر أديك تلميح ليه! 🎲✨';
      } else if (personality === 'strict') {
        noQReply = 'لا يوجد سؤال نشط حالياً لتقديم تلميح. اطلب سؤالاً عشوائياً أولاً وابدأ بالتركيز. 👨‍🏫';
      } else {
        noQReply = 'لا يوجد سؤال نشط حالياً. الرجاء كتابة **"سؤال عشوائي"** أولاً لكي أقدم لك تلميحاً عنه! 🎲';
      }
      return res.json({ reply: noQReply });
    }

    const hintIndex = req.session.activeHintIndex || 0;
    if (hintIndex >= 3) {
      let exhaustedReply = '';
      if (personality === 'encouraging') {
        exhaustedReply = 'يا صاحبي، أنت كدة خلصت الـ 3 تلميحات بتوع السؤال ده! 😉 اضغط على **"عرض الحل"** لو محتاج الإجابة النهائية عشان نتعلم سوا!';
      } else if (personality === 'strict') {
        exhaustedReply = 'لقد استنفدت جميع التوجيهات والتلميحات الـ 3 المسموحة لهذا السؤال. يجب عليك إما الإجابة أو كتابة **"عرض الحل"** للتعلم.';
      } else {
        exhaustedReply = 'لقد استهلكت جميع التلميحات المتاحة لهذا السؤال (3 من 3). اكتب **"عرض الحل"** لمعرفة الإجابة الصحيحة! 💡';
      }
      return res.json({ reply: exhaustedReply });
    }

    const hintMessage = getGradualHint(activeQ, hintIndex, personality);
    req.session.activeHintIndex = hintIndex + 1;
    return res.json({ reply: hintMessage, status: 'hint' });
  }

  // ── COMMAND: Spaced Repetition Review Deck ──────────────────────
  const isReviewRequest = [
    'مراجعة التكرار', 'مراجعه التكرار', 'تكرار متباعد', 'تكرار', 'كروت المراجعة',
    'البطاقات المستحقة', 'المراجعة اليومية', 'الكرات', 'البطاقات'
  ].some(kw => normalizedMsg.includes(kw)) && !normalizedMsg.includes('تفاعلية') && !normalizedMsg.includes('البطاقة');

  if (isReviewRequest) {
    const pName = req.session.playerName || req.body.playerName;
    if (!pName) {
      return res.json({ reply: 'عذراً، يجب عليك إدخال اسم مستخدم في المنصة لبدء استخدام نظام التكرار المتباعد! ⚠️' });
    }

    const nextCard = await db.getDueSpacedCard(pName);
    const stats = await db.getSpacedStats(pName);

    if (!nextCard) {
      let finishedReply = '';
      if (personality === 'encouraging') {
        finishedReply = `يا وحش الأبطال! 🎉 أنت كدة قفلت المراجعة وخلصت كل بطاقات التكرار المتباعد المستحقة للنهاردة. فخور بيك جداً! 💪✨\n\n*(إجمالي البطاقات في حافظتك: **${stats.total_cards}** بطاقة، والبطاقات المتقنة تماماً: **${stats.mastered_cards}**)*`;
      } else if (personality === 'strict') {
        finishedReply = `جيد جداً. لا توجد أي بطاقات مستحقة للمراجعة اليوم. لقد أتممت مهام الاستذكار المجدولة بنجاح. 👨‍🏫\n\n*(إجمالي بطاقاتك: **${stats.total_cards}**، والبطاقات المتقنة: **${stats.mastered_cards}**)*`;
      } else {
        finishedReply = `رائع! لقد أتممت مراجعة جميع بطاقات التكرار المتباعد المستحقة لهذا اليوم. 🎉 لا يوجد المزيد حالياً.\n\n*(إجمالي البطاقات في مجموعتك: **${stats.total_cards}**، والبطاقات التي أتقنتها تماماً: **${stats.mastered_cards}**)*`;
      }
      return res.json({ reply: finishedReply });
    }

    let introMsg = '';
    if (personality === 'encouraging') {
      introMsg = `يالا يا بطل! سحبتلك أول بطاقة مراجعة مستحقة من صندوق التكرار المتباعد الخاص بك من **[${nextCard.question_data.source || 'المراجعة'}]**. فكر فيها واقلب البطاقة عشان تقيم نفسك! 😉🔥`;
    } else if (personality === 'strict') {
      introMsg = `إليك أول بطاقة مستحقة للمراجعة اليومية من **[${nextCard.question_data.source || 'المراجعة'}]**. اقرأ واجب بتركيز ثم قيم مستوى حفظك للمعلومة بدقة. 👨‍🏫`;
    } else {
      introMsg = `إليك أول بطاقة مراجعة مستحقة اليوم في نظام التكرار المتباعد من **[${nextCard.question_data.source || 'المراجعة'}]**! 🎴 اقلب البطاقة وقم بتقييم درجة تذكرك للإجابة:`;
    }

    let ansText = '';
    const qData = nextCard.question_data;
    if (nextCard.question_type === 'truefalse') {
      const isTrue = qData.answer === true || qData.answer === 'true';
      ansText = isTrue ? 'صح (صحيح) ☑️' : 'خطأ (خاطئ) ❌';
    } else if (nextCard.question_type === 'multiple') {
      const idx = parseInt(qData.answer, 10);
      ansText = (Array.isArray(qData.options) && !isNaN(idx)) ? (qData.options[idx] || qData.answer) : qData.answer;
    } else {
      ansText = qData.answer;
    }

    req.session.activeSpacedCardId = nextCard.id;

    return res.json({
      reply: introMsg,
      status: 'spaced_flashcard',
      flashcard: {
        id: nextCard.id,
        question: qData.question,
        answer: ansText,
        explanation: qData.explanation || '',
        source: qData.source || 'تكرار متباعد',
        options: qData.options || null
      }
    });
  }

  // ── COMMAND: Request a Random Question ───────────────────────────
  if (normalizedMsg === 'سؤال عشوائي' || normalizedMsg === 'اعطني سؤال' || normalizedMsg.includes('سؤال عشوائي') || normalizedMsg === '🎲 سؤال عشوائي') {
    const pool = await getQuestionPool(filter);
    if (pool.length === 0) {
      return res.json({ reply: 'عذراً، لا يوجد أسئلة متوفرة حالياً للتصفية المحددة في قاعدة البيانات.' });
    }

    const randomQ = pool[Math.floor(Math.random() * pool.length)];

    // Save active question to session
    req.session.activeChatQuestion = {
      id: randomQ.id,
      type: randomQ.type,
      question: randomQ.question,
      answer: randomQ.answer,
      options: randomQ.options,
      explanation: randomQ.explanation,
      source: randomQ.source
    };
    req.session.activeHintIndex = 0; // Reset hint index for the new question

    let questionReply = `🎯 **سؤال من [${randomQ.source}]:**\n\n${randomQ.question}`;
    if (randomQ.type === 'multiple') {
      questionReply += `\n\n**الخيارات المتاحة:**\n` + randomQ.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
    } else if (randomQ.type === 'truefalse') {
      questionReply += `\n\n*(أجب بـ **صح** أو **خطأ**)*`;
    } else {
      questionReply += `\n\n*(اكتب إجابتك الشفوية/المقالية بالتفصيل)*`;
    }

    return res.json({ 
      reply: questionReply, 
      status: 'question',
      questionType: randomQ.type,
      options: randomQ.options
    });
  }

  // ── ACTIVE QUESTION EVALUATION ──────────────────────────────────
  if (activeQ) {
    if (activeQ.type === 'truefalse') {
      const isTrueInput = [
        'صح', 'صحيح', 'صواب', 'صائب', 'مظبوط', 'مضبوط', 'تمام', 'نعم', 
        'ايوه', 'ايوة', 'أيوة', 'أيوه', 'true', 'yes', 'صحصح', 'صحيحه', 'صحيحة',
        'الاجابة صح', 'الاجابة صحيحة', 'الإجابة صحيحة', 'اجابة صحيحة', 'إجابة صحيحة'
      ].includes(normalizedMsg);
      
      const isFalseInput = [
        'خطا', 'خطأ', 'خاطئ', 'خاطئة', 'خاطئه', 'خاطه', 'غلط', 'مغلوط', 'مش صح', 
        'لا', 'false', 'no', 'غلطة', 'غلطه',
        'الاجابة خطا', 'الإجابة خطأ', 'الاجابة غلط', 'الإجابة غلط', 'اجابة خاطئة', 'إجابة خاطئة'
      ].includes(normalizedMsg);

      if (!isTrueInput && !isFalseInput) {
        return res.json({ reply: 'الرجاء الإجابة بـ **صح** أو **خطأ** ⚠️ (أو اكتب "الحل" لمعرفة الإجابة الصحيحة).' });
      }

      const userAnsValue = isTrueInput; // true if صح, false if خطأ
      const correctAnsValue = activeQ.answer === true || activeQ.answer === 'true';

      if (userAnsValue === correctAnsValue) {
        req.session.activeChatQuestion = null; // Clear state
        req.session.incorrectAttempts = 0; // Reset incorrect attempts

        // Sync correct answer mastery
        const pName = req.session.playerName || req.body.playerName;
        if (pName) {
          db.masterSpacedCard(pName, activeQ.id).catch(err => console.error('Error mastering spaced card in chat:', err));
        }

        let reply = activePersona.correct;
        if (activeQ.explanation && activeQ.explanation.trim()) {
          reply += `\n\n**الشرح:** ${activeQ.explanation}`;
        }
        reply += `\n\nاضغط على **"سؤال عشوائي 🎲"** للحصول على التحدي القادم!`;
        return res.json({ reply, status: 'correct' });
      } else {
        req.session.incorrectAttempts = (req.session.incorrectAttempts || 0) + 1;
        let reply = activePersona.incorrect;

        if (req.session.incorrectAttempts >= 2) {
          const pName = req.session.playerName || req.body.playerName;
          if (pName) {
            await db.addSpacedCard(pName, activeQ.id, activeQ.type, activeQ).catch(err => console.error(err));
            reply += `\n\n*(لقد أضفت هذا السؤال تلقائياً إلى صندوق المراجعة المتباعد لتتمكن من استذكاره لاحقاً. لا تقلق، بمجرد أن تجيب عليه بشكل صحيح، لن يتكرر لك مجدداً!)*`;
          }

          const hintIndex = req.session.activeHintIndex || 0;
          if (hintIndex < 3) {
            const hintMessage = getGradualHint(activeQ, hintIndex, personality);
            req.session.activeHintIndex = hintIndex + 1;
            req.session.incorrectAttempts = 0; // Reset counter
            reply += `\n\n${hintMessage}`;
          } else {
            req.session.incorrectAttempts = 0; // Reset counter anyway
          }
        }
        return res.json({ reply, status: 'incorrect' });
      }
    }

    if (activeQ.type === 'multiple') {
      const numMatch = userMsg.match(/^\d+$/);
      let isCorrect = false;
      const correctIndex = parseInt(activeQ.answer, 10);
      const correctOptionText = (Array.isArray(activeQ.options) && !isNaN(correctIndex)) ? (activeQ.options[correctIndex] || activeQ.answer) : activeQ.answer;

      if (numMatch) {
        const optionNum = parseInt(userMsg, 10);
        const maxOpt = Array.isArray(activeQ.options) ? activeQ.options.length : 1;
        if (optionNum >= 1 && optionNum <= maxOpt) {
          isCorrect = (optionNum - 1) === correctIndex;
        } else {
          return res.json({ reply: `الرجاء كتابة رقم بين 1 و ${maxOpt} أو كتابة نص الخيار بالكامل.` });
        }
      } else {
        const similarity = calculateSimilarity(userMsg, correctOptionText);
        const isExactMatch = userMsg.trim().toLowerCase() === correctOptionText.trim().toLowerCase();
        isCorrect = isExactMatch || (similarity >= 0.85);
      }

      if (isCorrect) {
        req.session.activeChatQuestion = null; // Clear state
        req.session.incorrectAttempts = 0; // Reset incorrect attempts

        // Sync correct answer mastery
        const pName = req.session.playerName || req.body.playerName;
        if (pName) {
          db.masterSpacedCard(pName, activeQ.id).catch(err => console.error('Error mastering spaced card in chat:', err));
        }

        let reply = activePersona.correct.replace('!', '') + ` الجواب هو: **${correctOptionText}** 👏`;
        if (activeQ.explanation && activeQ.explanation.trim()) {
          reply += `\n\n**الشرح والتوضيح:** ${activeQ.explanation}`;
        }
        reply += `\n\nاكتب **"سؤال عشوائي"** للمتابعة!`;
        return res.json({ reply, status: 'correct' });
      } else {
        req.session.incorrectAttempts = (req.session.incorrectAttempts || 0) + 1;
        let reply = activePersona.incorrect;

        if (req.session.incorrectAttempts >= 2) {
          const pName = req.session.playerName || req.body.playerName;
          if (pName) {
            await db.addSpacedCard(pName, activeQ.id, activeQ.type, activeQ).catch(err => console.error(err));
            reply += `\n\n*(لقد أضفت هذا السؤال تلقائياً إلى صندوق المراجعة المتباعد لتتمكن من استذكاره لاحقاً. لا تقلق، بمجرد أن تجيب عليه بشكل صحيح، لن يتكرر لك مجدداً!)*`;
          }

          const hintIndex = req.session.activeHintIndex || 0;
          if (hintIndex < 3) {
            const hintMessage = getGradualHint(activeQ, hintIndex, personality);
            req.session.activeHintIndex = hintIndex + 1;
            req.session.incorrectAttempts = 0; // Reset counter
            reply += `\n\n${hintMessage}`;
          } else {
            req.session.incorrectAttempts = 0; // Reset counter anyway
          }
        }
        return res.json({ reply, status: 'incorrect' });
      }
    }

    if (activeQ.type === 'essay') {
      const similarity = calculateSimilarity(userMsg, activeQ.answer);
      const threshold = 0.75; // 75% similarity threshold

      if (similarity >= threshold) {
        req.session.activeChatQuestion = null; // Clear state
        req.session.incorrectAttempts = 0; // Reset incorrect attempts

        // Sync correct answer mastery
        const pName = req.session.playerName || req.body.playerName;
        if (pName) {
          db.masterSpacedCard(pName, activeQ.id).catch(err => console.error('Error mastering spaced card in chat:', err));
        }

        const pct = Math.round(similarity * 100);
        let reply = activePersona.essaySuccess(pct, activeQ.answer);
        reply += `\n\nاضغط على الزر بالأسفل للحصول على سؤال عشوائي جديد!`;
        return res.json({ reply, status: 'correct' });
      } else if (similarity >= 0.50) {
        // Near-miss check (between 50% and 74%)
        let reply = `إجابتك قريبة جداً! صياغتك ممتازة ولكن ينقصها بعض التفاصيل. حاول كتابة 'تلميح' لمعرفة الكلمات المفتاحية.`;
        return res.json({ reply, status: 'near-miss' });
      } else {
        // Completely incorrect (< 50%)
        req.session.incorrectAttempts = (req.session.incorrectAttempts || 0) + 1;
        const pct = Math.round(similarity * 100);
        let reply = activePersona.essayLow(pct);

        if (req.session.incorrectAttempts >= 2) {
          const pName = req.session.playerName || req.body.playerName;
          if (pName) {
            await db.addSpacedCard(pName, activeQ.id, activeQ.type, activeQ).catch(err => console.error(err));
            reply += `\n\n*(لقد أضفت هذا السؤال تلقائياً إلى صندوق المراجعة المتباعد لتتمكن من استذكاره لاحقاً. لا تقلق، بمجرد أن تجيب عليه بشكل صحيح، لن يتكرر لك مجدداً!)*`;
          }

          const hintIndex = req.session.activeHintIndex || 0;
          if (hintIndex < 3) {
            const hintMessage = getGradualHint(activeQ, hintIndex, personality);
            req.session.activeHintIndex = hintIndex + 1;
            req.session.incorrectAttempts = 0; // Reset counter
            reply += `\n\n${hintMessage}`;
          } else {
            req.session.incorrectAttempts = 0; // Reset counter anyway
          }
        }
        return res.json({ reply, status: 'incorrect' });
      }
    }
  }

  // ── DEFAULT CONVERSATIONAL LOGIC ─────────────────────────────────
  const cleanMsg = userMsg.trim();
  let reply = '';
  
  if (normalizedMsg.includes('مرحبا') || normalizedMsg.includes('هلا') || normalizedMsg.includes('السلام') || normalizedMsg.includes('hello')) {
    reply = activePersona.greet(req.session.playerName);
  } else if (normalizedMsg.includes('شكرا') || normalizedMsg.includes('جزاك')) {
    if (personality === 'encouraging') {
      reply = 'على راسي يا غالي! 🌸 مفيش شكر بين الصحاب، أنا دايماً معاك وبشجعك! يالا بينا نكمل فرم المنهج؟ 🚀';
    } else if (personality === 'strict') {
      reply = 'العفو يا طالب. الشكر الحقيقي يكون بالاجتهاد والحصول على الدرجات النهائية. واصل عملك. 👨‍🏫';
    } else {
      reply = 'على الرحب والسعة! 🌸 بالتوفيق في دراستك دائماً. إذا أردت تحدياً جديداً، أنا في الانتظار! 🎲';
    }
  } else if (normalizedMsg.includes('من انت') || normalizedMsg.includes('ماذا تفعل') || normalizedMsg.includes('مين انت')) {
    if (personality === 'encouraging') {
      reply = 'أنا صديقك الدراسي وبطل المذاكرة الذكي! 🤖🔥 تم برمجتي لمساعدتك في اختبار نفسك وقياس نسبة تطابق إجابتك، عشان تفرم امتحاناتك كلها بنجاح وسهولة!';
    } else if (personality === 'strict') {
      reply = 'أنا معلمك المساعد لمادة المراجعة 👨‍🏫. مهمتي هي اختبار معلوماتك وتحديد أوجه القصور لديك باستخدام خوارزميات قياس التشابه النصي، لتصحيح إجاباتك فورياً وبكل دقة.';
    } else {
      reply = `أنا المساعد الدراسي للمنصة 🤖، تم برمجتي لمساعدتك في اختبار نفسك. أقوم بسحب أسئلة عشوائية من قاعدة البيانات، وعندما تجيب، أقوم بتحليل مدى دقة إجابتك مقارنة بالحل النموذجي باستخدام خوارزميات قياس التشابه اللغوي.`;
    }
  } else {
    reply = activePersona.defaultReply(cleanMsg);
  }

  return res.json({ reply });
});

// ── SPACED REPETITION POST ENDPOINTS ────────────────────────────────
router.post('/spaced/add', async (req, res) => {
  const playerName = req.session.playerName || req.body.playerName;
  const { questionId, questionType, questionData } = req.body;
  
  if (!playerName) {
    return res.status(400).json({ error: 'الرجاء إدخال اسم مستخدم أولاً.' });
  }
  if (!questionId || !questionType || !questionData) {
    return res.status(400).json({ error: 'بيانات السؤال غير مكتملة.' });
  }

  try {
    await db.addSpacedCard(playerName, questionId, questionType, questionData);
    return res.json({ success: true, message: 'تمت إضافة السؤال بنجاح إلى التكرار المتباعد للمراجعة! 📅' });
  } catch (err) {
    console.error('Error adding spaced card:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/spaced/grade', async (req, res) => {
  const { id, grade, playerName } = req.body;
  
  if (!id || !grade || !playerName) {
    return res.status(400).json({ error: 'بيانات التقييم غير مكتملة.' });
  }

  try {
    const cardRes = await db.pool.query('SELECT * FROM spaced_repetition WHERE id = $1', [id]);
    if (cardRes.rows.length === 0) {
      return res.status(404).json({ error: 'البطاقة غير موجودة.' });
    }
    const card = cardRes.rows[0];

    const q = parseInt(grade, 10);
    let { box, interval, ease_factor, repetitions } = card;
    let mastered = false;

    if (q < 3) {
      // Forgot / Incorrect
      repetitions = 0;
      interval = 1;
      box = 1;
    } else {
      // Correct
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ease_factor);
      }
      repetitions += 1;
      box += 1;
      
      // Graduation condition (Mastery)
      // Mastered if correctly reviewed 3 consecutive times, or if they demonstrate improvement with a rating of Good (4), Easy (5), or Mastered (6).
      // This prevents cards from repeating endlessly once the user improves.
      if (repetitions >= 3 || q >= 4) {
        mastered = true;
      }
    }

    // Ease Factor Adjustment
    ease_factor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (ease_factor < 1.3) ease_factor = 1.3;

    // Calculate next review date
    const next_review = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);

    // Save to DB
    await db.updateSpacedCard(card.id, box, interval, ease_factor, repetitions, next_review, mastered);

    // Fetch updated stats and next card
    const stats = await db.getSpacedStats(playerName);
    const nextCard = await db.getDueSpacedCard(playerName);

    // Update activeSpacedCardId in session
    if (nextCard) {
      req.session.activeSpacedCardId = nextCard.id;
    } else {
      req.session.activeSpacedCardId = null;
    }

    let reply = '';
    if (mastered) {
      reply = `🎉 **إنجاز رائع! لقد أتقنت هذا السؤال تماماً!** 🏆\nتم إخراجه من صندوق المراجعة اليومية بشكل نهائي ولن يتكرر لك مرة أخرى أبداً! الله ينور عليك يا بطل. 🚀`;
    } else if (q < 3) {
      reply = `تمت إعادة جدولة الكارت. المذاكرة تكرار يا بطل! 🔄 سنراجعه مجدداً قريباً لتثبت المعلومة في دماغك.`;
    } else {
      reply = `تم تسجيل التقييم بنجاح. المستوى الحالي: صندوق (${box}). التكرار القادم بعد **${interval}** يوم/أيام. 👍`;
    }

    return res.json({ 
      success: true, 
      reply, 
      stats,
      nextCard: nextCard ? {
        id: nextCard.id,
        question_id: nextCard.question_id,
        question_type: nextCard.question_type,
        question_data: nextCard.question_data
      } : null
    });

  } catch (err) {
    console.error('Error grading spaced card:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /chat/sync - Sync playerName with session
router.post('/sync', (req, res) => {
  if (req.body.playerName) {
    req.session.playerName = req.body.playerName;
    return res.json({ success: true, playerName: req.session.playerName });
  }
  return res.json({ success: false });
});

module.exports = router;
