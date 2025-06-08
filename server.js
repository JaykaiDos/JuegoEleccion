// server.js

// Importar las librerías necesarias
const express = require('express');
const http = require('http'); // Módulo HTTP de Node.js para crear el servidor
const socketIo = require('socket.io'); // Librería Socket.IO

// Inicializar Express
const app = express();
const server = http.createServer(app); // Creamos un servidor HTTP usando Express
const io = new socketIo.Server(server); // Conectamos Socket.IO al servidor HTTP

// --- Datos del Juego ---
const game = {
    players: {}, // Objeto para almacenar información de los jugadores conectados (socket.id: {name: '...', character: {...}})
    story: [
        {
            text: "Te despiertas en un bosque denso, sin recordar cómo llegaste allí. Un camino se abre a tu izquierda, otro a tu derecha.",
            choices: [
                { id: "left", text: "Tomar el sendero cubierto de musgo a la izquierda." },
                { id: "right", text: "Seguir el camino de tierra a la derecha." }
            ],
            votes: {} // Para almacenar los votos de la elección actual
        },
        {
            text: "El sendero de musgo te lleva a un río caudaloso. ¿Intentas cruzarlo a nado o buscas un puente?",
            choices: [
                { id: "cross_river", text: "Intentar cruzar el río nadando." },
                { id: "find_path", text: "Buscar un camino alternativo o un puente." }
            ],
            votes: {}
        },
        {
            text: "El camino de tierra te conduce a la entrada de una cueva oscura. ¿Entras a la cueva o la rodeas?",
            choices: [
                { id: "enter_cave", text: "Entrar en la cueva, linterna en mano." },
                { id: "go_around_cave", text: "Rodear la cueva, buscando un paso seguro." }
            ],
            votes: {}
        },
        {
            text: "Cruzas el río con gran dificultad, pero logras llegar a la otra orilla, exhausto. A lo lejos, ves las luces de un pueblo. ¡Éxito en este camino! Fin del juego.",
            choices: [], // No más opciones por ahora para este camino
            votes: {}
        },
        {
            text: "Después de un tiempo buscando, encuentras un antiguo puente de piedra más adelante y lo cruzas con seguridad. Descubres una ruina antigua y misteriosa. ¡Éxito en este camino! Fin del juego.",
            choices: [],
            votes: {}
        },
        {
            text: "Entras a la cueva. Es fría, oscura y húmeda, pero al final de un pasadizo estrecho, encuentras un cofre antiguo con un tesoro. ¡Éxito en este camino! Fin del juego.",
            choices: [],
            votes: {}
        },
        {
            text: "Rodeas la cueva con cautela, evitando cualquier peligro. Descubres un valle fértil y lleno de vida silvestre, un lugar de paz. ¡Éxito en este camino! Fin del juego.",
            choices: [],
            votes: {}
        }
    ],
    currentStoryIndex: 0, // Índice de la parte de la historia actual
    votingActive: false, // Indica si hay una votación en curso
    // Mapeo de IDs de elección a índices de historia siguientes
    nextStoryMap: {
        "left": 1,
        "right": 2,
        "cross_river": 3,
        "find_path": 4,
        "enter_cave": 5,
        "go_around_cave": 6
    }
};

// --- Configuración de Express para servir archivos estáticos ---
// 'public' será la carpeta donde pondremos nuestro HTML, CSS y JavaScript del cliente.
app.use(express.static('public'));

// Ruta principal que sirve el archivo index.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// --- Lógica de Socket.IO ---
io.on('connection', (socket) => {
    console.log(`Un usuario se ha conectado: ${socket.id}`);

    // Cuando un nuevo jugador se conecta, le enviamos el estado actual del juego
    socket.emit('gameState', {
        story: game.story[game.currentStoryIndex],
        players: Object.values(game.players) // Enviamos solo los valores de los jugadores
    });

    // Evento para recibir los datos de creación de personaje
    socket.on('createCharacter', (characterData) => {
        game.players[socket.id] = {
            id: socket.id,
            name: characterData.name,
            class: characterData.class,
            background: characterData.background
        };
        console.log(`Jugador ${characterData.name} (${socket.id}) ha creado su personaje.`);
        // Notificar a todos los clientes sobre el nuevo jugador
        io.emit('playerJoined', game.players[socket.id]); // Envia el nuevo jugador para que los clientes actualicen su lista
        io.emit('updatePlayerList', Object.values(game.players)); // Envía la lista completa actualizada

        socket.emit('characterCreated', true); // Confirmamos que el personaje fue creado

        // Si es el primer jugador o el juego está en el inicio y hay al menos 1 jugador, activa la votación inicial
        if (Object.keys(game.players).length >= 1 && game.currentStoryIndex === 0 && !game.votingActive) {
            game.votingActive = true;
            io.emit('startVoting'); // Notificar a los clientes que la votación ha comenzado
            console.log("Votación inicial activada por primer jugador.");
        }
    });

    // Evento para recibir un voto de un jugador
    socket.on('vote', (choiceId) => {
        if (!game.votingActive) {
            console.log(`Voto de ${socket.id} ignorado, no hay votación activa.`);
            return;
        }
        if (!game.players[socket.id]) {
            console.log(`Voto de un usuario no registrado como jugador: ${socket.id}`);
            return;
        }

        const currentStoryNode = game.story[game.currentStoryIndex];
        const choiceExists = currentStoryNode.choices.some(choice => choice.id === choiceId);

        if (choiceExists) {
            currentStoryNode.votes[socket.id] = choiceId; // Registramos el voto del jugador
            console.log(`Voto recibido de ${game.players[socket.id].name}: ${choiceId}`);

            // Enviar el estado de los votos a todos los clientes para que actualicen sus UIs
            io.emit('voteUpdate', currentStoryNode.votes);

            // Verificar si todos han votado
            const connectedPlayerCount = Object.keys(game.players).length;
            const votedPlayerCount = Object.keys(currentStoryNode.votes).length;

            if (connectedPlayerCount > 0 && votedPlayerCount === connectedPlayerCount) {
                // Todos han votado, procesar el resultado
                processVotes();
            }
        } else {
            console.log(`Voto inválido de ${game.players[socket.id].name}: ${choiceId}`);
        }
    });

    // Evento para que el servidor envíe la lista actualizada de jugadores cuando un cliente la solicite
    socket.on('requestPlayers', () => {
        io.emit('updatePlayerList', Object.values(game.players));
    });

    // Evento para que el servidor envíe el estado actual de la historia cuando un cliente lo pida (ej. al reconectar)
    socket.on('requestCurrentStory', () => {
        socket.emit('storyUpdate', game.story[game.currentStoryIndex]);
        if (game.story[game.currentStoryIndex].choices.length > 0 && game.votingActive) {
            socket.emit('startVoting');
        }
        // También envía el conteo de votos actual para una UI de votación si está activa
        if (game.votingActive) {
            socket.emit('voteUpdate', game.story[game.currentStoryIndex].votes);
        }
    });

    // --- Manejo de eventos del chat ---
    socket.on('chat message', (msg) => {
        // Obtenemos el nombre del jugador si ya lo ha configurado, o usamos un ID por defecto
        const senderName = game.players[socket.id] ? game.players[socket.id].name : `Usuario ${socket.id.substring(0, 4)}`;
        const fullMessage = `[${senderName}]: ${msg}`; // Mensaje con nombre del remitente
        console.log(`Mensaje de chat de ${senderName}: ${msg}`);
        // Retransmitir el mensaje a todos los clientes conectados
        io.emit('chat message', fullMessage);
    });
    // --- Fin Manejo de eventos del chat ---

    // Evento cuando un jugador se desconecta
    socket.on('disconnect', () => {
        console.log(`Un usuario se ha desconectado: ${socket.id}`);
        const disconnectedPlayer = game.players[socket.id];
        if (disconnectedPlayer) {
            delete game.players[socket.id];
            // Si el jugador tenía un voto, lo removemos
            if (game.story[game.currentStoryIndex] && game.story[game.currentStoryIndex].votes[socket.id]) {
                delete game.story[game.currentStoryIndex].votes[socket.id];
            }
            io.emit('playerLeft', socket.id); // Notificar a los clientes que un jugador se fue
            io.emit('updatePlayerList', Object.values(game.players)); // Envía la lista completa actualizada
            console.log(`Jugador ${disconnectedPlayer.name} ha dejado el juego.`);

            // Si la votación estaba activa y ahora faltan jugadores para el quorum
            const connectedPlayerCount = Object.keys(game.players).length;
            const votedPlayerCount = Object.keys(game.story[game.currentStoryIndex].votes).length;
            if (game.votingActive && connectedPlayerCount > 0 && votedPlayerCount === connectedPlayerCount) {
                 processVotes(); // Volver a verificar y procesar votos si todos los que quedan votaron
            } else if (connectedPlayerCount === 0) {
                 // Si no quedan jugadores, reiniciar la votación para la próxima vez
                 game.votingActive = false;
                 console.log("Todos los jugadores se han desconectado. Votación desactivada.");
            }
        }
    });
});

// Función para procesar los votos y avanzar la historia
function processVotes() {
    game.votingActive = false; // Desactivar la votación hasta la próxima ronda
    const currentStoryNode = game.story[game.currentStoryIndex];
    const votes = currentStoryNode.votes;

    // Si no hay votos válidos, no hacemos nada o tomamos una decisión por defecto
    if (Object.keys(votes).length === 0) {
        console.log("No se recibieron votos. La historia se detiene o toma una opción por defecto.");
        io.emit('storyUpdate', {
            text: "Nadie votó o no hay suficientes jugadores. La historia se detiene aquí.",
            choices: []
        });
        io.emit('gameEnd', "La partida se detuvo por falta de votos.");
        return;
    }

    // Contar los votos
    const voteCounts = {};
    for (const playerId in votes) {
        const choice = votes[playerId];
        voteCounts[choice] = (voteCounts[choice] || 0) + 1;
    }

    // Determinar la opción ganadora (la que tenga más votos)
    let winningChoiceId = null;
    let maxVotes = -1;
    let tiedChoices = []; // Para manejar empates

    for (const choiceId in voteCounts) {
        if (voteCounts[choiceId] > maxVotes) {
            maxVotes = voteCounts[choiceId];
            winningChoiceId = choiceId;
            tiedChoices = [choiceId]; // Reiniciar si encontramos un nuevo máximo
        } else if (voteCounts[choiceId] === maxVotes) {
            tiedChoices.push(choiceId); // Añadir a la lista de empates
        }
    }

    // Manejar empates (elegir el primero en caso de empate, o podrías hacer otra lógica)
    if (tiedChoices.length > 1) {
        console.log(`Empate entre las opciones: ${tiedChoices.join(', ')}. Eligiendo la primera.`);
        winningChoiceId = tiedChoices[0]; // O podrías implementar un desempate aleatorio
    }

    console.log(`Votación finalizada. Opción ganadora: ${winningChoiceId} con ${maxVotes} votos.`);

    // Encontrar el índice de la siguiente parte de la historia
    const nextStoryIndex = game.nextStoryMap[winningChoiceId];
    if (typeof nextStoryIndex === 'number' && game.story[nextStoryIndex]) {
        game.currentStoryIndex = nextStoryIndex;
        // Reiniciar votos para la próxima ronda
        game.story[game.currentStoryIndex].votes = {}; // Importante para la próxima votación

        io.emit('storyUpdate', game.story[game.currentStoryIndex]); // Enviar la nueva parte de la historia a todos
        console.log("Historia avanzada a:", game.story[game.currentStoryIndex].text);

        // Si hay opciones en el nuevo nodo de historia, activar la votación
        if (game.story[game.currentStoryIndex].choices.length > 0) {
            game.votingActive = true;
            io.emit('startVoting'); // Notificar a los clientes que la votación ha comenzado
            console.log("Votación activada para el nuevo segmento de historia.");
        } else {
            console.log("Fin del camino para esta historia.");
            io.emit('gameEnd', "¡Felicidades, la historia ha llegado a su fin en este camino!"); // Mensaje de fin de juego
        }

    } else {
        console.error(`Error: No se encontró la siguiente parte de la historia para la elección ${winningChoiceId}.`);
        io.emit('storyUpdate', { text: "Algo salió mal y la historia se detuvo. Por favor, reinicia el juego.", choices: [] });
        io.emit('gameEnd', "La partida se detuvo por un error interno.");
    }
}

// Escuchar en un puerto específico
const PORT = process.env.PORT || 3000; // Usa el puerto de Heroku si está disponible, sino 3000
server.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});