const express = require('express');
const router = express.Router();
const db = require('../data/db');

router.get('/', async (req, res) => {
  try {
    const quizzes = await db.getQuizzes();
    const reviews = await db.getReviews();
    res.render('index', {
      title: 'منصة التعلم التفاعلي',
      quizzes,
      reviewTopics: reviews,
      totalQuizzes: quizzes.length,
      totalReviews: reviews.length,
      totalQuestions: quizzes.reduce((acc, q) => acc + q.questions.length, 0)
    });
  } catch (err) {
    console.error('Error loading index:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
