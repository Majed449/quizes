const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'db.json');

function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ── QUIZZES ──────────────────────────────────────────────
function getQuizzes() {
  return readDB().quizzes;
}

function getQuiz(id) {
  return readDB().quizzes.find(q => q.id === id);
}

function createQuiz(data) {
  const db = readDB();
  const quiz = {
    id: 'quiz-' + Date.now(),
    createdAt: new Date().toISOString(),
    questions: [],
    ...data
  };
  db.quizzes.push(quiz);
  writeDB(db);
  return quiz;
}

function updateQuiz(id, data) {
  const db = readDB();
  const idx = db.quizzes.findIndex(q => q.id === id);
  if (idx === -1) return null;
  db.quizzes[idx] = { ...db.quizzes[idx], ...data };
  writeDB(db);
  return db.quizzes[idx];
}

function deleteQuiz(id) {
  const db = readDB();
  db.quizzes = db.quizzes.filter(q => q.id !== id);
  writeDB(db);
}

// ── REVIEWS ──────────────────────────────────────────────
function getReviews() {
  return readDB().reviews;
}

function getReview(id) {
  return readDB().reviews.find(r => r.id === id);
}

function createReview(data) {
  const db = readDB();
  const review = {
    id: 'review-' + Date.now(),
    createdAt: new Date().toISOString(),
    sections: [],
    ...data
  };
  db.reviews.push(review);
  writeDB(db);
  return review;
}

function updateReview(id, data) {
  const db = readDB();
  const idx = db.reviews.findIndex(r => r.id === id);
  if (idx === -1) return null;
  db.reviews[idx] = { ...db.reviews[idx], ...data };
  writeDB(db);
  return db.reviews[idx];
}

function deleteReview(id) {
  const db = readDB();
  db.reviews = db.reviews.filter(r => r.id !== id);
  writeDB(db);
}

// ── AUTH ──────────────────────────────────────────────────
function getAdmin() {
  return readDB().admin;
}

function verifyAdmin(username, password) {
  const admin = getAdmin();
  if (admin.username !== username) return false;
  return bcrypt.compareSync(password, admin.password);
}

function updateAdminPassword(newPassword) {
  const db = readDB();
  db.admin.password = bcrypt.hashSync(newPassword, 10);
  writeDB(db);
}

// Hash default password on first run if it's plaintext
(function initAdmin() {
  const db = readDB();
  if (!db.admin.password.startsWith('$2b$')) {
    db.admin.password = bcrypt.hashSync(db.admin.password, 10);
    writeDB(db);
  }
})();

module.exports = {
  getQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz,
  getReviews, getReview, createReview, updateReview, deleteReview,
  verifyAdmin, updateAdminPassword
};
