const express = require('express');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'quiz-platform-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/', require('./routes/index'));
app.use('/quiz', require('./routes/quiz'));
app.use('/review', require('./routes/review'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.listen(PORT, () => {
  console.log(`✅ The Server is running on http://localhost:${PORT}`);
  console.log(`🔐 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`🔐 Username: admin | Password: admin123`);
});

module.exports = app;
