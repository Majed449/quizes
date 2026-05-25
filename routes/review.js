const express = require('express');
const router = express.Router();
const db = require('../data/db');

router.get('/', async (req, res) => {
  try {
    const reviewTopics = await db.getReviews();
    res.render('reviews', { title: 'المراجعة', reviewTopics });
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const topic = await db.getReview(req.params.id);
    if (!topic) return res.redirect('/review');
    res.render('review', { title: topic.title, topic });
  } catch (err) {
    console.error('Error fetching review topic:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
