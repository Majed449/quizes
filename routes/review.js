const express = require('express');
const router = express.Router();
const db = require('../data/db');

router.get('/', (req, res) => {
  res.render('reviews', { title: 'المراجعة', reviewTopics: db.getReviews() });
});

router.get('/:id', (req, res) => {
  const topic = db.getReview(req.params.id);
  if (!topic) return res.redirect('/review');
  res.render('review', { title: topic.title, topic });
});

module.exports = router;
