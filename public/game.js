const socket = io();

// Personajes definidos para selección y estado
const characters = [
    {
        id: 'warrior',
        name: 'Deimos',
        initialHp: 100,
        baseAttack: 15,
        abilities: [
            { id: 'slash', name: 'Golpe de rata' },
            { id: 'bash', name: 'Gran golpe de rata' },
        ],
    },
    {
        id: 'mage',
        name: 'Chris',
        initialHp: 80,
        baseAttack: 20,
        abilities: [
            { id: 'fireball', name: 'Fekear' },
            { id: 'icebolt', name: 'Simpear' },
        ],
    }
];

// --- Elementos DOM ---
const nameInputScreen = document.getElementById('name-input-screen');
const playerNameInput = document.getElementById('player-name-input');
const confirmNameButton = document.getElementById('confirm-name-button');

const startScreen = document.getElementById('start-screen');
const mode1v1Btn = document.getElementById('mode-1v1');

const characterSelectionScreen = document.getElementById('character-selection-screen');
const charactersContainer = document.getElementById('characters-container');
const confirmCharacterBtn = document.getElementById('confirm-character-selection');

const waitingRoomScreen = document.getElementById('waiting-room-screen');
const waitingRoomModeSpan = document.getElementById('waiting-room-mode');
const waitingPlayersList = document.getElementById('waiting-players-list');

const combatScreen = document.getElementById('combat-screen');
const myCharacterNameEl = document.getElementById('my-character-name');
const myCharacterHpEl = document.getElementById('my-character-hp');
const actionButtonsDiv = document.getElementById('action-buttons');
const combatLogEl = document.getElementById('combat-log');

const chatAndOnline = document.getElementById('chat-and-online');
const messagesList = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('m');

const onlineList = document.getElementById('online-list');
const playerList = document.getElementById('player-list');

// Variables globales
let playerName = '';
let selectedCharacter = null;
let mySocketId = '';
let currentTurnSocketId = '';
let playersInRoom = [];

// --- Funciones helper para mostrar/ocultar ---
function showScreen(screen) {
    document.querySelectorAll('.game-section').forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

// --- Inicio ---
showScreen(nameInputScreen);

// --- Manejo ingreso nombre ---
confirmNameButton.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name.length < 2) {
        alert('Ingresa un nombre válido.');
        return;
    }
    playerName = name;
    showScreen(startScreen);
});

// --- Selección modo ---
mode1v1Btn.addEventListener('click', () => {
    // Solo tenemos 1 modo por ahora
    showScreen(characterSelectionScreen);
    renderCharacterOptions();
});

// --- Render personajes ---
function renderCharacterOptions() {
    charactersContainer.innerHTML = '';
    characters.forEach(char => {
        const card = document.createElement('div');
        card.classList.add('character-card');
        card.dataset.id = char.id;
        card.innerHTML = `<div class="character-name">${char.name}</div>`;
        card.addEventListener('click', () => {
            selectCharacter(char.id);
        });
        charactersContainer.appendChild(card);
    });
    confirmCharacterBtn.disabled = true;
}

function selectCharacter(charId) {
    selectedCharacter = characters.find(c => c.id === charId);
    // Quitar selección anterior
    document.querySelectorAll('.character-card').forEach(card => {
        card.classList.remove('selected');
    });
    // Marcar seleccionado
    const selectedCard = document.querySelector(`.character-card[data-id="${charId}"]`);
    if (selectedCard) selectedCard.classList.add('selected');
    confirmCharacterBtn.disabled = false;
}

// --- Confirmar personaje ---
confirmCharacterBtn.addEventListener('click', () => {
    if (!selectedCharacter) return;
    // Enviar datos al servidor
    socket.emit('player-join', {
        name: playerName,
        character: selectedCharacter
    });
    showScreen(waitingRoomScreen);
    waitingRoomModeSpan.textContent = '1 vs 1';
});

// --- Sala de espera ---
socket.on('waiting-room-update', ({ players }) => {
    waitingPlayersList.innerHTML = '';
    playersInRoom = players;
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name + (p.socketId === mySocketId ? ' (Tú)' : '');
        waitingPlayersList.appendChild(li);
    });
});

// --- Inicio de juego ---
socket.on('game-start', ({ players, turnSocketId, log }) => {
    playersInRoom = players;
    currentTurnSocketId = turnSocketId;
    showScreen(combatScreen);
    chatAndOnline.classList.remove('hidden');

    // Encontrar info propia
    const me = players.find(p => p.socketId === socket.id);
    myCharacterNameEl.textContent = me.character.name;
    updateHpDisplay(me.hp, me.maxHp);

    renderActionButtons(me.character.abilities);
    updateCombatLog(log);
});

// --- Actualización del juego ---
socket.on('game-update', ({ players, turnSocketId, log }) => {
    playersInRoom = players;
    currentTurnSocketId = turnSocketId;

    const me = players.find(p => p.socketId === socket.id);
    if (me) {
        updateHpDisplay(me.hp, me.maxHp);
    }
    renderActionButtons(me.character.abilities, currentTurnSocketId === socket.id);

    updateCombatLog(log);
});

// --- Actualizar vida en pantalla ---
function updateHpDisplay(hp, maxHp) {
    myCharacterHpEl.textContent = `${hp} / ${maxHp}`;
}

// --- Render botones de habilidades ---
function renderActionButtons(abilities, isMyTurn = false) {
    actionButtonsDiv.innerHTML = '';
    abilities.forEach(ability => {
        const btn = document.createElement('button');
        btn.textContent = ability.name;
        btn.disabled = !isMyTurn;
        btn.addEventListener('click', () => {
            socket.emit('player-action', { abilityId: ability.id });
        });
        actionButtonsDiv.appendChild(btn);
    });
}

// --- Actualizar log de combate ---
function updateCombatLog(log) {
    combatLogEl.innerHTML = '';
    log.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        combatLogEl.appendChild(p);
    });
    combatLogEl.scrollTop = combatLogEl.scrollHeight;
}

// --- Chat ---
chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (msg.length === 0) return;
    socket.emit('chat-message', msg);
    chatInput.value = '';
});

socket.on('chat-message', ({ name, message }) => {
    const li = document.createElement('li');
    li.textContent = `${name}: ${message}`;
    messagesList.appendChild(li);
    messagesList.scrollTop = messagesList.scrollHeight;
});

// --- Lista jugadores online (simplificada) ---
socket.on('connect', () => {
    mySocketId = socket.id;
});

