const express = require('express');
const path = require('path');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files — JS/CSS always fresh, fonts cached 30 days
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Fonts: cached 30 days (never change)
    if (/\.(woff2?|ttf|eot|otf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    // JS and CSS: always revalidate so code changes are instant
    } else if (/\.(js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    // Images: cached 1 day
    } else if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));


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
app.use('/battle', require('./routes/battle'));
app.use('/chat', require('./routes/chat'));

// Initialize multiplayer socket logic
require('./sockets/battle')(io);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

server.listen(PORT, () => {
  console.log(`✅ The Server is running on http://localhost:${PORT}`);
  console.log(`🔐 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`🔐 Username: admin | Password: admin123`);
});

module.exports = app;
