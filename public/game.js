// public/game.js

// Conectar al servidor Socket.IO
const socket = io();

// Referencias a elementos del DOM
const characterCreationScreen = document.getElementById('character-creation');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('playerName');
const playerClassSelect = document.getElementById('playerClass');
const playerBackgroundSelect = document.getElementById('playerBackground');
const createCharacterBtn = document.getElementById('createCharacterBtn');
const creationMessage = document.getElementById('creationMessage');

const connectedPlayersList = document.getElementById('connectedPlayers');
const voteCountsDisplay = document.getElementById('vote-counts');
const currentStoryDisplay = document.getElementById('currentStory');
const choicesContainer = document.getElementById('choices-container');
const voteMessage = document.getElementById('vote-message');

let characterCreated = false; // Bandera para saber si el personaje ya fue creado
let myPlayerId = null; // Para almacenar el ID de socket de este cliente

// --- Funciones de UI ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function updatePlayerList(players) {
    connectedPlayersList.innerHTML = '';
    if (players && players.length > 0) {
        players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.name} (${player.class}, ${player.background})`;
            connectedPlayersList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'No hay otros jugadores conectados.';
        connectedPlayersList.appendChild(li);
    }
}

function displayStory(storyNode) {
    currentStoryDisplay.textContent = storyNode.text;
    choicesContainer.innerHTML = ''; // Limpiar opciones anteriores
    voteMessage.textContent = ''; // Limpiar mensaje de voto
    voteCountsDisplay.innerHTML = ''; // Limpiar conteo de votos anterior

    if (storyNode.choices && storyNode.choices.length > 0) {
        storyNode.choices.forEach(choice => {
            const button = document.createElement('button');
            button.classList.add('choice-button');
            button.textContent = choice.text;
            button.dataset.choiceId = choice.id; // Almacenar el ID de la elección
            button.addEventListener('click', () => sendVote(choice.id));
            choicesContainer.appendChild(button);
        });
        enableVotingButtons(false); // Deshabilitar botones por defecto hasta que el servidor active la votación
    } else {
        // No hay opciones, probablemente es el fin de un camino
        const p = document.createElement('p');
        p.textContent = "¡Este camino ha llegado a su fin! Espera a que los demás terminen o reinicia el juego.";
        choicesContainer.appendChild(p);
        enableVotingButtons(false);
    }
}

function enableVotingButtons(enable) {
    document.querySelectorAll('.choice-button').forEach(button => {
        button.disabled = !enable;
    });
    if (enable) {
        voteMessage.textContent = "¡Vota por tu elección!";
        voteMessage.style.color = '#e5c07b';
    } else {
        // Solo si la votación no está activa, mostramos "Esperando..."
        // Si ya votamos, el mensaje de "Has votado..." se mantendrá
        if (!voteMessage.textContent.startsWith("Has votado")) {
            voteMessage.textContent = "Esperando que todos voten o que la historia avance...";
            voteMessage.style.color = '#e5c07b';
        }
    }
}

function updateVoteCounts(votes) {
    voteCountsDisplay.innerHTML = '<h4>Votos Actuales:</h4>';
    const currentStoryChoices = Array.from(choicesContainer.children).map(btn => ({
        id: btn.dataset.choiceId,
        text: btn.textContent
    }));

    // Contar los votos recibidos por cada opción
    const counts = {};
    for (const voterId in votes) {
        const choiceId = votes[voterId];
        counts[choiceId] = (counts[choiceId] || 0) + 1;
    }

    currentStoryChoices.forEach(choice => {
        const count = counts[choice.id] || 0;
        const div = document.createElement('div');
        div.textContent = `${choice.text}: ${count} votos`;
        voteCountsDisplay.appendChild(div);
    });
}


// --- Lógica del Juego ---
createCharacterBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const playerClass = playerClassSelect.value;
    const playerBackground = playerBackgroundSelect.value;

    if (name && playerClass && playerBackground) {
        socket.emit('createCharacter', { name, class: playerClass, background: playerBackground });
        creationMessage.textContent = "Enviando personaje...";
        creationMessage.style.color = '#e5c07b';
        createCharacterBtn.disabled = true; // Deshabilitar para evitar múltiples envíos
        playerNameInput.disabled = true;
        playerClassSelect.disabled = true;
        playerBackgroundSelect.disabled = true;
    } else {
        creationMessage.textContent = "Por favor, completa todos los campos.";
        creationMessage.style.color = 'red';
    }
});

function sendVote(choiceId) {
    if (!characterCreated) {
        voteMessage.textContent = "Primero crea tu personaje.";
        voteMessage.style.color = 'red';
        return;
    }
    enableVotingButtons(false); // Deshabilitar botones después de votar
    voteMessage.textContent = `Has votado por: ${event.target.textContent}. Esperando a los demás...`;
    voteMessage.style.color = '#e5c07b'; // Resetear color
    socket.emit('vote', choiceId);
}

// --- Eventos de Socket.IO ---
socket.on('connect', () => {
    console.log('Conectado al servidor Socket.IO');
    myPlayerId = socket.id; // Guarda tu propio ID de socket
    // Al reconectar, si ya creaste un personaje, intenta enviarlo de nuevo
    if (characterCreated && playerNameInput.value.trim() && playerClassSelect.value && playerBackgroundSelect.value) {
        console.log('Re-enviando datos de personaje al servidor.');
        socket.emit('createCharacter', {
            name: playerNameInput.value.trim(),
            class: playerClassSelect.value,
            background: playerBackgroundSelect.value
        });
    }
    // Siempre pedimos el estado de la historia al conectar/reconectar
    socket.emit('requestCurrentStory');
});

// Recibir el estado inicial del juego al conectar (o al reconectar)
socket.on('gameState', (data) => {
    console.log('Estado inicial del juego recibido:', data);
    updatePlayerList(data.players); // Actualizar la lista de jugadores inicial

    // Si el personaje ya está creado, muestra la pantalla de juego
    // y la historia actual. Si no, muestra la de creación.
    if (characterCreated) {
        showScreen('game-screen');
        displayStory(data.story);
    } else {
        showScreen('character-creation');
    }
});

socket.on('characterCreated', (success) => {
    if (success) {
        characterCreated = true;
        creationMessage.textContent = "¡Personaje creado con éxito! Esperando que la historia comience...";
        creationMessage.style.color = '#98c379';
        showScreen('game-screen');
        // El servidor ya debería haber enviado el gameState o storyUpdate
        // Pero si no, podemos asegurarnos de pedir la historia actual
        socket.emit('requestCurrentStory');
    } else {
        creationMessage.textContent = "Error al crear personaje. Inténtalo de nuevo.";
        creationMessage.style.color = 'red';
        createCharacterBtn.disabled = false;
        playerNameInput.disabled = false;
        playerClassSelect.disabled = false;
        playerBackgroundSelect.disabled = false;
    }
});

// Cuando un nuevo jugador se une (notificación para todos los clientes)
socket.on('playerJoined', (player) => {
    console.log('Nuevo jugador conectado:', player.name);
    // No necesitamos pedir la lista completa aquí, el servidor la envía con 'updatePlayerList'
});

// Cuando un jugador se desconecta (notificación para todos los clientes)
socket.on('playerLeft', (playerId) => {
    console.log('Jugador desconectado:', playerId);
    // No necesitamos pedir la lista completa aquí, el servidor la envía con 'updatePlayerList'
});

// Recibir la lista actualizada de jugadores del servidor
socket.on('updatePlayerList', (players) => {
    updatePlayerList(players);
});

// Recibir actualizaciones de la historia del servidor
socket.on('storyUpdate', (storyNode) => {
    console.log('Nueva historia recibida:', storyNode);
    displayStory(storyNode);
    // Cuando llega una nueva historia, se habilita la votación si hay opciones
    if (storyNode.choices && storyNode.choices.length > 0) {
        enableVotingButtons(true);
        voteMessage.textContent = "¡Vota por tu elección!";
    } else {
        voteMessage.textContent = "Fin de este camino.";
        enableVotingButtons(false);
    }
    voteCountsDisplay.innerHTML = ''; // Limpiar votos de la ronda anterior
});

// Evento para activar la votación (por ejemplo, si el juego espera a que más jugadores se unan)
socket.on('startVoting', () => {
    console.log("Votación activada por el servidor.");
    enableVotingButtons(true);
    voteMessage.textContent = "¡Vota por tu elección!";
    voteMessage.style.color = '#98c379'; // Verde para indicar votación activa
});

// Evento para recibir actualizaciones en tiempo real de los votos
socket.on('voteUpdate', (votes) => {
    console.log('Votos actualizados:', votes);
    updateVoteCounts(votes);
    // Mostrar mensaje específico si yo ya voté
    if (votes[myPlayerId]) {
        const votedChoiceText = Array.from(choicesContainer.children).find(btn => btn.dataset.choiceId === votes[myPlayerId])?.textContent;
        voteMessage.textContent = `Has votado por: ${votedChoiceText || 'tu elección'}. Esperando a los demás...`;
        voteMessage.style.color = '#e5c07b';
        enableVotingButtons(false); // Asegúrate de que los botones estén deshabilitados después de mi voto
    }
});

socket.on('gameEnd', (message) => {
    currentStoryDisplay.textContent = message;
    choicesContainer.innerHTML = '';
    voteMessage.textContent = "¡La partida ha terminado!";
    voteMessage.style.color = '#e5c07b';
    enableVotingButtons(false);
    voteCountsDisplay.innerHTML = ''; // Limpiar conteo de votos
    // Opcional: mostrar un botón para reiniciar la partida o volver a la creación de personaje
});