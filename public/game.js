// public/game.js

const socket = io();

// --- Elementos del DOM ---
const startScreen = document.getElementById('start-screen');
const mode1v1Button = document.getElementById('mode-1v1');
const mode2v2Button = document.getElementById('mode-2v2');
const queue1v1Count = document.getElementById('queue-1v1-count');
const queue2v2Count = document.getElementById('queue-2v2-count');

const characterSelectionScreen = document.getElementById('character-selection-screen');
const charactersContainer = document.getElementById('characters-container');
const confirmCharacterSelectionButton = document.getElementById('confirm-character-selection');

// Elementos del DOM para la pantalla de ingreso de nombre (NUEVO)
const nameInputScreen = document.getElementById('name-input-screen');
const selectedCharacterDisplay = document.getElementById('selected-character-display');
const playerNameInput = document.getElementById('player-name-input');
const confirmNameButton = document.getElementById('confirm-name-button');

const waitingRoomScreen = document.getElementById('waiting-room-screen');
const waitingRoomModeSpan = document.getElementById('waiting-room-mode');
const waitingPlayersList = document.getElementById('waiting-players-list');

const combatScreen = document.getElementById('combat-screen');
const myCharacterNameDisplay = document.getElementById('my-character-name');
const myCharacterHpDisplay = document.getElementById('my-character-hp');
const combatLog = document.getElementById('combat-log');
const actionButtons = document.getElementById('action-buttons');

const chatContainer = document.getElementById('chat-container');
const messages = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('m');

const playerListContainer = document.getElementById('player-list-container');
const playerList = document.getElementById('player-list');


let selectedCharacterId = null;
let myPlayerInfo = null; // Almacenará la información de nuestro propio jugador (incluido el nombre)

// --- Funciones de Utilidad ---
function showScreen(screenElement) {
    const screens = [
        startScreen,
        characterSelectionScreen,
        nameInputScreen, // ¡Añadida!
        waitingRoomScreen,
        combatScreen
    ]; // Sólo las pantallas principales de flujo

    screens.forEach(screen => {
        if (screen.classList.contains('game-section')) {
            screen.classList.add('hidden');
        }
    });

    screenElement.classList.remove('hidden');

    // Mantenemos el chat y la lista de jugadores siempre visibles
    playerListContainer.classList.remove('hidden');
    chatContainer.classList.remove('hidden');
}

// Función para habilitar/deshabilitar botón con estilos
function setButtonEnabled(button, isEnabled) {
    button.disabled = !isEnabled;
    if (isEnabled) {
        button.classList.remove('disabled-button');
    } else {
        button.classList.add('disabled-button');
    }
}

// --- Eventos de Selección de Modo de Juego ---
mode1v1Button.addEventListener('click', () => {
    socket.emit('selectMode', '1v1');
    showScreen(characterSelectionScreen);
});

mode2v2Button.addEventListener('click', () => {
    socket.emit('selectMode', '2v2');
    showScreen(characterSelectionScreen);
});

// --- Lógica de Selección de Personaje ---
socket.on('charactersData', (characters) => { // Renombrado de 'characterList' a 'charactersData' para claridad
    charactersContainer.innerHTML = '';
    for (const charId in characters) {
        const char = characters[charId];
        const charCard = document.createElement('div');
        charCard.classList.add('character-card');
        charCard.dataset.characterId = char.id;
        charCard.innerHTML = `
            <h3>${char.name} (${char.race})</h3>
            <p>Clase: ${char.class}</p>
            <p>HP: ${char.initialHp}</p>
            <p>Ataque: ${char.baseAttack}</p>
            <h4>Habilidades:</h4>
            <ul>
                ${char.abilities.map(ability => `<li><strong>${ability.name}</strong>: ${ability.description}</li>`).join('')}
            </ul>
        `;
        charCard.addEventListener('click', () => {
            // Remover la selección de las otras tarjetas
            document.querySelectorAll('.character-card').forEach(card => {
                card.classList.remove('selected');
            });
            // Seleccionar esta tarjeta
            charCard.classList.add('selected');
            selectedCharacterId = char.id;
            setButtonEnabled(confirmCharacterSelectionButton, true);
        });
        charactersContainer.appendChild(charCard);
    }
});

confirmCharacterSelectionButton.addEventListener('click', () => {
    if (selectedCharacterId) {
        socket.emit('characterSelected', selectedCharacterId); // Ahora este evento solo indica la selección del personaje
        setButtonEnabled(confirmCharacterSelectionButton, false);
        confirmCharacterSelectionButton.textContent = 'Seleccionado...';
    }
});

// --- Lógica para la pantalla de ingreso de nombre (NUEVO) ---
playerNameInput.addEventListener('input', () => {
    // Habilitar botón si hay texto y no es solo espacios
    if (playerNameInput.value.trim().length > 0) {
        setButtonEnabled(confirmNameButton, true);
    } else {
        setButtonEnabled(confirmNameButton, false);
    }
});

confirmNameButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    if (playerName) {
        // Enviamos el nombre del jugador junto con el personaje seleccionado al servidor
        socket.emit('playerReadyForMatchmaking', {
            characterId: selectedCharacterId,
            playerName: playerName
        });
        setButtonEnabled(confirmNameButton, false); // Deshabilitar para evitar múltiples envíos
        confirmNameButton.textContent = 'Uniendo...';
    }
});

// --- Eventos de Socket.IO ---

// Actualiza el contador de jugadores en cola
socket.on('queueUpdate', (counts) => {
    queue1v1Count.textContent = counts['1v1'];
    queue2v2Count.textContent = counts['2v2'];
});

// Cuando el servidor confirma la selección del personaje (para mostrar la pantalla de nombre)
socket.on('characterSelected', (playerInfo) => { // playerInfo ahora solo tiene charData, socketId y mode
    myPlayerInfo = playerInfo; // Guardamos la info temporal del personaje seleccionado
    selectedCharacterDisplay.textContent = myPlayerInfo.characterData.name; // Mostrar el personaje seleccionado en la pantalla de nombre
    showScreen(nameInputScreen); // Mostrar la pantalla de ingreso de nombre
    playerNameInput.value = ''; // Limpiar input por si acaso
    setButtonEnabled(confirmNameButton, false);
    confirmNameButton.textContent = 'Entrar a la Sala';
    console.log('Mi personaje seleccionado (temporal):', myPlayerInfo);
});


// Cuando el servidor envía a la sala de espera (después de ingresar el nombre y estar listo para matchmaking)
socket.on('showWaitingRoom', (data) => { // 'data' ahora debería contener {mode, playerInfo (completo)}
    waitingRoomModeSpan.textContent = data.mode;
    // Si el chat tiene un título específico para el lobby, lo ajustaríamos aquí
    chatContainer.querySelector('h2').textContent = `Chat de la Sala de Espera (${data.mode})`;
    showScreen(waitingRoomScreen);

    // Si ya tenemos el objeto completo de myPlayerInfo con el nombre, lo actualizamos
    if (data.playerInfo) {
        myPlayerInfo = data.playerInfo;
        console.log('Mi información completa en sala de espera:', myPlayerInfo);
    }
});

// Unirse a una sala específica de combate
socket.on('joinedRoom', (data) => {
    console.log(`Unido a la sala ${data.roomId} de tipo ${data.roomType}`);
    // Actualizar myPlayerInfo con los datos completos de la sala
    myPlayerInfo = data.players.find(p => p.socketId === socket.id);
    showScreen(combatScreen); // Muestra la pantalla de combate
    if (myPlayerInfo) { // Asegurarse de que myPlayerInfo esté disponible
        myCharacterNameDisplay.textContent = myPlayerInfo.name; // Usar el nombre del jugador
        myCharacterHpDisplay.textContent = `${myPlayerInfo.currentHp} / ${myPlayerInfo.maxHp}`;
    }
    chatContainer.querySelector('h2').textContent = `Chat de la Sala de Combate (${data.roomType})`;
});

// Actualizar la lista de jugadores dentro de la sala de combate
socket.on('updateRoomPlayers', (players) => {
    waitingPlayersList.innerHTML = '';
    players.forEach(p => {
        const listItem = document.createElement('li');
        listItem.textContent = `${p.name} (${p.characterData.name}) - HP: ${p.currentHp}/${p.maxHp}`;
        if (p.socketId === socket.id) {
            listItem.style.fontWeight = 'bold'; // Resaltar a nuestro propio jugador
        }
        waitingPlayersList.appendChild(listItem);
    });
});

// Actualizar la lista global de jugadores (lobby)
socket.on('updatePlayerList', (players) => {
    playerList.innerHTML = '';
    if (players.length === 0) {
        const listItem = document.createElement('li');
        listItem.textContent = "No hay jugadores conectados en el lobby.";
        playerList.appendChild(listItem);
    } else {
        players.forEach(player => {
            const listItem = document.createElement('li');
            listItem.textContent = player.name; // Usar el nombre directamente
            playerList.appendChild(listItem);
        });
    }
});

// Manejo de mensajes de chat
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (messageInput.value) {
        socket.emit('chat message', messageInput.value);
        messageInput.value = '';
    }
});

socket.on('chat message', (msg) => {
    const item = document.createElement('div'); // Cambiado a div para mayor flexibilidad
    item.textContent = msg;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
});


// --- Gestión de Visibilidad de Pantallas al inicio ---
document.addEventListener('DOMContentLoaded', () => {
    showScreen(startScreen);
    socket.emit('requestPlayerList'); // Solicita la lista de jugadores al conectar
});