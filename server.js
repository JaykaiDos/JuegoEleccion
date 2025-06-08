// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicos para las salas

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server);

const PORT = process.env.PORT || 3000;

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- DEFINICIÓN DE PERSONAJES ---
const CHARACTERS = {
    "deimos": {
        id: "deimos",
        name: "Deimos",
        class: "Ladrón",
        race: "Rata",
        initialHp: 80,
        baseAttack: 25,
        abilities: [
            { id: "basic_attack", name: "Mordisco Rápido", type: "damage", value: 25, description: "Causa 25 de daño." },
            { id: "poison", name: "Veneno Persistente", type: "dot", value: 10, duration: 3, description: "Causa 10 de daño por turno durante 3 turnos." },
            { id: "evasion", name: "Evasión Rápida", type: "buff", stat: "defense", value: 20, duration: 1, description: "Gana +20 de defensa para el próximo turno." }
        ]
    },
    "chris": {
        id: "chris",
        name: "Chris",
        class: "Simp",
        race: "Caracol",
        initialHp: 130,
        baseAttack: 15,
        abilities: [
            { id: "basic_attack", name: "Bofetada Suave", type: "damage", value: 15, description: "Causa 15 de daño." },
            { id: "shell_guard", name: "Caparazón Protector", type: "buff", stat: "defense", value: 30, duration: 1, description: "Gana +30 de defensa para el próximo turno." },
            { id: "slime_debuff", name: "Babeo Reductor", type: "debuff", stat: "attack", value: 10, duration: 1, description: "Reduce el ataque del enemigo en 10 para el próximo turno." }
        ]
    },
    "lezz": {
        id: "lezz",
        name: "Lezz",
        class: "Gamer",
        race: "Mono",
        initialHp: 90,
        baseAttack: 30,
        abilities: [
            { id: "basic_attack", name: "Combo de Teclas", type: "damage", value: 30, description: "Causa 30 de daño." },
            { id: "pixel_burst", name: "Ráfaga de Pixeles", type: "multihit", hits: 2, value: 15, description: "Realiza 2 ataques de 15 de daño cada uno." },
            { id: "gg_ez", name: "¡GG EZ!", type: "damage", value: 40, description: "Causa 40 de daño (25% de fallar - Aún no implementado)." }
        ]
    },
    "felore": {
        id: "felore",
        name: "Felore",
        class: "Tamer",
        race: "Peruano",
        initialHp: 100,
        baseAttack: 20,
        abilities: [
            { id: "basic_attack", name: "Silbido al Viento", type: "damage", value: 20, description: "Causa 20 de daño." },
            { id: "flock_distraction", name: "Bandada Distractora", type: "damage_cc", damage: 10, cc_chance: 0.5, duration: 1, description: "Causa 10 de daño y 50% de probabilidad de aturdir al enemigo por 1 turno." },
            { id: "feed_pigeon", name: "Alimentar Paloma", type: "heal", value: 25, description: "Cura 25 HP a un aliado." }
        ]
    }
};

// --- GESTIÓN DE SALAS ---
// playersInQueue ahora guardará objetos de jugador completos (una vez que hayan seleccionado personaje y nombre)
const playersInQueue = {
    '1v1': [], // [{socketId, mode, characterId, characterData, currentHp, maxHp, isReady, name}]
    '2v2': []
};
const rooms = {}; // {roomId: {id, type, players: [], status, turnOrder, combatLog}}

// Usaremos un Map para mantener un registro de todos los sockets conectados y su información básica (incluido el nombre temporal)
// Esto es útil para el chat global y la lista de jugadores del lobby antes de que entren en una cola o sala.
const connectedLobbySockets = new Map(); // socketId -> {name, socketId, mode, characterId}

io.on('connection', (socket) => {
    console.log(`Un usuario se ha conectado: ${socket.id}`);

    // Añadir el nuevo socket a la lista de conectados del lobby con un nombre temporal
    connectedLobbySockets.set(socket.id, { socketId: socket.id, name: `Usuario ${socket.id.substring(0, 4)}` });

    // Enviar la lista de personajes disponibles al cliente que se conecta
    socket.emit('charactersData', CHARACTERS); // Usar 'charactersData' para enviar el objeto completo

    // Inicializar el contador de colas para el nuevo cliente
    io.emit('queueUpdate', { '1v1': playersInQueue['1v1'].length, '2v2': playersInQueue['2v2'].length });

    // Actualizar la lista de jugadores del lobby para todos
    updateLobbyPlayerList();


    // Cuando un jugador selecciona un modo de juego
    socket.on('selectMode', (mode) => {
        if (!['1v1', '2v2'].includes(mode)) {
            console.log(`Modo inválido de ${socket.id}: ${mode}`);
            return;
        }

        // Si el jugador ya está en alguna cola, lo sacamos primero
        playersInQueue['1v1'] = playersInQueue['1v1'].filter(p => p.socketId !== socket.id);
        playersInQueue['2v2'] = playersInQueue['2v2'].filter(p => p.socketId !== socket.id);

        // Actualizar el objeto del jugador en connectedLobbySockets con el modo seleccionado
        const playerInLobby = connectedLobbySockets.get(socket.id);
        if (playerInLobby) {
            playerInLobby.mode = mode; // Guardamos el modo temporalmente
            connectedLobbySockets.set(socket.id, playerInLobby);
            console.log(`Jugador ${playerInLobby.name} ha seleccionado el modo ${mode}.`);
            // No se añade a playersInQueue aquí, sino después de seleccionar personaje y nombre
        }

        // Informar a todos los clientes del lobby cuántos jugadores hay en cada cola (aunque aún no están "en cola" oficialmente)
        io.emit('queueUpdate', { '1v1': playersInQueue['1v1'].length, '2v2': playersInQueue['2v2'].length });

        // Actualizar la lista de jugadores en el lobby para todos
        updateLobbyPlayerList();
    });

    // --- Selección de Personaje (Ahora solo para enviar la data del personaje al cliente) ---
    socket.on('characterSelected', (characterId) => {
        const charData = CHARACTERS[characterId];
        if (!charData) {
            console.log(`Personaje inválido de ${socket.id}: ${characterId}`);
            socket.emit('characterSelectionFailed', 'Personaje no válido.');
            return;
        }

        // Buscar el modo que el jugador seleccionó previamente (desde connectedLobbySockets)
        const playerInLobby = connectedLobbySockets.get(socket.id);
        if (!playerInLobby || !playerInLobby.mode) {
            console.log(`Jugador ${socket.id} intentó seleccionar personaje sin haber seleccionado modo.`);
            socket.emit('characterSelectionFailed', 'Primero selecciona un modo de juego.');
            return;
        }

        // Creamos un objeto temporal de jugador para el cliente (sin nombre final ni isReady: true)
        const tempPlayerInfo = {
            socketId: socket.id,
            mode: playerInLobby.mode, // Mantener el modo asociado
            characterId: characterId,
            characterData: charData,
            currentHp: charData.initialHp,
            maxHp: charData.initialHp,
            name: playerInLobby.name // Usar el nombre temporal del lobby
        };

        // Almacenar el objeto temporal en connectedLobbySockets para referenciarlo
        connectedLobbySockets.set(socket.id, tempPlayerInfo);

        console.log(`Jugador ${socket.id} ha seleccionado el personaje ${charData.name}.`);
        socket.emit('characterSelected', tempPlayerInfo); // Notificar al cliente que el personaje fue seleccionado
        // El cliente ahora irá a la pantalla de nombre.
    });

    // --- Jugador listo para emparejamiento (después de seleccionar personaje Y nombre) ---
    socket.on('playerReadyForMatchmaking', ({ characterId, playerName }) => {
        const charData = CHARACTERS[characterId];
        const trimmedPlayerName = playerName.trim();

        if (!charData || !trimmedPlayerName || trimmedPlayerName.length === 0) {
            console.log(`Datos inválidos para playerReadyForMatchmaking de ${socket.id}`);
            socket.emit('characterSelectionFailed', 'Datos de personaje o nombre inválidos.');
            return;
        }

        // Recuperar el modo de juego del jugador desde connectedLobbySockets
        const playerInLobby = connectedLobbySockets.get(socket.id);
        if (!playerInLobby || !playerInLobby.mode) {
            console.log(`Jugador ${socket.id} intentó estar listo sin haber seleccionado modo.`);
            socket.emit('characterSelectionFailed', 'Primero selecciona un modo de juego y personaje.');
            return;
        }

        // Crear el objeto de jugador completo con el nombre
        const playerInfo = {
            socketId: socket.id,
            name: trimmedPlayerName, // <--- ¡Aquí se asigna el nombre definitivo!
            characterId: characterId,
            characterData: charData,
            currentHp: charData.initialHp,
            maxHp: charData.initialHp,
            isReady: true // Ahora el jugador está realmente listo para el matchmaking
        };

        // Añadir el jugador completo a la cola de emparejamiento
        playersInQueue[playerInLobby.mode].push(playerInfo);

        // Actualizar el objeto en connectedLobbySockets con la info completa (incluido el nombre final y isReady)
        connectedLobbySockets.set(socket.id, playerInfo);

        console.log(`Jugador ${playerInfo.name} (${playerInfo.characterData.name}) está listo para emparejar en modo ${playerInLobby.mode}.`);

        // Notificar al cliente que ha sido agregado a la sala de espera (con su modo y su info completa)
        socket.emit('showWaitingRoom', { mode: playerInLobby.mode, playerInfo: playerInfo });

        // Intentar emparejar
        tryMatchmaking(playerInLobby.mode);

        // Actualizar las colas globales (para quienes siguen en el lobby)
        io.emit('queueUpdate', { '1v1': playersInQueue['1v1'].length, '2v2': playersInQueue['2v2'].length });
        // Actualizar la lista de jugadores en el lobby para todos
        updateLobbyPlayerList();
    });


    // Manejo del chat
    socket.on('chat message', (msg) => {
        let senderName = `Usuario ${socket.id.substring(0, 4)}`; // Nombre por defecto

        // Primero, buscar si el jugador está en alguna sala activa (prioridad)
        let foundInRoom = false;
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerInRoom = room.players.find(p => p.socketId === socket.id);
            if (playerInRoom) {
                senderName = playerInRoom.name;
                io.to(roomId).emit('chat message', `[${senderName}]: ${msg}`);
                foundInRoom = true;
                break;
            }
        }

        // Si no está en una sala, buscar en connectedLobbySockets para usar su nombre real o temporal
        if (!foundInRoom) {
            const playerInLobby = connectedLobbySockets.get(socket.id);
            if (playerInLobby && playerInLobby.name) {
                senderName = playerInLobby.name;
            }
            io.emit('chat message', `[${senderName} (Lobby)]: ${msg}`);
        }
    });

    // Desconexión de un usuario
    socket.on('disconnect', () => {
        console.log(`Un usuario se ha desconectado: ${socket.id}`);

        // Eliminar el socket de connectedLobbySockets
        const disconnectedPlayerInfo = connectedLobbySockets.get(socket.id);
        if (disconnectedPlayerInfo) {
            console.log(`Jugador ${disconnectedPlayerInfo.name} ha desconectado.`);
            connectedLobbySockets.delete(socket.id);
        }

        // 1. Eliminar de las colas de emparejamiento
        playersInQueue['1v1'] = playersInQueue['1v1'].filter(playerObj => playerObj.socketId !== socket.id);
        playersInQueue['2v2'] = playersInQueue['2v2'].filter(playerObj => playerObj.socketId !== socket.id);
        io.emit('queueUpdate', { '1v1': playersInQueue['1v1'].length, '2v2': playersInQueue['2v2'].length });


        // 2. Buscar y eliminar de alguna sala activa
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                const disconnectedPlayer = room.players[playerIndex]; // Obtenemos el objeto antes de eliminar
                room.players.splice(playerIndex, 1); // Eliminar jugador de la sala
                console.log(`Jugador ${disconnectedPlayer.name} ha dejado la sala ${roomId}.`);
                io.to(roomId).emit('chat message', `[Sistema]: ${disconnectedPlayer.name} ha abandonado la sala.`);

                // Si la sala se queda sin jugadores, o con menos de los necesarios para jugar, la eliminamos/reseteamos
                if (room.players.length === 0) {
                    console.log(`Sala ${roomId} vacía, eliminando.`);
                    delete rooms[roomId];
                } else if (room.status === 'in_game' && room.players.length < (room.type === '1v1' ? 2 : 4)) {
                    // Si el juego estaba en curso y ya no hay suficientes, terminarlo
                    io.to(roomId).emit('gameOver', 'Un jugador se ha desconectado. El juego ha terminado.');
                    console.log(`Juego en sala ${roomId} terminado por desconexión.`);
                    delete rooms[roomId]; // O manejar de otra forma, como dar la victoria al equipo restante
                }
                io.to(roomId).emit('updateRoomPlayers', room.players); // Actualizar lista de jugadores en sala
                break; // El jugador solo puede estar en una sala a la vez
            }
        }
        // Actualizar la lista de jugadores del lobby después de la desconexión
        updateLobbyPlayerList();
    });

    // Solicitar lista de jugadores del lobby (para cuando un nuevo cliente se conecta o cambia de estado)
    socket.on('requestPlayerList', () => {
        updateLobbyPlayerList();
    });
});

// Función para intentar emparejar jugadores
function tryMatchmaking(mode) {
    const requiredPlayers = mode === '1v1' ? 2 : 4;
    // Filtrar a los jugadores que están 'isReady: true' y en la cola correcta
    const availablePlayers = playersInQueue[mode].filter(p => p.isReady);

    if (availablePlayers.length >= requiredPlayers) {
        const newRoomId = uuidv4();
        // CUIDADO: splice modifica el array original, lo cual es lo que queremos.
        const newRoomPlayers = availablePlayers.splice(0, requiredPlayers);

        // Eliminar a los jugadores de la cola principal después de sacarlos
        // Esto es necesario porque `splice` en `availablePlayers` solo afecta a esa vista filtrada,
        // no al array original `playersInQueue[mode]` directamente en todos los casos.
        // Mejor recrear la cola filtrando los que ya fueron sacados.
        playersInQueue[mode] = playersInQueue[mode].filter(p => !newRoomPlayers.some(rp => rp.socketId === p.socketId));


        // Crear la sala
        rooms[newRoomId] = {
            id: newRoomId,
            type: mode,
            players: newRoomPlayers,
            status: 'waiting_for_start',
            turnOrder: [],
            combatLog: [],
        };

        console.log(`Sala ${newRoomId} creada para ${mode} con jugadores:`, newRoomPlayers.map(p => p.name));

        // Unir a los jugadores a la sala de Socket.IO y notificarles
        newRoomPlayers.forEach(p => {
            const playerSocket = io.sockets.sockets.get(p.socketId);
            if (playerSocket) {
                playerSocket.join(newRoomId);
                io.to(p.socketId).emit('joinedRoom', { roomId: newRoomId, roomType: mode, players: newRoomPlayers });
                io.to(newRoomId).emit('chat message', `[Sistema]: ${p.name} ha entrado en la sala.`);
            }
        });

        // Actualizar las colas globales (para quienes siguen en el lobby)
        io.emit('queueUpdate', { '1v1': playersInQueue['1v1'].length, '2v2': playersInQueue['2v2'].length });

        // Actualizar la lista de jugadores de la sala para todos en ella
        io.to(newRoomId).emit('updateRoomPlayers', rooms[newRoomId].players);

        // Aquí se iniciaría la lógica de combate
        console.log(`Sala ${newRoomId} lista para iniciar combate.`);
    }
}

// --- Función para actualizar la lista global de jugadores (Lobby) ---
function updateLobbyPlayerList() {
    const lobbyPlayers = [];
    connectedLobbySockets.forEach((playerObj, socketId) => {
        // Un jugador está en el lobby si no está en una sala y NO está en playersInQueue (ya listos para emparejar)
        let isInRoom = false;
        for (const roomId in rooms) {
            if (rooms[roomId].players.some(p => p.socketId === socketId)) {
                isInRoom = true;
                break;
            }
        }
        let isInReadyQueue = playersInQueue['1v1'].some(p => p.socketId === socketId && p.isReady) ||
                             playersInQueue['2v2'].some(p => p.socketId === socketId && p.isReady);

        // Si no está en una sala y no está listo en una cola, se considera en el lobby
        if (!isInRoom && !isInReadyQueue) {
            lobbyPlayers.push({ socketId: socketId, name: playerObj.name });
        }
        // También incluimos a los jugadores que están en cola pero no listos aún (solo seleccionaron modo/personaje)
        else if (playerObj.mode && !playerObj.isReady && !isInRoom) {
             lobbyPlayers.push({ socketId: socketId, name: playerObj.name });
        }
    });
    io.emit('updatePlayerList', lobbyPlayers);
}

// --- RUTA PRINCIPAL ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Iniciar Servidor ---
server.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});