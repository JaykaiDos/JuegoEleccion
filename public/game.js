const socket = io();

// --- Elementos del DOM del Juego ---
const characterCreationScreen = document.getElementById('character-creation');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('playerName');
const playerClassSelect = document.getElementById('playerClass');
const playerBackgroundSelect = document.getElementById('playerBackground');
const createCharacterBtn = document.getElementById('createCharacterBtn');
const playersList = document.getElementById('playersList');
const storyText = document.getElementById('storyText');
const choicesContainer = document.getElementById('choices-container');
const votingStatus = document.getElementById('voting-status'); // Para mostrar el estado de la votación

// --- Elementos del DOM del Chat ---
const messagesContainer = document.getElementById('messages'); // Contenedor de mensajes
const chatInput = document.getElementById('m');             // Input para escribir mensaje
const sendChatButton = document.getElementById('send-chat'); // Botón de enviar chat

let hasVotedInCurrentRound = false; // Bandera para controlar el voto del cliente

// --- Lógica de Creación de Personaje ---
createCharacterBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const playerClass = playerClassSelect.value;
    const background = playerBackgroundSelect.value;

    if (name && playerClass && background) {
        socket.emit('createCharacter', { name, class: playerClass, background });
    } else {
        alert('Por favor, completa todos los campos para crear tu personaje.');
    }
});

socket.on('characterCreated', (success) => {
    if (success) {
        characterCreationScreen.classList.remove('active');
        gameScreen.classList.add('active');
        // Solicitar el estado actual de la historia y lista de jugadores al unirse
        socket.emit('requestCurrentStory');
        socket.emit('requestPlayers');
    } else {
        alert('Hubo un error al crear tu personaje. Intenta de nuevo.');
    }
});

// --- Lógica de la Lista de Jugadores ---
socket.on('updatePlayerList', (players) => {
    playersList.innerHTML = ''; // Limpiar la lista existente
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.name} (${player.class}, ${player.background})`;
        playersList.appendChild(li);
    });
});

socket.on('playerJoined', (player) => {
    console.log(`Jugador ${player.name} se ha unido.`);
    // La lista se actualizará con 'updatePlayerList' que se emite a todos.
});

socket.on('playerLeft', (playerId) => {
    console.log(`Jugador con ID ${playerId} ha dejado la partida.`);
    // La lista se actualizará con 'updatePlayerList' que se emite a todos.
});

// --- Lógica del Juego (Historia y Votación) ---
socket.on('gameState', (data) => {
    updateStoryDisplay(data.story);
    if (data.story.choices.length > 0 && data.votingActive) {
        startVotingDisplay();
    } else if (data.story.choices.length === 0) {
        endGameDisplay(data.story.text);
    }
});

socket.on('storyUpdate', (storyNode) => {
    updateStoryDisplay(storyNode);
    if (storyNode.choices.length > 0) {
        startVotingDisplay();
    } else {
        endGameDisplay(storyNode.text);
    }
});

socket.on('startVoting', () => {
    startVotingDisplay();
});

socket.on('voteUpdate', (votes) => {
    updateVoteCountsDisplay(votes);
});

socket.on('gameEnd', (message) => {
    endGameDisplay(message);
});

function updateStoryDisplay(storyNode) {
    storyText.textContent = storyNode.text;
    choicesContainer.innerHTML = ''; // Limpiar opciones anteriores
    storyNode.choices.forEach(choice => {
        const button = document.createElement('button');
        button.textContent = choice.text;
        button.dataset.choiceId = choice.id; // Almacenar el ID de la elección
        button.addEventListener('click', () => {
            if (!hasVotedInCurrentRound) {
                socket.emit('vote', choice.id);
                hasVotedInCurrentRound = true;
                disableChoicesButtons(); // Deshabilitar botones después de votar
                votingStatus.textContent = '¡Gracias por tu voto! Esperando a los demás jugadores...';
            }
        });
        choicesContainer.appendChild(button);
    });
    hasVotedInCurrentRound = false; // Resetear la bandera para la nueva historia
    enableChoicesButtons(); // Asegurarse de que los botones estén activos para la nueva historia
    votingStatus.textContent = ''; // Limpiar mensaje de estado de votación
}

function startVotingDisplay() {
    // Si la votación está activa, aseguramos que los botones estén habilitados
    if (choicesContainer.children.length > 0) {
        enableChoicesButtons();
        votingStatus.textContent = '¡La votación está abierta! Haz tu elección.';
    }
}

function updateVoteCountsDisplay(votes) {
    // Esto es más un log de consola por ahora. Puedes mejorar la UI si quieres.
    console.log('Votos actuales:', votes);
    // Puedes añadir lógica aquí para mostrar los votos en la interfaz si lo deseas,
    // por ejemplo, debajo de cada botón de opción, o en una sección de "Votos Actuales"
    let voteSummary = "Votos Actuales:\n";
    const currentStoryNode = game.story[game.currentStoryIndex]; // OJO: 'game' no existe en el cliente.
    // Necesitarías que el servidor te envíe el conteo específico por opción, no solo los votos brutos.
    // Por ahora, solo muestra "X personas han votado"
    voteSummary += `${Object.keys(votes).length} jugadores han votado.`;

    // Si quieres mostrar por opción, el servidor debería enviar algo como:
    // { "left": 5, "right": 3 }
    // Aquí el servidor solo envía un objeto de votos de jugador a opción ID: { socketId1: "left", socketId2: "right" }
    // Para mostrar conteo por opción, tendrías que procesar el objeto 'votes' aquí en el cliente
    // o hacer que el servidor envíe el conteo ya agregado.

    // Por simplicidad, por ahora solo mostraremos quién votó en la consola del cliente o un mensaje simple
    // para el usuario que votó.
}


function disableChoicesButtons() {
    Array.from(choicesContainer.children).forEach(button => {
        button.disabled = true;
    });
}

function enableChoicesButtons() {
    Array.from(choicesContainer.children).forEach(button => {
        button.disabled = false;
    });
}

function endGameDisplay(message) {
    storyText.textContent = message;
    choicesContainer.innerHTML = '';
    votingStatus.textContent = 'Fin del juego.';
    disableChoicesButtons();
}


// --- Lógica del Chat ---

// Evento para enviar mensaje al hacer clic en el botón
sendChatButton.addEventListener('click', () => {
    sendMessage();
});

// Evento para enviar mensaje al presionar Enter en el input del chat
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const message = chatInput.value.trim(); // .trim() para quitar espacios al inicio/final
    if (message) {
        socket.emit('chat message', message); // Emitir el mensaje al servidor
        chatInput.value = ''; // Limpiar el input después de enviar
    }
}

// Escuchar los mensajes de chat que vienen del servidor
socket.on('chat message', (msg) => {
    const item = document.createElement('div');
    item.textContent = msg; // El mensaje ya incluye el nombre del remitente
    messagesContainer.appendChild(item);
    // Opcional: Asegurarse de que el chat siempre haga scroll al último mensaje
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});