const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const chapters = require('./chapters');

app.use(express.static(path.join(__dirname, 'public')));

let players = [];
let chapterId = 1;
let votes = {};
let numberChoices = {};

io.on('connection', socket => {
socket.on('join', ({ name, character }) => {
  players.push({ id: socket.id, name, character });
    io.emit('updatePlayers', players.map(p => p.name));

    if (players.length === 1) {
      socket.emit('waiting', 'Esperando a otro jugador...');
    }

    if (players.length >= 2) {
      startChapter();
    }
  });

  socket.on('restartGame', () => {
    chapterId = 1;          // Reinicia al capítulo 1
    votes = {};             // Limpia votos previos
    numberChoices = {};     // Limpia elecciones de dados (si usas)
    io.emit('updatePlayers', players.map(p => p.name)); // Actualiza lista de jugadores conectados
    startChapter();         // Inicia nuevamente la historia desde el principio
  });

socket.on('vote', choice => {
  votes[socket.id] = choice;
  const player = players.find(p => p.id === socket.id);
  const chapter = chapters[chapterId];
  const selectedOption = chapter.options.find(opt => opt.id === choice);

  if (player && selectedOption) {
    io.emit('playerVoted', {
      name: player.name,
      optionText: selectedOption.text
    });
  }

  checkVotes();
});


  socket.on('numberChoice', num => {
    numberChoices[socket.id] = num;
    checkNumberChoices();
  });

  socket.on('chatMessage', msg => {
    const sender = players.find(p => p.id === socket.id);
    if (sender) {
      io.emit('chatMessage', { name: sender.name, msg });
    }
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    io.emit('updatePlayers', players.map(p => p.name));
    resetState();
  });
});

function startChapter() {
  votes = {};
  numberChoices = {};
  const chap = chapters[chapterId];
  io.emit('chapter', chap);
}

function checkVotes() {
  if (Object.keys(votes).length < players.length) return;

  const tally = {};
  players.forEach(p => {
    const choice = votes[p.id];
    tally[choice] = (tally[choice] || 0) + 1;
  });

  const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const tie = entries.length > 1 && entries[0][1] === entries[1][1];

  if (!tie) {
    const result = entries[0][0];
    io.emit('voteResult', {
      result,
      reason: 'Mayoría',
      votes: tally
    });
    processChoice(result);
  } else {
    io.emit('startDice');
  }
}

function checkNumberChoices() {
  if (Object.keys(numberChoices).length < players.length) return;

  const [p1, p2] = players.map(p => p.id);
  const n1 = numberChoices[p1], n2 = numberChoices[p2];

  let winnerId;
  let diceRoll;

  do {
    diceRoll = Math.floor(Math.random() * 6) + 1;
    if (diceRoll === n1) winnerId = p1;
    if (diceRoll === n2) winnerId = p2;
  } while (!winnerId);

  const result = votes[winnerId];
  const tally = {};
  players.forEach(p => {
    const choice = votes[p.id];
    tally[choice] = (tally[choice] || 0) + 1;
  });

  io.emit('voteResult', {
    result,
    reason: 'Empate resuelto con dado',
    votes: tally,
    diceRoll,
    numberChoices: {
      [players[0].name]: n1,
      [players[1].name]: n2
    }
  });

  processChoice(result);
}

function processChoice(choiceId) {
  const chap = chapters[chapterId];
  const opt = chap.options.find(o => o.id === choiceId);
  if (!opt) {
    io.emit('end', "¡La aventura terminó!");
    resetState();
    return;
  }
  chapterId = opt.next;
  const nextChap = chapters[chapterId];
  if (!nextChap.options.length) {
    io.emit('chapter', nextChap);
    io.emit('end', "Fin de la aventura.");
    resetState();
  } else {
    startChapter();
  }
}

function resetState() {
  votes = {};
  numberChoices = {};
}

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
