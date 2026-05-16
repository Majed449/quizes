const express = require('express');
const router = express.Router();
const db = require('../data/db');

router.get('/', (req, res) => {
  res.render('quizzes', { title: 'الاختبارات', quizzes: db.getQuizzes() });
});

router.get('/:id', (req, res) => {
  const quiz = db.getQuiz(req.params.id);
  if (!quiz) return res.redirect('/quiz');
  res.render('quiz', { title: quiz.title, quiz });
});

router.post('/:id/submit', (req, res) => {
  const quiz = db.getQuiz(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  const { answers } = req.body;
  let score = 0;
  const results = quiz.questions.map((q, index) => {
    const userAnswer = answers[index];
    let isCorrect = false;
    if (q.type === 'truefalse') isCorrect = (userAnswer === 'true') === q.answer;
    else if (q.type === 'multiple') isCorrect = parseInt(userAnswer) === q.answer;
    if (isCorrect) score++;
    return { ...q, userAnswer, correctAnswer: q.answer, isCorrect };
  });
  res.json({
    score, total: quiz.questions.length,
    percentage: Math.round((score / quiz.questions.length) * 100),
    results
  });
});

module.exports = router;
