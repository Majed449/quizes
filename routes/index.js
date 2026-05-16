const express = require('express');
const router = express.Router();
const db = require('../data/db');

router.get('/', (req, res) => {
  const quizzes = db.getQuizzes();
  const reviews = db.getReviews();
  res.render('index', {
    title: 'منصة التعلم التفاعلي',
    quizzes,
    reviewTopics: reviews,
    totalQuizzes: quizzes.length,
    totalReviews: reviews.length,
    totalQuestions: quizzes.reduce((acc, q) => acc + q.questions.length, 0)
  });
});

module.exports = router;
