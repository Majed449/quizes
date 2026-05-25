const express = require('express');
const router = express.Router();
const db = require('../data/db');

router.get('/', async (req, res) => {
  try {
    const quizzes = await db.getQuizzes();
    res.render('quizzes', { title: 'الاختبارات', quizzes });
  } catch (err) {
    console.error('Error fetching quizzes:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const quiz = await db.getQuiz(req.params.id);
    if (!quiz) return res.redirect('/quiz');
    const settings = await db.getSettings();
    res.render('quiz', { title: quiz.title, quiz, settings });
  } catch (err) {
    console.error('Error fetching quiz:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const quiz = await db.getQuiz(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const { answers, playerName, questions: submittedQuestions } = req.body;

    // Use the questions the user actually answered (subset), falling back to all questions
    const activeQuestions = (Array.isArray(submittedQuestions) && submittedQuestions.length > 0)
      ? submittedQuestions
      : quiz.questions;

    let score = 0;
    const results = activeQuestions.map((q, index) => {
      const userAnswer = answers[index];
      let isCorrect = false;
      if (q.type === 'truefalse') {
        isCorrect = (userAnswer === 'true' || userAnswer === 'false') && (userAnswer === 'true') === q.answer;
      } else if (q.type === 'multiple') {
        isCorrect = (userAnswer !== undefined && userAnswer !== null && userAnswer !== '') && parseInt(userAnswer) === q.answer;
      }
      if (isCorrect) score++;
      return { ...q, userAnswer, correctAnswer: q.answer, isCorrect };
    });

    if (playerName) {
      try {
        for (const r of results) {
          if (r.isCorrect) {
            await db.masterSpacedCard(playerName, r.id);
          } else {
            await db.addSpacedCard(playerName, r.id, r.type, {
              id: r.id,
              type: r.type,
              question: r.question,
              answer: r.answer,
              options: r.options,
              explanation: r.explanation
            });
          }
        }
      } catch (dbErr) {
        console.error('Error syncing quiz submission to spaced repetition:', dbErr);
      }
    }

    const total = activeQuestions.length;
    res.json({
      score,
      total,
      percentage: Math.round((score / total) * 100),
      results
    });
  } catch (err) {
    console.error('Error submitting quiz answers:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;
