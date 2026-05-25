require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Automatically create spaced_repetition table on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS spaced_repetition (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(255) NOT NULL,
    question_id VARCHAR(255) NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    question_data JSONB NOT NULL,
    box INT NOT NULL DEFAULT 1,
    next_review TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    interval INT NOT NULL DEFAULT 1,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    repetitions INT NOT NULL DEFAULT 0,
    mastered BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(player_name, question_id)
  );
  CREATE INDEX IF NOT EXISTS idx_spaced_player_review ON spaced_repetition(player_name, next_review) WHERE NOT mastered;
`).catch(err => console.error('Error creating spaced_repetition table:', err));

// In-memory caches for static tables
let quizzesCache = null;
let reviewsCache = null;
let settingsCache = null;

// Helper: map database row to quiz object structure
function mapQuizRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    description: row.description,
    icon: row.icon,
    color: row.color,
    questions: row.questions || []
  };
}

// Helper: map database row to review object structure
function mapReviewRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    subject: row.subject,
    icon: row.icon,
    color: row.color,
    description: row.description,
    sections: row.sections || []
  };
}

// ── QUIZZES ──────────────────────────────────────────────
async function getQuizzes() {
  if (quizzesCache) return quizzesCache;
  const res = await pool.query('SELECT * FROM quizzes ORDER BY created_at DESC');
  quizzesCache = res.rows.map(mapQuizRow);
  return quizzesCache;
}

async function getQuiz(id) {
  if (quizzesCache) {
    const cached = quizzesCache.find(q => q.id === id);
    if (cached) return cached;
  }
  const res = await pool.query('SELECT * FROM quizzes WHERE id = $1', [id]);
  return mapQuizRow(res.rows[0]);
}

async function createQuiz(data) {
  quizzesCache = null;
  const id = data.id || 'quiz-' + Date.now();
  const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
  const { title, description, icon, color, questions } = data;
  
  const res = await pool.query(
    `INSERT INTO quizzes (id, created_at, title, description, icon, color, questions) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) 
     RETURNING *`,
    [id, createdAt, title, description, icon, color, JSON.stringify(questions || [])]
  );
  return mapQuizRow(res.rows[0]);
}

async function updateQuiz(id, data) {
  quizzesCache = null;
  const existing = await getQuiz(id);
  if (!existing) return null;
  
  const merged = { ...existing, ...data };
  const res = await pool.query(
    `UPDATE quizzes 
     SET title = $1, description = $2, icon = $3, color = $4, questions = $5, created_at = $6 
     WHERE id = $7 
     RETURNING *`,
    [
      merged.title,
      merged.description,
      merged.icon,
      merged.color,
      JSON.stringify(merged.questions),
      merged.createdAt,
      id
    ]
  );
  return mapQuizRow(res.rows[0]);
}

async function deleteQuiz(id) {
  quizzesCache = null;
  await pool.query('DELETE FROM quizzes WHERE id = $1', [id]);
}

// ── REVIEWS ──────────────────────────────────────────────
async function getReviews() {
  if (reviewsCache) return reviewsCache;
  const res = await pool.query('SELECT * FROM reviews ORDER BY created_at DESC');
  reviewsCache = res.rows.map(mapReviewRow);
  return reviewsCache;
}

async function getReview(id) {
  if (reviewsCache) {
    const cached = reviewsCache.find(r => r.id === id);
    if (cached) return cached;
  }
  const res = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
  return mapReviewRow(res.rows[0]);
}

async function createReview(data) {
  reviewsCache = null;
  const id = data.id || 'review-' + Date.now();
  const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
  const { title, subject, icon, color, description, sections } = data;
  
  const res = await pool.query(
    `INSERT INTO reviews (id, created_at, title, subject, icon, color, description, sections) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
     RETURNING *`,
    [id, createdAt, title, subject, icon, color, description, JSON.stringify(sections || [])]
  );
  return mapReviewRow(res.rows[0]);
}

async function updateReview(id, data) {
  reviewsCache = null;
  const existing = await getReview(id);
  if (!existing) return null;
  
  const merged = { ...existing, ...data };
  const res = await pool.query(
    `UPDATE reviews 
     SET title = $1, subject = $2, icon = $3, color = $4, description = $5, sections = $6, created_at = $7 
     WHERE id = $8 
     RETURNING *`,
    [
      merged.title,
      merged.subject,
      merged.icon,
      merged.color,
      merged.description,
      JSON.stringify(merged.sections),
      merged.createdAt,
      id
    ]
  );
  return mapReviewRow(res.rows[0]);
}

async function deleteReview(id) {
  reviewsCache = null;
  await pool.query('DELETE FROM reviews WHERE id = $1', [id]);
}

// ── AUTH ──────────────────────────────────────────────────
async function verifyAdmin(username, password) {
  const res = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
  if (res.rows.length === 0) return false;
  const admin = res.rows[0];
  return bcrypt.compare(password, admin.password);
}

async function updateAdminPassword(newPassword) {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const adminRes = await pool.query('SELECT username FROM admins LIMIT 1');
  const username = adminRes.rows.length > 0 ? adminRes.rows[0].username : 'admin';
  await pool.query('UPDATE admins SET password = $1 WHERE username = $2', [hashedPassword, username]);
}

// ── SETTINGS ──────────────────────────────────────────────
async function getSettings() {
  if (settingsCache) return settingsCache;
  const res = await pool.query('SELECT key, value FROM settings');
  const settings = {};
  res.rows.forEach(row => {
    settings[row.key] = row.value;
  });
  
  if (Object.keys(settings).length === 0) {
    settings.allowCustomQuestionCount = true;
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      ['allowCustomQuestionCount', JSON.stringify(true)]
    );
  }
  settingsCache = settings;
  return settingsCache;
}

async function updateSettings(data) {
  settingsCache = null;
  const current = await getSettings();
  const merged = { ...current, ...data };
  
  for (const [key, value] of Object.entries(merged)) {
    await pool.query(
      `INSERT INTO settings (key, value) 
       VALUES ($1, $2) 
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)]
    );
  }
  return merged;
}

// ── SPACED REPETITION ──────────────────────────────────────
async function getDueSpacedCard(playerName) {
  const res = await pool.query(
    `SELECT * FROM spaced_repetition 
     WHERE player_name = $1 AND NOT mastered AND next_review <= NOW() 
     ORDER BY next_review ASC LIMIT 1`,
    [playerName]
  );
  return res.rows[0] || null;
}

async function addSpacedCard(playerName, questionId, questionType, questionData) {
  await pool.query(
    `INSERT INTO spaced_repetition (player_name, question_id, question_type, question_data, mastered, box, interval, repetitions, next_review) 
     VALUES ($1, $2, $3, $4, FALSE, 1, 1, 0, NOW()) 
     ON CONFLICT (player_name, question_id) 
     DO UPDATE SET mastered = FALSE, box = 1, interval = 1, repetitions = 0, next_review = NOW()`,
    [playerName, questionId, questionType, JSON.stringify(questionData)]
  );
}

async function masterSpacedCard(playerName, questionId) {
  await pool.query(
    `UPDATE spaced_repetition 
     SET mastered = TRUE 
     WHERE player_name = $1 AND question_id = $2`,
    [playerName, questionId]
  );
}

async function updateSpacedCard(id, box, interval, easeFactor, repetitions, nextReview, mastered) {
  await pool.query(
    `UPDATE spaced_repetition 
     SET box = $2, interval = $3, ease_factor = $4, repetitions = $5, next_review = $6, mastered = $7 
     WHERE id = $1`,
    [id, box, interval, easeFactor, repetitions, nextReview, mastered]
  );
}

async function getSpacedStats(playerName) {
  const res = await pool.query(
    `SELECT 
       COUNT(*)::int as total_cards,
       COUNT(*) FILTER (WHERE next_review <= NOW() AND NOT mastered)::int as due_cards,
       COUNT(*) FILTER (WHERE mastered)::int as mastered_cards
     FROM spaced_repetition
     WHERE player_name = $1`,
    [playerName]
  );
  return res.rows[0] || { total_cards: 0, due_cards: 0, mastered_cards: 0 };
}

module.exports = {
  pool, // Expose pool in case we need direct query control
  getQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz,
  getReviews, getReview, createReview, updateReview, deleteReview,
  verifyAdmin, updateAdminPassword, getSettings, updateSettings,
  getDueSpacedCard, addSpacedCard, masterSpacedCard, updateSpacedCard, getSpacedStats
};
