const express = require('express');
const router = express.Router();
const db = require('../data/db');
const { rooms } = require('../sockets/battle');

// Generate 6-digit Room Code
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[code]); // Ensure uniqueness
  return code;
}

// GET /battle/join - Render join room form
router.get('/join', (req, res) => {
  res.render('battle', { 
    title: 'انضمام للتحدي', 
    viewMode: 'join', 
    roomCode: null, 
    quizTitle: null,
    playerName: null,
    error: req.query.error || null,
    questionCount: null
  });
});

// POST /battle/join - Handle join submission
router.post('/join', (req, res) => {
  const { roomCode, playerName } = req.body;
  const cleanCode = (roomCode || '').trim();
  console.log(`[DEBUG] Attempting to join room: "${cleanCode}". Existing rooms:`, Object.keys(rooms));
  
  if (!rooms[cleanCode]) {
    console.log(`[DEBUG] Room "${cleanCode}" not found in rooms:`, Object.keys(rooms));
    return res.redirect(`/battle/join?error=${encodeURIComponent('كود الغرفة غير صحيح أو منتهى الصلاحية')}`);
  }
  
  if (rooms[cleanCode].status !== 'waiting') {
    return res.redirect(`/battle/join?error=${encodeURIComponent('التحدي في هذه الغرفة بدأ بالفعل')}`);
  }
  
  if (rooms[cleanCode].players.length >= 2) {
    return res.redirect(`/battle/join?error=${encodeURIComponent('الغرفة ممتلئة بالكامل')}`);
  }
  
  // Store player name in session for websocket handshake
  req.session.playerName = playerName || 'منافس';
  res.redirect(`/battle/room/${cleanCode}`);
});

// GET /battle/create?quizId=XYZ - Render nickname form for creating room
router.get('/create', async (req, res) => {
  try {
    const { quizId } = req.query;
    const quiz = await db.getQuiz(quizId);
    
    if (!quiz) {
      return res.redirect('/quiz');
    }
    
    res.render('battle', { 
      title: 'إنشاء تحدي جديد', 
      viewMode: 'create', 
      quizId: quizId,
      quizTitle: quiz.title,
      totalQuestions: quiz.questions.length,
      questionCount: null,
      error: null 
    });
  } catch (err) {
    console.error('Error rendering battle creation:', err);
    res.redirect('/quiz');
  }
});

// POST /battle/create - Process nickname and create room
router.post('/create', async (req, res) => {
  try {
    const { quizId, playerName, questionCount } = req.body;
    const quiz = await db.getQuiz(quizId);
    
    if (!quiz) {
      return res.redirect('/quiz');
    }
    
    const code = generateRoomCode();
    console.log(`[DEBUG] Creating room: ${code}. Existing rooms:`, Object.keys(rooms));
    
    // Shuffle the quiz questions
    const shuffledQuestions = [...quiz.questions];
    for (let i = shuffledQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQuestions[i], shuffledQuestions[j]] = [shuffledQuestions[j], shuffledQuestions[i]];
    }

    // Slice to the requested limit if specified and not 'all'
    let finalQuestions = shuffledQuestions;
    if (questionCount && questionCount !== 'all') {
      const limit = parseInt(questionCount, 10);
      if (!isNaN(limit) && limit > 0) {
        finalQuestions = shuffledQuestions.slice(0, limit);
      }
    }

    // Initialize room data
    rooms[code] = {
      id: code,
      quizId: quizId,
      quizTitle: quiz.title,
      questions: finalQuestions,
      players: [],
      status: 'waiting'
    };
    
    // Store player name in session for websocket handshake
    req.session.playerName = playerName || 'متحدي';
    
    res.redirect(`/battle/room/${code}`);
  } catch (err) {
    console.error('Error creating battle room:', err);
    res.redirect('/quiz');
  }
});

// GET /battle/room/:code - Battle room interface (lobby/arena)
router.get('/room/:code', (req, res) => {
  const { code } = req.params;
  const room = rooms[code];
  
  if (!room) {
    return res.redirect('/battle/join?error=' + encodeURIComponent('هذه الغرفة غير موجودة أو انتهت صلاحيتها'));
  }
  
  if (!req.session.playerName) {
    return res.redirect(`/battle/join?roomCode=${code}`);
  }
  
  const playerName = req.session.playerName;
  
  res.render('battle', { 
    title: `تحدي: ${room.quizTitle}`, 
    viewMode: 'lobby', 
    roomCode: code, 
    quizTitle: room.quizTitle,
    playerName,
    roomStatus: room.status,
    questionCount: room.questions.length
  });
});

module.exports = router;
