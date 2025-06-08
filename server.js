const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
/**
 * Estructuras para manejar usuarios y salas
 */
const players = new Map(); // socket.id -> {name, character, roomId}
const rooms = new Map();   // roomId -> {players: [socketId, socketId], gameState}

/**
 * Crear nueva sala 1v1 o asignar jugador a una existente
 */
function findOrCreateRoom() {
    for (const [roomId, room] of rooms.entries()) {
        if (room.players.length === 1) {
            return roomId;
        }
    }
    const newRoomId = `room-${Math.floor(Math.random() * 10000)}`;
    rooms.set(newRoomId, { players: [], gameState: null });
    return newRoomId;
}

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Evento: jugador se registra (nombre, personaje)
    socket.on('player-join', ({ name, character }) => {
        players.set(socket.id, { name, character, roomId: null });

        // Asignar sala
        let roomId = findOrCreateRoom();
        const room = rooms.get(roomId);
        if (room.players.length < 2) {
            room.players.push(socket.id);
            players.get(socket.id).roomId = roomId;
            socket.join(roomId);

            // Avisar a todos en la sala la lista actualizada
            const roomPlayers = room.players.map(id => {
                const p = players.get(id);
                return { id, name: p.name, character: p.character };
            });

            io.to(roomId).emit('waiting-room-update', { players: roomPlayers });

            // Si sala completa, iniciar partida
            if (room.players.length === 2) {
                startGame(roomId);
            }
        }
    });

    // Evento: jugador envía acción (usar habilidad)
    socket.on('player-action', ({ abilityId }) => {
        const player = players.get(socket.id);
        if (!player) return;
        const roomId = player.roomId;
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || !room.gameState) return;

        handlePlayerAction(room, socket.id, abilityId);
    });

    // Evento: chat global (en la sala)
    socket.on('chat-message', (msg) => {
        const player = players.get(socket.id);
        if (!player) return;
        const roomId = player.roomId;
        if (!roomId) return;
        io.to(roomId).emit('chat-message', { name: player.name, message: msg });
    });

    // Desconexión
    socket.on('disconnect', () => {
        console.log('Usuario desconectado:', socket.id);
        const player = players.get(socket.id);
        if (!player) return;
        const roomId = player.roomId;
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                room.players = room.players.filter(id => id !== socket.id);
                // Avisar a los otros que el jugador se fue
                io.to(roomId).emit('player-disconnected', { id: socket.id, name: player.name });
                // Si no quedan jugadores, eliminar sala
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                }
            }
        }
        players.delete(socket.id);
    });
});

/**
 * Inicia la partida con estados iniciales
 */
function startGame(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    // Estado inicial de los jugadores (vida, habilidades, etc)
    const p1 = players.get(room.players[0]);
    const p2 = players.get(room.players[1]);

    room.gameState = {
        turnIndex: 0,
        players: [
            {
                socketId: room.players[0],
                name: p1.name,
                character: p1.character,
                hp: p1.character.initialHp,
                maxHp: p1.character.initialHp,
                abilities: p1.character.abilities,
                alive: true,
            },
            {
                socketId: room.players[1],
                name: p2.name,
                character: p2.character,
                hp: p2.character.initialHp,
                maxHp: p2.character.initialHp,
                abilities: p2.character.abilities,
                alive: true,
            }
        ],
        log: [`¡La batalla comienza entre ${p1.name} y ${p2.name}!`]
    };

    // Avisar a los jugadores que comienza el combate con info
    io.to(roomId).emit('game-start', {
        players: room.gameState.players.map(p => ({
            name: p.name,
            character: p.character,
            hp: p.hp,
            maxHp: p.maxHp,
            socketId: p.socketId,
        })),
        turnSocketId: room.gameState.players[room.gameState.turnIndex].socketId,
        log: room.gameState.log,
    });
}

/**
 * Manejar acción del jugador (usar habilidad)
 */
function handlePlayerAction(room, playerId, abilityId) {
    if (!room.gameState) return;

    const gs = room.gameState;
    const currentPlayer = gs.players[gs.turnIndex];
    if (currentPlayer.socketId !== playerId) {
        io.to(playerId).emit('error-message', 'No es tu turno');
        return;
    }

    const opponentIndex = (gs.turnIndex + 1) % 2;
    const opponent = gs.players[opponentIndex];

    const ability = currentPlayer.abilities.find(a => a.id === abilityId);
    if (!ability) {
        io.to(playerId).emit('error-message', 'Habilidad inválida');
        return;
    }

    // Lógica simple: habilidad hace daño igual a baseAttack + bonus
    // Para simplificar, asumamos que el daño = baseAttack + (habilidad index * 5)
    // Se puede expandir según habilidad

    let damage = currentPlayer.character.baseAttack + 10; // base + 10 fijo

    gs.log.push(`${currentPlayer.name} usa ${ability.name} y causa ${damage} de daño a ${opponent.name}`);

    opponent.hp -= damage;
    if (opponent.hp <= 0) {
        opponent.hp = 0;
        opponent.alive = false;
        gs.log.push(`${opponent.name} ha sido derrotado!`);
    }

    // Cambiar turno si juego no terminó
    if (opponent.alive) {
        gs.turnIndex = opponentIndex;
        gs.log.push(`Turno de ${gs.players[gs.turnIndex].name}`);
    } else {
        gs.log.push(`¡${currentPlayer.name} gana la partida!`);
    }

    // Enviar actualización a sala
    io.to(room.players[0]).emit('game-update', {
        players: gs.players.map(p => ({ name: p.name, hp: p.hp, maxHp: p.maxHp, alive: p.alive })),
        turnSocketId: gs.players[gs.turnIndex]?.socketId || null,
        log: gs.log,
    });
    io.to(room.players[1]).emit('game-update', {
        players: gs.players.map(p => ({ name: p.name, hp: p.hp, maxHp: p.maxHp, alive: p.alive })),
        turnSocketId: gs.players[gs.turnIndex]?.socketId || null,
        log: gs.log,
    });
}

http.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
