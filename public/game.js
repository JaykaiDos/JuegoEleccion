const socket = io();
let name = '';
let selectedCharacter = '';
const restartBtn = document.getElementById('restartBtn');

// Paso 1: Elegir personaje
document.querySelectorAll(".charBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedCharacter = btn.dataset.character;
    document.getElementById("characterSelect").style.display = "none";
    document.getElementById("login").style.display = "block";
  });
});

// Paso 2: Enviar nombre y personaje
document.getElementById("joinBtn").onclick = () => {
  name = document.getElementById("nameInput").value.trim();
  if (name && selectedCharacter) {
    socket.emit("join", { name, character: selectedCharacter });
    document.getElementById("login").style.display = "none";
    document.getElementById("game").style.display = "block";
  }
};

socket.on("updatePlayers", names => {
  const ul = document.getElementById("playerList");
  ul.innerHTML = '';
  names.forEach(n => {
    const li = document.createElement("li");
    li.textContent = n;
    ul.appendChild(li);
  });
});

socket.on("waiting", msg => {
  const chapterText = document.getElementById("chapterText");
  chapterText.textContent = msg;
  document.getElementById("options").innerHTML = '';
});

socket.on("chapter", chap => {
  document.getElementById("dice").style.display = "none";
  document.getElementById("endMessage").textContent = "";
  const chapterText = document.getElementById("chapterText");
  chapterText.textContent = chap.text;
  const optionsDiv = document.getElementById("options");
  optionsDiv.innerHTML = '';
  chap.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = opt.text;
    btn.onclick = () => {
      socket.emit("vote", opt.id);
    };
    optionsDiv.appendChild(btn);
  });
});

socket.on("startDice", () => {
  document.getElementById("dice").style.display = "block";
  const diceDiv = document.getElementById("diceChoices");
  diceDiv.innerHTML = '';
  for (let i = 1; i <= 6; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.onclick = () => {
      socket.emit("numberChoice", i);
      document.getElementById("dice").style.display = "none";
    };
    diceDiv.appendChild(btn);
  }
});

socket.on("voteResult", data => {
  const chapterText = document.getElementById("chapterText");

  let votesList = "";
  if (Array.isArray(data.detailedVotes)) {
    votesList = "<ul>" + data.detailedVotes.map(v => `<li>${v.name} votó por ${v.vote}</li>`).join("") + "</ul>";
  }

  if (data.reason === "Mayoría") {
    chapterText.innerHTML = `
      <p>Resultado por mayoría: Opción ${data.result}</p>
      ${votesList}
    `;
  } else if (data.reason === "Empate") {
    chapterText.innerHTML = `
      <p>Empate en votación. Se resolverá con el dado.</p>
      ${votesList}
    `;
  } else if (data.reason === "Empate resuelto con dado") {
    chapterText.innerHTML = `
      <p>Empate resuelto con dado: salió el número <strong>${data.dice.roll}</strong></p>
      <p>${Object.entries(data.dice.choices).map(([name, num]) => `${name} eligió ${num}`).join("<br>")}</p>
      <p>Ganó la opción <strong>${data.result}</strong></p>
      ${votesList}
    `;
  }
});


socket.on('end', msg => {
  document.getElementById('endMessage').textContent = msg;
  restartBtn.style.display = 'inline-block';
});

restartBtn.onclick = () => {
  socket.emit('restartGame');
  document.getElementById('endMessage').textContent = '';
  restartBtn.style.display = 'none';
  // Opcional: volver a mostrar opciones o mensaje de espera
};

// Chat
document.getElementById("chatInput").addEventListener("keypress", e => {
  if (e.key === "Enter") {
    const msg = e.target.value.trim();
    if (msg) {
      socket.emit("chatMessage", msg);
      e.target.value = "";
    }
  }
});

socket.on("chatMessage", ({ name, msg }) => {
  const chat = document.getElementById("chatBox");
  const p = document.createElement("p");
  p.textContent = `${name}: ${msg}`;
  chat.appendChild(p);
  chat.scrollTop = chat.scrollHeight;
});

socket.on("playerVoted", ({ name, optionText }) => {
  const chat = document.getElementById("chatBox");
  const p = document.createElement("p");
  p.innerHTML = `<em>${name} seleccionó: "${optionText}"</em>`;
  chat.appendChild(p);
  chat.scrollTop = chat.scrollHeight;
});
