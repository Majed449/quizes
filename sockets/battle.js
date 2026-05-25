const db = require('../data/db');

// In-memory room storage
const rooms = {};

module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    // Join room
    socket.on('join_room', ({ roomCode, playerName }) => {
      let room = rooms[roomCode];
      if (!room) {
        socket.emit('error_message', 'هذه الغرفة غير موجودة أو انتهت صلاحيتها.');
        return;
      }

      // Clear any pending cleanup or disconnect timeouts
      if (room.cleanupTimeout) {
        clearTimeout(room.cleanupTimeout);
        delete room.cleanupTimeout;
        console.log(`[DEBUG] Cleared cleanup timeout for room ${roomCode}`);
      }
      if (room.disconnectTimeout) {
        clearTimeout(room.disconnectTimeout);
        delete room.disconnectTimeout;
        console.log(`[DEBUG] Cleared disconnect timeout for room ${roomCode}`);
      }

      const nameToUse = playerName || `طالب ${room.players.length + 1}`;

      // Check if this player is reconnecting (matching by name)
      let existingPlayer = room.players.find(p => p.name === nameToUse);

      if (existingPlayer) {
        console.log(`👤 Player "${nameToUse}" reconnected with new socket ${socket.id} in room ${roomCode}`);
        existingPlayer.id = socket.id;
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerId = existingPlayer.id;

        // Notify room members
        io.to(roomCode).emit('room_update', {
          players: room.players.map(p => ({ id: p.id, name: p.name, finished: p.finished })),
          status: room.status
        });

        // If the match is already playing, resume game state for them
        if (room.status === 'playing') {
          const secureQuestions = room.questions.map(q => {
            const qCopy = { ...q };
            delete qCopy.answer;
            return qCopy;
          });

          socket.emit('match_resume', {
            players: room.players.map(p => ({ id: p.id, name: p.name })),
            questions: secureQuestions,
            quizTitle: room.quizTitle,
            currentQuestionIndex: existingPlayer.progress,
            score: existingPlayer.score,
            timeElapsed: Math.floor((Date.now() - room.startTime) / 1000)
          });
        }
        return;
      }

      if (room.status !== 'waiting') {
        socket.emit('error_message', 'لقد بدأت المنافسة بالفعل في هذه الغرفة.');
        return;
      }

      if (room.players.length >= 2) {
        socket.emit('error_message', 'هذه الغرفة ممتلئة بالكامل.');
        return;
      }

      // Add player details
      const player = {
        id: socket.id,
        name: nameToUse,
        score: 0,
        progress: 0, // number of answered questions
        finished: false,
        timeTaken: 0
      };

      room.players.push(player);
      socket.join(roomCode);
      socket.roomCode = roomCode;
      socket.playerId = player.id;

      console.log(`👤 Player "${player.name}" joined room ${roomCode}`);

      // Notify room members
      io.to(roomCode).emit('room_update', {
        players: room.players.map(p => ({ id: p.id, name: p.name, finished: p.finished })),
        status: room.status
      });

      // If 2 players have joined, start the match!
      if (room.players.length === 2) {
        room.status = 'playing';
        room.startTime = Date.now(); // Record game start time

        // Strip answers from questions for security
        const secureQuestions = room.questions.map(q => {
          const qCopy = { ...q };
          delete qCopy.answer;
          return qCopy;
        });

        io.to(roomCode).emit('match_start', {
          players: room.players.map(p => ({ id: p.id, name: p.name })),
          questions: secureQuestions,
          quizTitle: room.quizTitle
        });
      }
    });

    // Handle answer submission securely on the server
    socket.on('submit_answer', ({ questionIndex, selectedAnswer }) => {
      const roomCode = socket.roomCode;
      const playerId = socket.playerId;
      const room = rooms[roomCode];
      if (!room || room.status !== 'playing') return;

      const player = room.players.find(p => p.id === playerId);
      if (!player) return;

      // Prevent duplicate or out-of-order submissions
      if (questionIndex !== player.progress) {
        console.log(`[DEBUG] Blocked duplicate/out-of-order submission. Index: ${questionIndex}, Progress: ${player.progress}`);
        return;
      }

      const q = room.questions[questionIndex];
      if (!q) return;

      let isCorrect = false;
      if (q.type === 'truefalse') {
        isCorrect = (selectedAnswer === true || selectedAnswer === 'true' || selectedAnswer === 'صح') === q.answer;
      } else if (q.type === 'multiple') {
        isCorrect = parseInt(selectedAnswer) === q.answer;
      }

      if (isCorrect) {
        player.score += 1;
      }
      player.progress = questionIndex + 1;

      // Sync battle answer to spaced repetition deck
      if (player.name) {
        if (isCorrect) {
          db.masterSpacedCard(player.name, q.id)
            .catch(err => console.error('[SPACED_REP] Error mastering spaced card in battle:', err));
        } else {
          db.addSpacedCard(player.name, q.id, q.type, {
            id: q.id,
            type: q.type,
            question: q.question,
            answer: q.answer,
            options: q.options,
            explanation: q.explanation
          }).catch(err => console.error('[SPACED_REP] Error adding spaced card in battle:', err));
        }
      }

      // Respond with correctness and reveal correct answer index/value
      socket.emit('answer_result', {
        questionIndex,
        isCorrect,
        correctAnswer: q.answer
      });

      // Broadcast progress update to the opponent
      socket.to(roomCode).emit('opponent_progress', {
        playerId: player.id,
        progress: player.progress,
        score: player.score
      });
    });

    // Player finished
    socket.on('player_finished', () => {
      const roomCode = socket.roomCode;
      const playerId = socket.playerId;
      const room = rooms[roomCode];
      if (!room || room.status !== 'playing') return;

      const player = room.players.find(p => p.id === playerId);
      if (!player) return;

      player.finished = true;
      player.timeTaken = Math.max(1, Math.floor((Date.now() - room.startTime) / 1000));

      // Check if the other player is disconnected and auto-finish them
      const otherPlayer = room.players.find(p => p.id !== playerId);
      if (otherPlayer && !otherPlayer.finished) {
        const isOtherConnected = io.sockets.sockets.has(otherPlayer.id);
        if (!isOtherConnected) {
          otherPlayer.finished = true;
          otherPlayer.timeTaken = player.timeTaken + 10; // Give them a slight time penalty for leaving
          console.log(`[DEBUG] Automatically marked disconnected player "${otherPlayer.name}" as finished.`);
        }
      }

      // Broadcast finished status
      socket.to(roomCode).emit('opponent_finished', {
        playerId: player.id,
        score: player.score,
        timeTaken: player.timeTaken
      });

      // Check if both players are finished
      const allFinished = room.players.every(p => p.finished);
      if (allFinished) {
        room.status = 'finished';

        const p1 = room.players[0];
        const p2 = room.players[1];
        let winnerId = null;

        if (p1.score > p2.score) {
          winnerId = p1.id;
        } else if (p2.score > p1.score) {
          winnerId = p2.id;
        } else {
          // If scores are equal, compare completion time
          if (p1.timeTaken < p2.timeTaken) {
            winnerId = p1.id;
          } else if (p2.timeTaken < p1.timeTaken) {
            winnerId = p2.id;
          }
        }

        io.to(roomCode).emit('match_finished', {
          players: room.players,
          winnerId: winnerId
        });

        // Keep room data for 5 minutes then clean up (allows clients to view results page without breaking on reload)
        setTimeout(() => {
          delete rooms[roomCode];
        }, 5 * 60 * 1000);
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      const roomCode = socket.roomCode;
      const playerId = socket.playerId;
      
      if (roomCode && rooms[roomCode]) {
        const room = rooms[roomCode];
        
        // Remove player
        room.players = room.players.filter(p => p.id !== playerId);
        console.log(`❌ Player left room ${roomCode}. Remaining count: ${room.players.length}`);

        if (room.players.length === 0) {
          // Graceful cleanup timeout (20 seconds) for empty lobbies to allow reloads
          if (room.status === 'waiting') {
            console.log(`[DEBUG] Starting 20s empty lobby cleanup timeout for room ${roomCode}`);
            room.cleanupTimeout = setTimeout(() => {
              if (rooms[roomCode] && rooms[roomCode].players.length === 0) {
                delete rooms[roomCode];
                console.log(`🧹 Room ${roomCode} deleted due to empty lobby timeout.`);
              }
            }, 20000);
          } else {
            // If match is active or finished, delete immediately
            delete rooms[roomCode];
          }
        } else {
          // One player is still in the room.
          // If match is active, notify them and delete room after 5 seconds if they don't reconnect
          if (room.status === 'playing') {
            console.log(`[DEBUG] Starting 5s reconnect timeout for active playing room ${roomCode}`);
            room.disconnectTimeout = setTimeout(() => {
              if (rooms[roomCode] && rooms[roomCode].status === 'playing') {
                io.to(roomCode).emit('opponent_disconnected', {
                  message: 'لقد غادر منافسك التحدي. تم إنهاء اللعبة.'
                });
                delete rooms[roomCode];
                console.log(`🧹 Room ${roomCode} deleted after active match opponent disconnect.`);
              }
            }, 5000);
          }
        }
      }
    });
  });
};

module.exports.rooms = rooms;
